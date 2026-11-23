import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado, traduzirStatusRecusaCartao } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import {
  montarPayer,
  normalizarIssuer,
  normalizarMetodoCartao,
  normalizarParcelas,
  obterUrlWebhook,
  STATUS_GATEWAY_EM_ANALISE,
  type PagamentoGateway,
} from '@/lib/pagamentos/comum';
import { confirmarPedidoLoja, criarPedidoLoja, validarItensLoja } from '@/lib/pagamentos/loja';

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limiteIp = await limitarRequisicao(`loja_card_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 15 });
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

    const limiteUsuario = await limitarRequisicao(`loja_card_user:${user.id}`, { janelaMs: 600_000, maxRequisicoes: 5 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Limite de tentativas com cartão atingido. Aguarde alguns minutos ou utilize Pix.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const formData = (body.formData && typeof body.formData === 'object') ? body.formData : {};

    if (body.comprador_id && body.comprador_id !== user.id) {
      logger.security('IDOR prevenido no cartão da loja', { caller: user.id, target: String(body.comprador_id) });
      return NextResponse.json({ erro: 'Ação não autorizada.' }, { status: 403 });
    }

    const token = body.token || formData.token;
    if (!token || typeof token !== 'string' || token.length > 200) {
      return NextResponse.json({ erro: 'Token de cartão ausente ou inválido.' }, { status: 400 });
    }

    const metodo = normalizarMetodoCartao(body.payment_method_id || body.paymentMethodId || formData.payment_method_id || formData.paymentMethodId) || 'visa';
    const parcelas = normalizarParcelas(body.installments || formData.installments);
    const issuer = normalizarIssuer(body.issuer_id || body.issuerId || formData.issuer_id || formData.issuerId);

    if (!ehMercadoPagoConfigurado()) {
      return NextResponse.json({ erro: 'O pagamento online está temporariamente indisponível.' }, { status: 503 });
    }

    const admin = criarClienteAdmin();
    const validacao = await validarItensLoja(admin, body.itens, { userId: user.id, modo: 'pago' });
    if (!validacao.ok) {
      return NextResponse.json({ erro: validacao.erro }, { status: 400 });
    }

    const pedido = await criarPedidoLoja(admin, {
      userId: user.id,
      itens: validacao.itens,
      totalCentavos: validacao.totalCentavos,
      atleticaId: validacao.atleticaId,
      metodo,
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
        token,
        description: descricao.slice(0, 100),
        installments: parcelas,
        payment_method_id: metodo,
        ...(issuer ? { issuer_id: Number(issuer) } : {}),
        statement_descriptor: 'CINETICA LOJA',
        payer: montarPayer(perfil, user.email, body.payer || formData.payer || null),
        external_reference: pedido.orderId,
        notification_url: obterUrlWebhook(),
        metadata: { tipo: 'loja', order_id: pedido.orderId, user_id: user.id, total_cents: validacao.totalCentavos },
      },
      requestOptions: { idempotencyKey: `loja-card-${pedido.orderId}` },
    });

    if (!mpRes?.id) {
      await admin.from('store_orders').update({ status: 'failed' }).eq('id', pedido.orderId);
      return NextResponse.json({ erro: 'Não foi possível processar a cobrança do cartão.' }, { status: 502 });
    }

    const gatewayPaymentId = String(mpRes.id);
    const status = String(mpRes.status || '');
    await admin
      .from('store_orders')
      .update({ mercado_pago_payment_id: gatewayPaymentId, payment_method: metodo })
      .eq('id', pedido.orderId);

    if (status === 'approved') {
      const resultado = await confirmarPedidoLoja(
        admin,
        { id: pedido.orderId, user_id: user.id, status: 'pending_payment', total_amount: validacao.totalCentavos },
        mpRes as unknown as PagamentoGateway
      );
      if (!resultado.sucesso && resultado.erro === 'stock_unavailable') {
        return NextResponse.json({
          sucesso: false,
          status: 'stock_unavailable',
          order_id: pedido.orderId,
          erro: 'Um dos produtos esgotou durante o pagamento. O valor será estornado.',
        }, { status: 409 });
      }
      return NextResponse.json({
        sucesso: true,
        status: resultado.sucesso ? 'approved' : 'in_process',
        order_id: pedido.orderId,
        payment_id: gatewayPaymentId,
        total_amount: validacao.totalCentavos,
        mensagem: resultado.sucesso ? 'Pagamento aprovado com sucesso! Seu pedido foi confirmado.' : 'Pagamento recebido. Confirmando seu pedido...',
      });
    }

    if (STATUS_GATEWAY_EM_ANALISE.includes(status)) {
      return NextResponse.json({
        sucesso: true,
        status: 'in_process',
        order_id: pedido.orderId,
        payment_id: gatewayPaymentId,
        mensagem: 'Seu pagamento está em análise pela operadora do cartão.',
      });
    }

    await admin.from('store_orders').update({ status: 'failed' }).eq('id', pedido.orderId).eq('status', 'pending_payment');
    return NextResponse.json(
      { sucesso: false, status, status_detail: mpRes.status_detail, erro: traduzirStatusRecusaCartao(String(mpRes.status_detail || '')) },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error('Erro no pagamento com cartão da loja', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
