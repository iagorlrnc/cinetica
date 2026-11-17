import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi, ehAdminAtivo } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { ehIdPagamentoGateway, ehUuid, obterIpRequisicao } from '@/lib/seguranca';
import { STATUS_GATEWAY_CANCELADOS, type PagamentoGateway } from '@/lib/pagamentos/comum';
import { confirmarPedidoLoja, type PedidoLojaBanco } from '@/lib/pagamentos/loja';

const MENSAGENS: Record<string, string> = {
  paid: 'Pagamento confirmado com sucesso!',
  failed: 'O pagamento foi cancelado ou recusado.',
  cancelled: 'O pedido foi cancelado.',
  refunded: 'O pagamento foi estornado.',
  stock_unavailable: 'Estoque esgotado durante o processamento. O valor será estornado.',
  pending_payment: 'Aguardando confirmação do pagamento pelo gateway...',
};

function resposta(status: string, orderId: string | null, extra: Record<string, unknown> = {}) {
  // `status` é lido pelo checkout da loja; `status_pedido` mantido por compatibilidade
  return NextResponse.json({ status, status_pedido: status, mensagem: MENSAGENS[status] || MENSAGENS.pending_payment, order_id: orderId, ...extra });
}

export async function GET(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limite = await limitarRequisicao(`status_loja:${ip}`, { janelaMs: 60_000, maxRequisicoes: 60 });
  if (!limite.permitido) {
    return NextResponse.json({ erro: 'Muitas consultas. Aguarde um momento.' }, { status: 429 });
  }

  try {
    const sessao = await obterSessaoApi();
    if (!sessao) {
      return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const orderId = sp.get('order_id') || sp.get('pedido_id');
    const paymentIdParam = sp.get('payment_id');
    const admin = criarClienteAdmin();

    let pedido: (PedidoLojaBanco & { mercado_pago_payment_id: string | null; paid_at: string | null }) | null = null;
    if (ehUuid(orderId)) {
      const { data } = await admin
        .from('store_orders')
        .select('id, user_id, status, total_amount, mercado_pago_payment_id, paid_at')
        .eq('id', orderId)
        .maybeSingle();
      pedido = data;
    } else if (ehIdPagamentoGateway(paymentIdParam)) {
      const { data } = await admin
        .from('store_orders')
        .select('id, user_id, status, total_amount, mercado_pago_payment_id, paid_at')
        .eq('mercado_pago_payment_id', String(paymentIdParam))
        .eq('user_id', sessao.user.id)
        .maybeSingle();
      pedido = data;
    }

    if (!pedido) {
      return NextResponse.json({ status: null, status_pedido: null, mensagem: 'Pedido não encontrado.' });
    }

    if (pedido.user_id !== sessao.user.id && !ehAdminAtivo(sessao.perfil)) {
      logger.security('IDOR prevenido ao consultar pedido da loja', { caller: sessao.user.id, target: pedido.user_id });
      return NextResponse.json({ erro: 'Acesso não autorizado a este pedido.' }, { status: 403 });
    }

    if (pedido.status !== 'pending_payment') {
      return resposta(pedido.status, pedido.id, { total_amount: pedido.total_amount, paid_at: pedido.paid_at });
    }

    if (!ehMercadoPagoConfigurado()) {
      return resposta('pending_payment', pedido.id);
    }

    let candidatos: PagamentoGateway[] = [];
    if (ehIdPagamentoGateway(pedido.mercado_pago_payment_id)) {
      try {
        const direto = await paymentClient.get({ id: String(pedido.mercado_pago_payment_id) });
        if (direto) candidatos = [direto as unknown as PagamentoGateway];
      } catch (err) {
        logger.warn('Consulta direta de pagamento da loja falhou', { order_id: pedido.id, erro: String(err) });
      }
    }
    if (!candidatos.some((p) => p.status === 'approved')) {
      try {
        const busca = await paymentClient.search({
          options: { external_reference: pedido.id, sort: 'date_created', criteria: 'desc', limit: 5 },
        });
        candidatos = [...candidatos, ...((busca.results || []) as unknown as PagamentoGateway[])];
      } catch (err) {
        logger.warn('Busca de pagamento da loja falhou', { order_id: pedido.id, erro: String(err) });
      }
    }

    const aprovado = candidatos.find((p) => p.status === 'approved');
    if (aprovado) {
      const resultado = await confirmarPedidoLoja(admin, pedido, aprovado);
      if (resultado.sucesso) return resposta('paid', pedido.id, { total_amount: pedido.total_amount });
      if (resultado.erro === 'stock_unavailable') return resposta('stock_unavailable', pedido.id);
      return resposta('pending_payment', pedido.id);
    }

    if (candidatos.length > 0 && candidatos.every((p) => STATUS_GATEWAY_CANCELADOS.includes(String(p.status)))) {
      await admin.from('store_orders').update({ status: 'failed' }).eq('id', pedido.id).eq('status', 'pending_payment');
      return resposta('failed', pedido.id);
    }

    return resposta('pending_payment', pedido.id);
  } catch (error) {
    logger.error('Erro no GET /api/loja/consultar-status-pedido', error);
    return NextResponse.json({ erro: 'Falha interna ao consultar status do pedido' }, { status: 500 });
  }
}
