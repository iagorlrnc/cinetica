import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import { TEMPO_EXPIRACAO_PIX_MINUTOS } from '@/lib/constantes';
import { montarPayer, obterUrlWebhook } from '@/lib/pagamentos/comum';
import {
  calcularValoresPedido,
  criarOuReutilizarPedidoPendente,
  validarCompraIngresso,
} from '@/lib/pagamentos/ingressos';

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);

  const limiteIp = await limitarRequisicao(`checkout_pix_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 20 });
  if (!limiteIp.permitido) {
    logger.warn('Rate limit excedido na criação de Pix', { ip });
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

    const limiteUsuario = await limitarRequisicao(`checkout_pix_user:${user.id}`, { janelaMs: 60_000, maxRequisicoes: 8 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Muitas tentativas de compra. Aguarde um minuto.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.comprador_id && body.comprador_id !== user.id) {
      logger.security('IDOR prevenido ao criar Pix', { caller: user.id, target: String(body.comprador_id) });
      return NextResponse.json({ erro: 'Ação não autorizada para este comprador.' }, { status: 403 });
    }

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
    const expiraEm = new Date(Date.now() + TEMPO_EXPIRACAO_PIX_MINUTOS * 60 * 1000);

    const pedido = await criarOuReutilizarPedidoPendente(supabase, {
      idSugerido: body.pedido_id || body.idempotency_key,
      compradorId: user.id,
      eventoId: evento.id,
      loteId: lote.id,
      quantidade,
      valores,
      metodo: 'pix',
      expiraEm,
    });
    if (!pedido.ok) {
      return NextResponse.json({ erro: pedido.erro }, { status: 500 });
    }

    const payer = montarPayer(perfil, user.email);
    const mpRes = await paymentClient.create({
      body: {
        transaction_amount: valores.totalFinal,
        description: `${evento.titulo} — ${lote.nome_lote} (${quantidade}x)`.slice(0, 200),
        payment_method_id: 'pix',
        statement_descriptor: 'MEUINGRSS',
        payer,
        external_reference: pedido.pedidoId,
        notification_url: obterUrlWebhook(),
        date_of_expiration: expiraEm.toISOString(),
        metadata: {
          tipo: 'ingresso',
          pedido_id: pedido.pedidoId,
          evento_id: evento.id,
          lote_id: lote.id,
          comprador_id: user.id,
          quantidade,
        },
      },
      requestOptions: { idempotencyKey: `pix-${pedido.pedidoId}` },
    });

    if (!mpRes?.id) {
      logger.error('Mercado Pago não retornou ID de pagamento Pix', null, { pedido_id: pedido.pedidoId });
      return NextResponse.json({ erro: 'Não foi possível gerar a cobrança Pix.' }, { status: 502 });
    }

    await supabase
      .from('pedidos')
      .update({ gateway_payment_id: String(mpRes.id), gateway_transaction_id: String(mpRes.id) })
      .eq('id', pedido.pedidoId);

    const pointData = mpRes.point_of_interaction?.transaction_data;
    logger.info('Pagamento Pix criado', { pedido_id: pedido.pedidoId, payment_id: String(mpRes.id), comprador_id: user.id });

    return NextResponse.json({
      sucesso: true,
      pedido_id: pedido.pedidoId,
      payment_id: String(mpRes.id),
      qr_code: pointData?.qr_code || '',
      qr_code_base64: pointData?.qr_code_base64 || '',
      date_of_expiration: mpRes.date_of_expiration || expiraEm.toISOString(),
      status: mpRes.status,
      valor_total: valores.totalFinal,
    });
  } catch (error: unknown) {
    logger.error('Erro na criação de pagamento Pix', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
