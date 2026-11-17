import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { TEMPO_EXPIRACAO_PIX_MINUTOS } from '@/lib/constantes';
import { ehIdPagamentoGateway, obterIpRequisicao, validarBearer } from '@/lib/seguranca';
import { STATUS_GATEWAY_CANCELADOS, type PagamentoGateway } from '@/lib/pagamentos/comum';
import { liberarIngressosDoPagamento, type PedidoIngresso } from '@/lib/pagamentos/ingressos';

/**
 * Cron de reconciliação: pedidos pendentes há mais de 2 minutos são conferidos na
 * API do Mercado Pago. Emissão sempre pela mesma porta validada do webhook.
 * Protegido por `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET não configurado', null);
    return NextResponse.json({ erro: 'Configuração de cron ausente' }, { status: 500 });
  }
  if (!validarBearer(request.headers.get('authorization'), cronSecret)) {
    logger.security('Acesso não autorizado ao cron de reconciliação', { ip: obterIpRequisicao(request.headers) });
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  if (!ehMercadoPagoConfigurado()) {
    return NextResponse.json({ erro: 'Gateway Mercado Pago não configurado' }, { status: 503 });
  }

  const supabase = criarClienteAdmin();
  const relatorio = { verificados: 0, recuperados: 0, inalterados: 0, cancelados: 0, erros: 0, detalhes: [] as Record<string, unknown>[] };

  try {
    const limiteMinimo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const limiteMaximo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendentes, error } = await supabase
      .from('pedidos')
      .select('id, comprador_id, evento_id, lote_id, quantidade, valor_total, status, gateway_payment_id, criado_em')
      .eq('status', 'pendente')
      .lt('criado_em', limiteMinimo)
      .gt('criado_em', limiteMaximo)
      .order('criado_em', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Erro ao buscar pedidos pendentes', error);
      return NextResponse.json({ erro: 'Erro ao consultar banco de dados' }, { status: 500 });
    }

    for (const pedido of pendentes || []) {
      relatorio.verificados++;
      try {
        let pagamentos: PagamentoGateway[] = [];
        if (ehIdPagamentoGateway(pedido.gateway_payment_id)) {
          try {
            const direto = await paymentClient.get({ id: String(pedido.gateway_payment_id) });
            if (direto) pagamentos = [direto as unknown as PagamentoGateway];
          } catch {
            // segue para busca
          }
        }
        if (!pagamentos.some((p) => p.status === 'approved')) {
          const busca = await paymentClient.search({
            options: { external_reference: pedido.id, sort: 'date_created', criteria: 'desc', limit: 5 },
          });
          pagamentos = [...pagamentos, ...((busca.results || []) as unknown as PagamentoGateway[])];
        }

        const aprovado = pagamentos.find((p) => p.status === 'approved');
        if (aprovado) {
          const res = await liberarIngressosDoPagamento(supabase, pedido as PedidoIngresso, aprovado);
          if (res.sucesso) {
            relatorio.recuperados++;
            relatorio.detalhes.push({ pedido_id: pedido.id, status: 'recuperado' });
          } else {
            relatorio.erros++;
            relatorio.detalhes.push({ pedido_id: pedido.id, erro: res.erro });
          }
          continue;
        }

        const expirou = new Date(pedido.criado_em).getTime() < Date.now() - TEMPO_EXPIRACAO_PIX_MINUTOS * 60 * 1000;
        const cancelado = pagamentos.length > 0 && pagamentos.every((p) => STATUS_GATEWAY_CANCELADOS.includes(String(p.status)));
        if (cancelado || (pagamentos.length === 0 && expirou)) {
          await supabase.from('pedidos').update({ status: 'recusado' }).eq('id', pedido.id).eq('status', 'pendente');
          relatorio.cancelados++;
          relatorio.detalhes.push({ pedido_id: pedido.id, acao: cancelado ? 'recusado_no_gateway' : 'expirado_sem_pagamento' });
        } else {
          relatorio.inalterados++;
        }
      } catch (errPedido) {
        relatorio.erros++;
        relatorio.detalhes.push({ pedido_id: pedido.id, erro: String(errPedido).slice(0, 200) });
      }
    }

    logger.info('Cron de reconciliação finalizado', { verificados: relatorio.verificados, recuperados: relatorio.recuperados });
    return NextResponse.json({ sucesso: true, executado_em: new Date().toISOString(), relatorio });
  } catch (error) {
    logger.error('Erro crítico no cron de reconciliação', error);
    return NextResponse.json({ erro: 'Erro interno durante reconciliação' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
