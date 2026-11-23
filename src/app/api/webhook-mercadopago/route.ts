import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, validarAssinaturaWebhook, obterSecretWebhook, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { ehIdPagamentoGateway, ehUuid, obterIpRequisicao } from '@/lib/seguranca';
import { STATUS_GATEWAY_CANCELADOS, type PagamentoGateway } from '@/lib/pagamentos/comum';
import { liberarIngressosDoPagamento, type PedidoIngresso } from '@/lib/pagamentos/ingressos';
import { confirmarPedidoLoja, type PedidoLojaBanco } from '@/lib/pagamentos/loja';
import { confirmarPedidoSorteio, ERROS_CONFIRMACAO_DEFINITIVOS, type PedidoSorteio } from '@/lib/pagamentos/sorteios';

type ClienteAdmin = ReturnType<typeof criarClienteAdmin>;

async function registrarLog(
  supabase: ClienteAdmin,
  dados: {
    tipo_evento?: string;
    acao?: string;
    data_id?: string;
    request_id?: string | null;
    status_resposta: number;
    resultado?: string;
    erro?: string;
    ip?: string;
    inicio: number;
    payload?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from('webhook_logs').insert({
      gateway: 'mercadopago',
      tipo_evento: dados.tipo_evento?.slice(0, 60),
      acao: dados.acao?.slice(0, 60),
      data_id: dados.data_id?.slice(0, 60),
      request_id: dados.request_id?.slice(0, 120) ?? null,
      payload: dados.payload ?? null,
      status_resposta: dados.status_resposta,
      resultado: dados.resultado?.slice(0, 500),
      erro: dados.erro?.slice(0, 500),
      ip: dados.ip,
      duracao_ms: Date.now() - dados.inicio,
    });
  } catch (err) {
    logger.warn('Não foi possível gravar webhook_logs', { erro: String(err) });
  }
}

/**
 * Webhook do Mercado Pago.
 * - Assinatura HMAC obrigatória em produção (fail-closed).
 * - O payload nunca é confiado: o pagamento é sempre reconsultado na API oficial.
 * - Só libera pedido cujo id == external_reference do pagamento e cujo valor foi coberto.
 */
