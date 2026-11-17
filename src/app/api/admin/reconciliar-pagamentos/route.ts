import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi, ehAdminAtivo } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { ehIdPagamentoGateway, ehUuid } from '@/lib/seguranca';
import type { PagamentoGateway } from '@/lib/pagamentos/comum';
import { liberarIngressosDoPagamento, type PedidoIngresso } from '@/lib/pagamentos/ingressos';
import { confirmarPedidoLoja, type PedidoLojaBanco } from '@/lib/pagamentos/loja';

interface Detalhe {
  id: string;
  status?: string;
  reconciliado: boolean;
  motivo?: string;
  pedido_id?: string;
}

/**
 * Reconciliação administrativa: confere pagamentos aprovados no gateway e libera
 * pedidos locais pendentes. Nunca cria pedidos a partir de metadados do pagamento.
 */
export async function POST(request: NextRequest) {
  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) {
      return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
    }
    if (!ehAdminAtivo(sessao.perfil)) {
      logger.security('Tentativa não autorizada de reconciliação administrativa', { userId: sessao.user.id });
      return NextResponse.json({ erro: 'Acesso restrito a administradores' }, { status: 403 });
    }
    if (!ehMercadoPagoConfigurado()) {
      return NextResponse.json({ erro: 'Mercado Pago não está configurado' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const idsEspecificos: string[] = Array.isArray(body?.ids_pagamento)
      ? body.ids_pagamento.map(String).filter(ehIdPagamentoGateway).slice(0, 50)
      : [];

    let pagamentos: PagamentoGateway[] = [];
    if (idsEspecificos.length > 0) {
      for (const id of idsEspecificos) {
        try {
          const p = await paymentClient.get({ id });
          if (p) pagamentos.push(p as unknown as PagamentoGateway);
        } catch {
          // ignora id inexistente
        }
      }
    } else {
      const busca = await paymentClient.search({ options: { sort: 'date_created', criteria: 'desc', limit: 50 } });
      pagamentos = (busca.results || []) as unknown as PagamentoGateway[];
    }

    const supabase = criarClienteAdmin();
    const relatorio = { verificados: 0, recuperados: 0, ja_existentes: 0, erros: 0, detalhes: [] as Detalhe[] };

    for (const pagamento of pagamentos) {
      relatorio.verificados++;
      const id = String(pagamento.id);

      if (pagamento.status !== 'approved') {
        relatorio.detalhes.push({ id, status: String(pagamento.status), reconciliado: false, motivo: 'Pagamento não aprovado' });
        continue;
      }
      const ref = ehUuid(pagamento.external_reference) ? pagamento.external_reference : null;
      if (!ref) {
        relatorio.detalhes.push({ id, reconciliado: false, motivo: 'Sem external_reference válida' });
        continue;
      }

      const { data: pedidoLoja } = await supabase
        .from('store_orders').select('id, user_id, status, total_amount').eq('id', ref).maybeSingle();
      if (pedidoLoja) {
        if (pedidoLoja.status === 'paid') {
          relatorio.ja_existentes++;
          continue;
        }
        const r = await confirmarPedidoLoja(supabase, pedidoLoja as PedidoLojaBanco, pagamento);
        if (r.sucesso) relatorio.recuperados++; else relatorio.erros++;
        relatorio.detalhes.push({ id, pedido_id: ref, reconciliado: r.sucesso, motivo: r.sucesso ? 'Pedido da loja confirmado' : r.erro });
        continue;
      }

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, comprador_id, evento_id, lote_id, quantidade, valor_total, status')
        .eq('id', ref)
        .maybeSingle();
      if (!pedido) {
        relatorio.detalhes.push({ id, reconciliado: false, motivo: 'Pedido local não encontrado' });
        continue;
      }
      if (pedido.status === 'aprovado') {
        relatorio.ja_existentes++;
        continue;
      }

      const r = await liberarIngressosDoPagamento(supabase, pedido as PedidoIngresso, pagamento);
      if (r.sucesso) relatorio.recuperados++; else relatorio.erros++;
      relatorio.detalhes.push({ id, pedido_id: pedido.id, reconciliado: r.sucesso, motivo: r.sucesso ? 'Ingressos liberados' : r.erro });
    }

    logger.info('Reconciliação administrativa concluída', { verificados: relatorio.verificados, recuperados: relatorio.recuperados, admin: sessao.user.id });
    return NextResponse.json({ sucesso: true, relatorio });
  } catch (error) {
    logger.error('Erro na reconciliação administrativa', error);
    return NextResponse.json({ erro: 'Erro interno durante a reconciliação' }, { status: 500 });
  }
}
