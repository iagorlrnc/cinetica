import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import { confirmarPedidoLoja, criarPedidoLoja, validarItensLoja } from '@/lib/pagamentos/loja';

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limiteIp = await limitarRequisicao(`loja_free_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 20 });
  if (!limiteIp.permitido) {
    return NextResponse.json({ erro: 'Muitas tentativas em curto intervalo. Aguarde um minuto.' }, { status: 429 });
  }

  try {
    const sessao = await obterSessaoApi();
    if (!sessao) {
      return NextResponse.json({ erro: 'Autenticação necessária para realizar o pedido.' }, { status: 401 });
    }
    const { user, perfil } = sessao;
    if (perfil?.status === 'bloqueado') {
      return NextResponse.json({ erro: 'Sua conta está bloqueada.' }, { status: 403 });
    }

    const limiteUsuario = await limitarRequisicao(`loja_free_user:${user.id}`, { janelaMs: 60_000, maxRequisicoes: 5 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.comprador_id && body.comprador_id !== user.id) {
      logger.security('IDOR prevenido ao resgatar produto gratuito', { caller: user.id, target: String(body.comprador_id) });
      return NextResponse.json({ erro: 'Ação não autorizada para este comprador.' }, { status: 403 });
    }

    const admin = criarClienteAdmin();
    const validacao = await validarItensLoja(admin, body.itens, { userId: user.id, modo: 'gratuito' });
    if (!validacao.ok) {
      return NextResponse.json({ erro: validacao.erro }, { status: 400 });
    }

    const pedido = await criarPedidoLoja(admin, {
      userId: user.id,
      itens: validacao.itens,
      totalCentavos: 0,
      atleticaId: validacao.atleticaId,
      metodo: 'gratuito',
      metadata: { gratuito: true },
    });
    if (!pedido.ok) {
      return NextResponse.json({ erro: pedido.erro }, { status: 500 });
    }

    // Baixa de estoque atômica (FOR UPDATE) pela mesma RPC dos pedidos pagos
    const resultado = await confirmarPedidoLoja(
      admin,
      { id: pedido.orderId, user_id: user.id, status: 'pending_payment', total_amount: 0 },
      { id: `gratuito_${pedido.orderId}`, status: 'approved', external_reference: pedido.orderId, transaction_amount: 0, payment_method_id: 'gratuito' }
    );

    if (!resultado.sucesso) {
      await admin.from('store_orders').update({ status: 'failed' }).eq('id', pedido.orderId).eq('status', 'pending_payment');
      const msg = resultado.erro === 'stock_unavailable' ? 'Este produto acabou de esgotar.' : 'Não foi possível confirmar o pedido gratuito.';
      return NextResponse.json({ erro: msg }, { status: 409 });
    }

    logger.info('Pedido gratuito da loja concluído', { orderId: pedido.orderId, userId: user.id });
    return NextResponse.json({ sucesso: true, order_id: pedido.orderId, mensagem: 'Pedido gratuito confirmado com sucesso!' });
  } catch (err: unknown) {
    logger.error('Erro no checkout gratuito da loja', err);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
