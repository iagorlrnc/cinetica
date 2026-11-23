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
import {
  calcularValoresPedido,
  criarOuReutilizarPedidoPendente,
  liberarIngressosDoPagamento,
  traduzirErroLiberacao,
  validarCompraIngresso,
} from '@/lib/pagamentos/ingressos';

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);

  const limiteIp = await limitarRequisicao(`checkout_card_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 15 });
  if (!limiteIp.permitido) {
    logger.warn('Rate limit excedido no checkout de cartão', { ip });
    return NextResponse.json({ erro: 'Muitas tentativas de compra em curto intervalo. Aguarde um minuto.' }, { status: 429 });
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

    // Anti card-testing: no máximo 5 tentativas de cartão por usuário a cada 10 minutos
    const limiteUsuario = await limitarRequisicao(`checkout_card_user:${user.id}`, { janelaMs: 600_000, maxRequisicoes: 5 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Limite de tentativas com cartão atingido. Aguarde alguns minutos ou utilize Pix.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const formData = (body.formData && typeof body.formData === 'object') ? body.formData : {};

    if (body.comprador_id && body.comprador_id !== user.id) {
      logger.security('IDOR prevenido no pagamento com cartão', { caller: user.id, target: String(body.comprador_id) });
      return NextResponse.json({ erro: 'Ação não autorizada para este comprador.' }, { status: 403 });
    }

    const token = body.token || formData.token;
    if (!token || typeof token !== 'string' || token.length > 200) {
      return NextResponse.json({ erro: 'Token de cartão ausente ou inválido.' }, { status: 400 });
    }

    const metodo = normalizarMetodoCartao(body.payment_method_id || body.paymentMethodId || formData.payment_method_id || formData.paymentMethodId) || 'visa';
    const parcelas = normalizarParcelas(body.installments || formData.installments);
    const issuer = normalizarIssuer(body.issuer_id || body.issuerId || formData.issuer_id || formData.issuerId);
    const payerCliente = body.payer || formData.payer || null;

    if (!ehMercadoPagoConfigurado()) {
      return NextResponse.json({ erro: 'O pagamento online está temporariamente indisponível.' }, { status: 503 });
    }

    const supabase = criarClienteAdmin();
    const validacao = await validarCompraIngresso(supabase, {
      eventoId: body.evento_id,
      loteId: body.lote_id,
      quantidade: body.quantidade,
    });
    if (!validacao.ok) {
      return NextResponse.json({ erro: validacao.erro }, { status: validacao.status });
    }
    const { evento, lote, quantidade } = validacao;

    if (lote.preco === 0) {
      return NextResponse.json({ erro: 'Este lote é gratuito. Utilize a reserva gratuita.' }, { status: 400 });
    }

    const valores = calcularValoresPedido(lote.preco, quantidade);
    const pedido = await criarOuReutilizarPedidoPendente(supabase, {
      idSugerido: body.pedido_id || body.idempotency_key,
      compradorId: user.id,
      eventoId: evento.id,
      loteId: lote.id,
      quantidade,
      valores,
      metodo,
    });
    if (!pedido.ok) {
      return NextResponse.json({ erro: pedido.erro }, { status: 500 });
    }

    const mpRes = await paymentClient.create({
      body: {
        transaction_amount: valores.totalFinal,
        token,
        description: `${evento.titulo} — ${lote.nome_lote} (${quantidade}x)`.slice(0, 200),
        installments: parcelas,
        payment_method_id: metodo,
        ...(issuer ? { issuer_id: Number(issuer) } : {}),
        statement_descriptor: 'CINETICA',
        payer: montarPayer(perfil, user.email, payerCliente),
        external_reference: pedido.pedidoId,
        notification_url: obterUrlWebhook(),
        metadata: {
          tipo: 'ingresso',
          pedido_id: pedido.pedidoId,
          evento_id: evento.id,
          lote_id: lote.id,
          comprador_id: user.id,
          quantidade,
        },
      },
      requestOptions: { idempotencyKey: `card-${pedido.pedidoId}-${token.slice(-12)}` },
    });

    if (!mpRes?.id) {
      logger.error('Mercado Pago não retornou resposta válida para cartão', null, { pedido_id: pedido.pedidoId });
      return NextResponse.json({ erro: 'Não foi possível processar a cobrança do cartão.' }, { status: 502 });
    }

    const gatewayPaymentId = String(mpRes.id);
    const statusPagamento = String(mpRes.status || '');
    const statusDetail = String(mpRes.status_detail || '');

    await supabase
      .from('pedidos')
      .update({ gateway_payment_id: gatewayPaymentId, gateway_transaction_id: gatewayPaymentId, metodo_pagamento: metodo })
      .eq('id', pedido.pedidoId);

    logger.info('Resposta do Mercado Pago para cartão', {
      pedido_id: pedido.pedidoId,
      payment_id: gatewayPaymentId,
      status: statusPagamento,
      status_detail: statusDetail,
    });

    if (statusPagamento === 'approved') {
      const liberacao = await liberarIngressosDoPagamento(
        supabase,
        {
          id: pedido.pedidoId,
          comprador_id: user.id,
          evento_id: evento.id,
          lote_id: lote.id,
          quantidade,
          valor_total: valores.totalFinal,
          status: 'pendente',
        },
        mpRes as unknown as PagamentoGateway,
        { emailComprador: user.email }
      );

      if (!liberacao.sucesso) {
        const traducao = traduzirErroLiberacao(liberacao.erro);
        return NextResponse.json({
          sucesso: true,
          status: traducao.status === 'estoque_esgotado' ? 'estoque_esgotado' : 'pending',
          pedido_id: pedido.pedidoId,
          payment_id: gatewayPaymentId,
          mensagem: traducao.mensagem,
        });
      }

      return NextResponse.json({
        sucesso: true,
        status: 'approved',
        pedido_id: pedido.pedidoId,
        payment_id: gatewayPaymentId,
        mensagem: 'Pagamento aprovado com sucesso! Seus ingressos foram gerados.',
      });
    }

    if (STATUS_GATEWAY_EM_ANALISE.includes(statusPagamento)) {
      return NextResponse.json({
        sucesso: true,
        status: statusPagamento,
        pedido_id: pedido.pedidoId,
        payment_id: gatewayPaymentId,
        mensagem: 'Seu pagamento está em análise pela operadora do cartão.',
      });
    }

    await supabase.from('pedidos').update({ status: 'recusado' }).eq('id', pedido.pedidoId).eq('status', 'pendente');

    return NextResponse.json(
      { sucesso: false, status: statusPagamento, status_detail: statusDetail, erro: traduzirStatusRecusaCartao(statusDetail) },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error('Erro na criação de pagamento por cartão', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
