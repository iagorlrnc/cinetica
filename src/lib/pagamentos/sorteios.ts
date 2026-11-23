/**
 * Compra de cotas de sorteio via Pix (Mercado Pago).
 * Regras de negócio no banco (migração 036); aqui ficam validação de entrada,
 * conferência do pagamento e tradução de erros — cobertas por testes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ehUuid } from '@/lib/validacoes';
import { pagamentoCorrespondeAoPedido, type PagamentoGateway } from '@/lib/pagamentos/comum';

export const MAX_COTAS_POR_COMPRA = 100;

export type StatusPedidoSorteio = 'pendente' | 'pago' | 'expirado' | 'cancelado' | 'estornado' | 'pago_sem_cota';

export interface PedidoSorteio {
  id: string;
  sorteio_id: string;
  usuario_id: string;
  quantidade: number;
  valor_total: number | string;
  status: StatusPedidoSorteio;
  gateway_payment_id: string | null;
  expira_em: string;
}

/** Valida o corpo da requisição de compra. Valor nunca vem do cliente. */
export function validarEntradaCompraSorteio(
  body: unknown
): { ok: true; sorteioId: string; quantidade: number } | { ok: false; erro: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!ehUuid(b.sorteio_id)) return { ok: false, erro: 'Sorteio inválido.' };
  const quantidade = Number(b.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_COTAS_POR_COMPRA) {
    return { ok: false, erro: `Escolha entre 1 e ${MAX_COTAS_POR_COMPRA} cotas.` };
  }
  return { ok: true, sorteioId: b.sorteio_id as string, quantidade };
}

const ERROS_RESERVA: Record<string, string> = {
  quantidade_invalida: `Escolha entre 1 e ${MAX_COTAS_POR_COMPRA} cotas.`,
  sorteio_nao_encontrado: 'Sorteio não encontrado.',
  sorteio_fechado: 'Este sorteio não está mais vendendo cotas.',
  sorteio_gratuito: 'Este sorteio é gratuito: use o botão Resgatar.',
  sorteio_pago: 'Este sorteio é pago: gere o Pix para participar.',
  ja_resgatou: 'Você já resgatou sua cota neste sorteio. O limite é 1 por pessoa.',
  muitos_pendentes: 'Você já tem Pix aguardando pagamento. Pague ou espere expirar antes de gerar outro.',
  cotas_insuficientes: 'Não há cotas suficientes disponíveis.',
  sem_permissao: 'Operação não permitida.',
};

/** A função do banco não existe (migração 036 não aplicada ou desatualizada). */
export function ehFuncaoAusente(erro: { code?: string | null } | null | undefined): boolean {
  return erro?.code === 'PGRST202' || erro?.code === '42883';
}

export const MENSAGEM_SORTEIO_INDISPONIVEL =
  'A compra de cotas ainda não está ativa no sistema. Avise a diretoria (falta aplicar a migração 036 no banco).';

export function traduzirErroReserva(codigo: string | null | undefined, restantes?: number): string {
  if (codigo === 'cotas_insuficientes' && typeof restantes === 'number') {
    return restantes > 0 ? `Só restam ${restantes} cota(s) disponível(is).` : 'As cotas esgotaram.';
  }
  return (codigo && ERROS_RESERVA[codigo]) || 'Não foi possível reservar as cotas. Tente novamente.';
}

/** Erros de negócio que não adiantam o gateway reenviar (evita loop de webhook). */
export const ERROS_CONFIRMACAO_DEFINITIVOS = [
  'referencia_divergente',
  'valor_insuficiente',
  'pagamento_divergente',
  'pagamento_ja_utilizado',
  'pedido_cancelado',
  'pedido_estornado',
  'pedido_pago_sem_cota',
  'sem_cotas_para_pagamento_tardio',
];

/**
 * Confirma um pagamento aprovado do Mercado Pago para um pedido de cotas.
 * Confere referência e valor no servidor e no banco (dupla checagem).
 */
export async function confirmarPedidoSorteio(
  supabase: SupabaseClient,
  pedido: Pick<PedidoSorteio, 'id' | 'valor_total' | 'status'>,
  pagamento: PagamentoGateway
): Promise<{ sucesso: true; numeros?: number[] } | { sucesso: false; erro: string }> {
  if (pedido.status === 'pago') return { sucesso: true };
  if (String(pagamento.status) !== 'approved') return { sucesso: false, erro: 'pagamento_nao_aprovado' };

  const confere = pagamentoCorrespondeAoPedido(pagamento, pedido.id, Number(pedido.valor_total));
  if (!confere.ok) return { sucesso: false, erro: confere.motivo };

  const { data, error } = await supabase.rpc('confirmar_pagamento_sorteio', {
    p_pedido_id: pedido.id,
    p_gateway_payment_id: String(pagamento.id),
    p_valor_pago: Number(pagamento.transaction_amount),
  });
  if (error) return { sucesso: false, erro: 'falha_banco' };

  const r = data as { sucesso?: boolean; erro?: string; numeros?: number[] } | null;
  if (!r?.sucesso) return { sucesso: false, erro: r?.erro || 'falha_banco' };
  return { sucesso: true, numeros: r.numeros };
}
