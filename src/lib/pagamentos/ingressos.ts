import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { TAXA_SERVICO_PERCENTUAL } from '@/lib/constantes';
import { gerarHashIngresso } from '@/lib/gerarQrCode';
import { enviarNotificacaoIngressoLiberado } from '@/lib/notificacoes';
import { logger } from '@/lib/logger';
import { ehUuid } from '@/lib/seguranca';
import { pagamentoCorrespondeAoPedido, type PagamentoGateway } from './comum';

/** Janela após o início do evento em que ainda é possível comprar (venda na porta). */
export const JANELA_VENDA_APOS_INICIO_MS = 6 * 60 * 60 * 1000;
export const QUANTIDADE_MAXIMA_POR_PEDIDO = 10;

export interface ValoresPedido {
  valorUnitario: number;
  taxaServicoTotal: number;
  totalFinal: number;
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Calcula valores do pedido SEMPRE a partir do preço do banco. */
export function calcularValoresPedido(precoUnitario: number, quantidade: number): ValoresPedido {
  const preco = arred(Number(precoUnitario));
  const taxaUnit = preco === 0 ? 0 : arred(preco * TAXA_SERVICO_PERCENTUAL);
  const taxaServicoTotal = arred(taxaUnit * quantidade);
  return {
    valorUnitario: preco,
    taxaServicoTotal,
    totalFinal: arred(preco * quantidade + taxaServicoTotal),
  };
}

export function gerarHashesPedido(eventoId: string, gatewayPaymentId: string, quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => gerarHashIngresso(`${eventoId}-${gatewayPaymentId}-${i}`, eventoId));
}

export interface LoteValidado {
  id: string;
  evento_id: string;
  nome_lote: string;
  preco: number;
  quantidade_total: number;
  quantidade_vendida: number;
}

export interface EventoValidado {
  id: string;
  titulo: string;
  atletica_id: string;
  data_evento: string;
}

export type ResultadoValidacaoCompra =
  | { ok: true; evento: EventoValidado; lote: LoteValidado; quantidade: number }
  | { ok: false; status: number; erro: string };

/**
 * Valida se a compra é possível:
 * - lote pertence AO evento informado (impede usar lote barato/gratuito de outro evento)
 * - evento publicado, não apagado e ainda dentro da janela de vendas
 * - lote ativo e com estoque
 */
