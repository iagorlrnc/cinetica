import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import { TEMPO_EXPIRACAO_PIX_MINUTOS } from '@/lib/constantes';
import { montarPayer, obterUrlWebhook } from '@/lib/pagamentos/comum';
import { criarPedidoLoja, validarItensLoja } from '@/lib/pagamentos/loja';

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limiteIp = await limitarRequisicao(`loja_pix_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 20 });
  if (!limiteIp.permitido) {
    return NextResponse.json({ erro: 'Muitas tentativas de compra em curto intervalo. Aguarde um momento.' }, { status: 429 });
  }

  try {
    const sessao = await obterSessaoApi();
    if (!sessao) {
      return NextResponse.json({ erro: 'Autenticação necessária para realizar compras.' }, { status: 401 });
    }
    const { user, perfil } = sessao;
    if (perfil?.status === 'bloqueado') {
      return NextResponse.json({ erro: 'Sua conta está bloqueada.' }, { status: 403 });
    }

    const limiteUsuario = await limitarRequisicao(`loja_pix_user:${user.id}`, { janelaMs: 60_000, maxRequisicoes: 8 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.comprador_id && body.comprador_id !== user.id) {
      logger.security('IDOR prevenido ao criar Pix da loja', { caller: user.id, target: String(body.comprador_id) });
      return NextResponse.json({ erro: 'Ação não autorizada.' }, { status: 403 });
    }

    if (!ehMercadoPagoConfigurado()) {
      return NextResponse.json({ erro: 'O pagamento online está temporariamente indisponível.' }, { status: 503 });
    }

    const admin = criarClienteAdmin();
    const validacao = await validarItensLoja(admin, body.itens, { userId: user.id, modo: 'pago' });
    if (!validacao.ok) {
      return NextResponse.json({ erro: validacao.erro }, { status: 400 });
    }

    const expiraEm = new Date(Date.now() + TEMPO_EXPIRACAO_PIX_MINUTOS * 60 * 1000);
    const pedido = await criarPedidoLoja(admin, {
      userId: user.id,
      itens: validacao.itens,
      totalCentavos: validacao.totalCentavos,
      atleticaId: validacao.atleticaId,
      metodo: 'pix',
      metadata: { data_expiracao: expiraEm.toISOString() },
    });
    if (!pedido.ok) {
      return NextResponse.json({ erro: pedido.erro }, { status: 500 });
    }

    const primeiro = validacao.itens[0];
    const descricao = validacao.itens.length === 1
      ? `Loja: ${primeiro.name} (${primeiro.quantity}x)`
      : `Loja: ${primeiro.name} e mais ${validacao.itens.length - 1} item(ns)`;

    const mpRes = await paymentClient.create({
      body: {
        transaction_amount: Number((validacao.totalCentavos / 100).toFixed(2)),
        description: descricao.slice(0, 100),
        payment_method_id: 'pix',
        statement_descriptor: 'CINETICA LOJA',
        payer: montarPayer(perfil, user.email),
        external_reference: pedido.orderId,
        notification_url: obterUrlWebhook(),
        date_of_expiration: expiraEm.toISOString(),
        metadata: { tipo: 'loja', order_id: pedido.orderId, user_id: user.id, total_cents: validacao.totalCentavos },
      },
      requestOptions: { idempotencyKey: `loja-pix-${pedido.orderId}` },
    });

    if (!mpRes?.id) {
      logger.error('Mercado Pago não retornou ID de Pix para a loja', null, { order_id: pedido.orderId });
      await admin.from('store_orders').update({ status: 'failed' }).eq('id', pedido.orderId);
      return NextResponse.json({ erro: 'Não foi possível gerar a cobrança Pix.' }, { status: 502 });
    }

    await admin.from('store_orders').update({ mercado_pago_payment_id: String(mpRes.id) }).eq('id', pedido.orderId);

    const pointData = mpRes.point_of_interaction?.transaction_data;
    return NextResponse.json({
      sucesso: true,
      order_id: pedido.orderId,
      payment_id: String(mpRes.id),
      qr_code: pointData?.qr_code || '',
      qr_code_base64: pointData?.qr_code_base64 || '',
      date_of_expiration: mpRes.date_of_expiration || expiraEm.toISOString(),
      total_amount: validacao.totalCentavos,
      status: mpRes.status,
    });
  } catch (error: unknown) {
    logger.error('Erro na criação de Pix da loja', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