export async function POST(request: NextRequest) {
  const inicio = Date.now();
  const ip = obterIpRequisicao(request.headers);
  const supabase = criarClienteAdmin();

  const limite = await limitarRequisicao(`webhook_mp:${ip}`, { janelaMs: 60_000, maxRequisicoes: 240 });
  if (!limite.permitido) {
    return NextResponse.json({ erro: 'Muitas requisições.' }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // IPN legado pode vir sem corpo JSON
  }

  const bodyData = body?.data as { id?: string | number } | undefined;
  const tipo = (typeof body?.type === 'string' ? body.type : null) || params.get('type') || params.get('topic');
  const acao = typeof body?.action === 'string' ? body.action : undefined;
  const paymentIdBruto = bodyData?.id ?? params.get('data.id') ?? params.get('id');
  const paymentId = paymentIdBruto !== null && paymentIdBruto !== undefined ? String(paymentIdBruto) : '';

  if (!paymentId || (tipo && tipo !== 'payment')) {
    return NextResponse.json({ recebido: true, mensagem: 'Notificação ignorada' }, { status: 200 });
  }

  if (!ehIdPagamentoGateway(paymentId)) {
    logger.security('Webhook com data.id em formato inválido', { ip });
    return NextResponse.json({ erro: 'Identificador inválido' }, { status: 400 });
  }

  // Assinatura: obrigatória em produção; em desenvolvimento só valida se houver secret
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const secret = obterSecretWebhook();
  const exigirAssinatura = process.env.NODE_ENV === 'production' || Boolean(secret);

  if (exigirAssinatura && !validarAssinaturaWebhook(xSignature, xRequestId, paymentId)) {
    logger.security('REJEITADO: assinatura HMAC ausente ou inválida no webhook', { ip, paymentId });
    await registrarLog(supabase, {
      tipo_evento: 'payment', data_id: paymentId, request_id: xRequestId,
      status_resposta: 401, erro: 'Assinatura HMAC inválida ou ausente', ip, inicio,
    });
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  if (!ehMercadoPagoConfigurado()) {
    return NextResponse.json({ erro: 'Gateway não configurado' }, { status: 503 });
  }

  try {
    let pagamento: PagamentoGateway;
    try {
      pagamento = (await paymentClient.get({ id: paymentId })) as unknown as PagamentoGateway;
    } catch (mpErr) {
      logger.error(`Erro ao consultar pagamento ${paymentId} no Mercado Pago`, mpErr);
      await registrarLog(supabase, { tipo_evento: 'payment', data_id: paymentId, status_resposta: 502, erro: 'Falha na API do gateway', ip, inicio });
      return NextResponse.json({ erro: 'Falha ao consultar o gateway' }, { status: 502 });
    }

    if (!pagamento?.id) {
      return NextResponse.json({ erro: 'Pagamento não localizado' }, { status: 404 });
    }

    const status = String(pagamento.status || '');
    const gatewayPaymentId = String(pagamento.id);
    const resumo = { status, status_detail: pagamento.status_detail, gateway_id: gatewayPaymentId };

    if (STATUS_GATEWAY_CANCELADOS.includes(status)) {
      const { data: resEstorno } = await supabase.rpc('processar_estorno_pagamento', {
        p_gateway_payment_id: gatewayPaymentId,
        p_novo_status: status,
      });
      // Cotas de sorteio: remove os bilhetes do pedido estornado (ou cancela o Pix pendente)
      await supabase.rpc('estornar_pagamento_sorteio', { p_gateway_payment_id: gatewayPaymentId, p_novo_status: status });
      await registrarLog(supabase, {
        tipo_evento: 'payment', acao, data_id: gatewayPaymentId, status_resposta: 200,
        resultado: `Status ${status} processado`, ip, inicio, payload: { ...resumo, resultado: resEstorno },
      });
      return NextResponse.json({ recebido: true, status }, { status: 200 });
    }

    if (status !== 'approved') {
      await registrarLog(supabase, {
        tipo_evento: 'payment', acao, data_id: gatewayPaymentId, status_resposta: 200,
        resultado: `Pagamento em estado ${status}`, ip, inicio, payload: resumo,
      });
      return NextResponse.json({ recebido: true, status }, { status: 200 });
    }

    const referencia = ehUuid(pagamento.external_reference) ? pagamento.external_reference : null;
    if (!referencia) {
      await registrarLog(supabase, {
        tipo_evento: 'payment', data_id: gatewayPaymentId, status_resposta: 200,
        erro: 'external_reference ausente ou inválida', ip, inicio, payload: resumo,
      });
      return NextResponse.json({ recebido: true, erro: 'Pedido não identificado' }, { status: 200 });
    }

    // 1. Pedido da loja?
    const { data: pedidoLoja } = await supabase
      .from('store_orders')
      .select('id, user_id, status, total_amount')
      .eq('id', referencia)
      .maybeSingle();

    if (pedidoLoja) {
      const resultado = await confirmarPedidoLoja(supabase, pedidoLoja as PedidoLojaBanco, pagamento);
      await registrarLog(supabase, {
        tipo_evento: 'payment', data_id: gatewayPaymentId, status_resposta: resultado.sucesso ? 200 : 500,
        resultado: resultado.sucesso ? 'Pedido da loja confirmado' : undefined,
        erro: resultado.sucesso ? undefined : resultado.erro, ip, inicio, payload: { order_id: referencia, tipo: 'loja' },
      });
      // Erros de negócio (estoque/valor) não devem gerar reenvio infinito do gateway
      const reprocessavel = !resultado.sucesso && resultado.erro.startsWith('falha');
      return NextResponse.json({ sucesso: resultado.sucesso, tipo: 'loja' }, { status: reprocessavel ? 500 : 200 });
    }

    // 2. Cotas de sorteio?
    const { data: pedidoSorteio } = await supabase
      .from('sorteio_pedidos')
      .select('id, valor_total, status')
      .eq('id', referencia)
      .maybeSingle();

    if (pedidoSorteio) {
      const resultado = await confirmarPedidoSorteio(supabase, pedidoSorteio as Pick<PedidoSorteio, 'id' | 'valor_total' | 'status'>, pagamento);
      const reprocessavel = !resultado.sucesso && !ERROS_CONFIRMACAO_DEFINITIVOS.includes(resultado.erro);
      await registrarLog(supabase, {
        tipo_evento: 'payment', data_id: gatewayPaymentId, status_resposta: reprocessavel ? 500 : 200,
        resultado: resultado.sucesso ? 'Bilhetes de sorteio emitidos' : undefined,
        erro: resultado.sucesso ? undefined : resultado.erro, ip, inicio, payload: { pedido_id: referencia, tipo: 'sorteio' },
      });
      return NextResponse.json({ sucesso: resultado.sucesso, tipo: 'sorteio' }, { status: reprocessavel ? 500 : 200 });
    }

    // 3. Pedido de ingressos
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, comprador_id, evento_id, lote_id, quantidade, valor_total, status')
      .eq('id', referencia)
      .maybeSingle();

    if (!pedido) {
      await registrarLog(supabase, {
        tipo_evento: 'payment', data_id: gatewayPaymentId, status_resposta: 200,
        erro: 'Pedido referenciado não existe', ip, inicio, payload: { pedido_id: referencia },
      });
      return NextResponse.json({ recebido: true, erro: 'Pedido não encontrado' }, { status: 200 });
    }

    const resultado = await liberarIngressosDoPagamento(supabase, pedido as PedidoIngresso, pagamento);
    const reprocessavel = !resultado.sucesso && !['estoque_esgotado', 'limite_gratuito', 'referencia_divergente', 'valor_insuficiente', 'pagamento_ja_utilizado', 'lote_nao_pertence_ao_evento'].includes(resultado.erro);

    await registrarLog(supabase, {
      tipo_evento: 'payment', data_id: gatewayPaymentId, status_resposta: reprocessavel ? 500 : 200,
      resultado: resultado.sucesso ? 'Ingressos liberados' : undefined,
      erro: resultado.sucesso ? undefined : resultado.erro, ip, inicio,
      payload: { pedido_id: pedido.id, ingressos_ids: resultado.sucesso ? resultado.ingressos_ids : undefined },
    });

    return NextResponse.json({ sucesso: resultado.sucesso, pedido_id: pedido.id }, { status: reprocessavel ? 500 : 200 });
  } catch (error) {
    logger.error('Erro crítico no processamento do webhook', error);
    await registrarLog(supabase, { tipo_evento: 'payment', data_id: paymentId, status_resposta: 500, erro: 'Erro interno', ip, inicio });
    return NextResponse.json({ erro: 'Erro interno ao processar webhook' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