export async function validarCompraIngresso(
  supabase: SupabaseClient,
  entrada: { eventoId: unknown; loteId: unknown; quantidade: unknown },
  agora: Date = new Date()
): Promise<ResultadoValidacaoCompra> {
  if (!ehUuid(entrada.eventoId) || !ehUuid(entrada.loteId)) {
    return { ok: false, status: 400, erro: 'Identificadores inválidos fornecidos.' };
  }

  const quantidade = parseInt(String(entrada.quantidade), 10);
  if (isNaN(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA_POR_PEDIDO) {
    return { ok: false, status: 400, erro: `Quantidade de ingressos inválida (permitido de 1 a ${QUANTIDADE_MAXIMA_POR_PEDIDO}).` };
  }

  const { data: evento } = await supabase
    .from('eventos')
    .select('id, titulo, atletica_id, data_evento, status, apagado_pelo_diretor')
    .eq('id', entrada.eventoId)
    .maybeSingle();

  if (!evento || evento.apagado_pelo_diretor) {
    return { ok: false, status: 404, erro: 'Evento não encontrado.' };
  }
  if (evento.status !== 'publicado') {
    return { ok: false, status: 400, erro: 'As vendas deste evento não estão abertas.' };
  }
  if (new Date(evento.data_evento).getTime() + JANELA_VENDA_APOS_INICIO_MS < agora.getTime()) {
    return { ok: false, status: 400, erro: 'Este evento já foi encerrado.' };
  }

  const { data: lote } = await supabase
    .from('lotes_ingresso')
    .select('id, evento_id, nome_lote, preco, quantidade_total, quantidade_vendida, ativo')
    .eq('id', entrada.loteId)
    .eq('evento_id', entrada.eventoId)
    .maybeSingle();

  if (!lote || !lote.ativo) {
    return { ok: false, status: 400, erro: 'Lote de ingressos indisponível ou esgotado.' };
  }

  if (lote.quantidade_total - lote.quantidade_vendida < quantidade) {
    return { ok: false, status: 400, erro: 'Ingressos insuficientes para este lote.' };
  }

  return {
    ok: true,
    quantidade,
    evento: { id: evento.id, titulo: evento.titulo, atletica_id: evento.atletica_id, data_evento: evento.data_evento },
    lote: {
      id: lote.id,
      evento_id: lote.evento_id,
      nome_lote: lote.nome_lote,
      preco: Number(lote.preco),
      quantidade_total: lote.quantidade_total,
      quantidade_vendida: lote.quantidade_vendida,
    },
  };
}

/**
 * Cria um pedido pendente. O ID sugerido pelo cliente só é reaproveitado quando
 * pertence ao mesmo usuário, à mesma compra e ainda está pendente — nunca sobrescreve
 * pedidos de terceiros (antes era um upsert cego por ID).
 */
export async function criarOuReutilizarPedidoPendente(
  supabase: SupabaseClient,
  dados: {
    idSugerido?: unknown;
    compradorId: string;
    eventoId: string;
    loteId: string;
    quantidade: number;
    valores: ValoresPedido;
    metodo: string;
    expiraEm?: Date;
  }
): Promise<{ ok: true; pedidoId: string } | { ok: false; erro: string }> {
  if (ehUuid(dados.idSugerido)) {
    const { data: existente } = await supabase
      .from('pedidos')
      .select('id, comprador_id, evento_id, lote_id, quantidade, status, valor_total')
      .eq('id', dados.idSugerido)
      .maybeSingle();

    if (
      existente &&
      existente.comprador_id === dados.compradorId &&
      existente.evento_id === dados.eventoId &&
      existente.lote_id === dados.loteId &&
      existente.quantidade === dados.quantidade &&
      existente.status === 'pendente'
    ) {
      await supabase
        .from('pedidos')
        .update({
          valor_unitario: dados.valores.valorUnitario,
          taxa_servico: dados.valores.taxaServicoTotal,
          valor_total: dados.valores.totalFinal,
          metodo_pagamento: dados.metodo,
          expira_em: dados.expiraEm?.toISOString() ?? null,
        })
        .eq('id', existente.id)
        .eq('status', 'pendente');
      return { ok: true, pedidoId: existente.id };
    }
  }

  const pedidoId = crypto.randomUUID();
  const { error } = await supabase.from('pedidos').insert({
    id: pedidoId,
    comprador_id: dados.compradorId,
    evento_id: dados.eventoId,
    lote_id: dados.loteId,
    quantidade: dados.quantidade,
    valor_unitario: dados.valores.valorUnitario,
    taxa_servico: dados.valores.taxaServicoTotal,
    valor_total: dados.valores.totalFinal,
    status: 'pendente',
    metodo_pagamento: dados.metodo,
    external_reference: pedidoId,
    expira_em: dados.expiraEm?.toISOString() ?? null,
  });

  if (error) {
    logger.error('Falha ao registrar pedido pendente', error, { comprador_id: dados.compradorId });
    return { ok: false, erro: 'Não foi possível registrar o pedido. Tente novamente.' };
  }
  return { ok: true, pedidoId };
}

export interface PedidoIngresso {
  id: string;
  comprador_id: string;
  evento_id: string;
  lote_id: string;
  quantidade: number;
  valor_total: number | string;
  status: string;
}

export type ResultadoLiberacao =
  | { sucesso: true; ja_processado: boolean; ingressos_ids?: string[] }
  | { sucesso: false; erro: string };

/**
 * Libera os ingressos de um pedido a partir de um pagamento APROVADO no gateway.
 * Única porta de emissão: valida vínculo pedido↔pagamento e valor antes de chamar a RPC atômica.
 */
export async function liberarIngressosDoPagamento(
  supabase: SupabaseClient,
  pedido: PedidoIngresso,
  pagamento: PagamentoGateway,
  opcoes: { notificar?: boolean; emailComprador?: string | null } = {}
): Promise<ResultadoLiberacao> {
  if (pagamento.status !== 'approved' || !pagamento.id) {
    return { sucesso: false, erro: 'pagamento_nao_aprovado' };
  }

  const verificacao = pagamentoCorrespondeAoPedido(pagamento, pedido.id, Number(pedido.valor_total));
  if (!verificacao.ok) {
    logger.security('Pagamento não corresponde ao pedido — liberação bloqueada', {
      pedido_id: pedido.id,
      gateway_transaction_id: String(pagamento.id),
      motivo: verificacao.motivo,
    });
    return { sucesso: false, erro: verificacao.motivo };
  }

  const gatewayPaymentId = String(pagamento.id);
  const metodo = String(pagamento.payment_method_id || pagamento.payment_type_id || 'mercadopago');

  const { data, error } = await supabase.rpc('processar_pagamento_aprovado', {
    p_pedido_id: pedido.id,
    p_gateway_payment_id: gatewayPaymentId,
    p_metodo_pagamento: metodo,
    p_qr_hashes: gerarHashesPedido(pedido.evento_id, gatewayPaymentId, pedido.quantidade),
  });

  if (error || !data?.sucesso) {
    const erro = data?.erro || error?.message || 'falha_rpc';
    logger.error('RPC processar_pagamento_aprovado não concluiu', null, { pedido_id: pedido.id, erro });
    return { sucesso: false, erro };
  }

  if (opcoes.notificar !== false && !data.ja_processado) {
    void enviarNotificacaoIngressoLiberado({
      comprador_id: pedido.comprador_id,
      quantidade: pedido.quantidade,
      gateway_transaction_id: gatewayPaymentId,
      email_comprador: opcoes.emailComprador || pagamento.payer?.email || undefined,
    });
  }

  return { sucesso: true, ja_processado: Boolean(data.ja_processado), ingressos_ids: data.ingressos_ids };
}

/** Mensagem amigável para os erros retornados pela RPC. */
export function traduzirErroLiberacao(erro: string): { status: string; mensagem: string } {
  switch (erro) {
    case 'estoque_esgotado':
      return { status: 'estoque_esgotado', mensagem: 'O lote esgotou durante o processamento. O valor será estornado.' };
    case 'limite_gratuito':
      return { status: 'cancelado', mensagem: 'Você já possui um ingresso gratuito para este evento.' };
    case 'referencia_divergente':
    case 'valor_insuficiente':
    case 'pagamento_ja_utilizado':
      return { status: 'cancelado', mensagem: 'O pagamento informado não corresponde a este pedido.' };
    default:
      return { status: 'aguardando', mensagem: 'Estamos confirmando seu pagamento. Aguarde alguns instantes.' };
  }
}
