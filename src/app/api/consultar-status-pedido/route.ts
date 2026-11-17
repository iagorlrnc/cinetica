import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi, ehAdminAtivo } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { ehIdPagamentoGateway, ehUuid, obterIpRequisicao } from '@/lib/seguranca';
import { STATUS_GATEWAY_CANCELADOS, type PagamentoGateway } from '@/lib/pagamentos/comum';
import { liberarIngressosDoPagamento, traduzirErroLiberacao, type PedidoIngresso } from '@/lib/pagamentos/ingressos';

const CAMPOS_PEDIDO = 'id, comprador_id, evento_id, lote_id, quantidade, valor_total, status, gateway_payment_id, criado_em';

type Pedido = PedidoIngresso & { gateway_payment_id: string | null; criado_em: string };

function resposta(status_pedido: string, mensagem: string, pedido?: Pick<Pedido, 'id' | 'evento_id'> | null, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ status_pedido, mensagem, pedido_id: pedido?.id, evento_id: pedido?.evento_id, ...extra });
}

/**
 * Consulta o status de um pedido de ingressos do PRÓPRIO usuário e, se necessário,
 * reconcilia com o Mercado Pago. Nunca cria pedidos a partir de parâmetros da URL e
 * nunca aceita um payment_id que não pertença ao pedido consultado.
 */
export async function GET(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limite = await limitarRequisicao(`status_pedido:${ip}`, { janelaMs: 60_000, maxRequisicoes: 60 });
  if (!limite.permitido) {
    return NextResponse.json({ erro: 'Muitas consultas. Aguarde um momento.' }, { status: 429 });
  }

  try {
    const sessao = await obterSessaoApi();
    if (!sessao) {
      return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
    }
    const { user, perfil } = sessao;
    const admin = ehAdminAtivo(perfil);

    const sp = request.nextUrl.searchParams;
    const pedidoIdParam = sp.get('pedido_id') || sp.get('external_reference');
    const paymentIdParam = sp.get('payment_id') || sp.get('collection_id');
    const eventoIdParam = sp.get('evento_id');
    const loteIdParam = sp.get('lote_id');

    const supabase = criarClienteAdmin();
    let pedido: Pedido | null = null;

    if (ehUuid(pedidoIdParam)) {
      const { data } = await supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('id', pedidoIdParam).maybeSingle();
      pedido = data as Pedido | null;
    } else if (ehIdPagamentoGateway(paymentIdParam)) {
      const { data } = await supabase
        .from('pedidos')
        .select(CAMPOS_PEDIDO)
        .eq('gateway_payment_id', String(paymentIdParam))
        .eq('comprador_id', user.id)
        .maybeSingle();
      pedido = data as Pedido | null;
    } else if (ehUuid(eventoIdParam) && ehUuid(loteIdParam)) {
      const { data } = await supabase
        .from('pedidos')
        .select(CAMPOS_PEDIDO)
        .eq('comprador_id', user.id)
        .eq('evento_id', eventoIdParam)
        .eq('lote_id', loteIdParam)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      pedido = data as Pedido | null;
    }

    if (!pedido) {
      return NextResponse.json({ status_pedido: null, mensagem: 'Nenhum pedido encontrado para consulta.' });
    }

    if (pedido.comprador_id !== user.id && !admin) {
      logger.security('IDOR prevenido ao consultar status do pedido', { caller: user.id, target: pedido.comprador_id });
      return NextResponse.json({ erro: 'Acesso não autorizado aos dados deste pedido.' }, { status: 403 });
    }

    if (pedido.status === 'aprovado') {
      return resposta('aprovado', 'Pagamento confirmado! Seus ingressos foram liberados.', pedido, { quantidade_ingressos: pedido.quantidade });
    }
    if (pedido.status === 'estoque_esgotado') {
      return resposta('estoque_esgotado', 'Estoque esgotado durante o processamento. O valor será estornado.', pedido);
    }
    if (['recusado', 'estornado'].includes(pedido.status)) {
      return resposta('cancelado', 'O pagamento foi cancelado, expirou ou foi recusado.', pedido);
    }

    if (!ehMercadoPagoConfigurado()) {
      return resposta('aguardando', 'Aguardando confirmação do pagamento...', pedido);
    }

    // Reconciliação: só considera pagamentos do PRÓPRIO pedido
    let candidatos: PagamentoGateway[] = [];
    if (pedido.gateway_payment_id && ehIdPagamentoGateway(pedido.gateway_payment_id)) {
      try {
        const direto = await paymentClient.get({ id: pedido.gateway_payment_id });
        if (direto) candidatos = [direto as unknown as PagamentoGateway];
      } catch (err) {
        logger.warn('Consulta direta do pagamento falhou', { pedido_id: pedido.id, erro: String(err) });
      }
    }

    if (!candidatos.some((p) => p.status === 'approved')) {
      try {
        const busca = await paymentClient.search({
          options: { external_reference: pedido.id, sort: 'date_created', criteria: 'desc', limit: 5 },
        });
        candidatos = [...candidatos, ...((busca.results || []) as unknown as PagamentoGateway[])];
      } catch (err) {
        logger.warn('Busca por external_reference falhou', { pedido_id: pedido.id, erro: String(err) });
      }
    }

    const aprovado = candidatos.find((p) => p.status === 'approved');
    if (aprovado) {
      const resultado = await liberarIngressosDoPagamento(supabase, pedido, aprovado);
      if (resultado.sucesso) {
        return resposta('aprovado', 'Pagamento confirmado e ingressos liberados com sucesso!', pedido, { quantidade_ingressos: pedido.quantidade });
      }
      const traducao = traduzirErroLiberacao(resultado.erro);
      return resposta(traducao.status, traducao.mensagem, pedido);
    }

    const todosCancelados = candidatos.length > 0 && candidatos.every((p) => STATUS_GATEWAY_CANCELADOS.includes(String(p.status)));
    if (todosCancelados) {
      await supabase.from('pedidos').update({ status: 'recusado' }).eq('id', pedido.id).eq('status', 'pendente');
      return resposta('cancelado', 'O pagamento foi cancelado ou recusado pela instituição financeira.', pedido);
    }

    return resposta('aguardando', 'Aguardando confirmação do pagamento pelo gateway...', pedido);
  } catch (error) {
    logger.error('Erro ao consultar status do pedido', error);
    return NextResponse.json({ erro: 'Erro interno ao consultar status do pedido' }, { status: 500 });
  }
}
