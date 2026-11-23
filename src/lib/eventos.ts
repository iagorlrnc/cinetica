import type { LoteIngresso } from '@/tipos';

type LoteResumo = Pick<LoteIngresso, 'preco' | 'quantidade_total' | 'quantidade_vendida' | 'ativo'>;

export type SituacaoEvento = 'cancelado' | 'encerrado' | 'esgotado' | 'ultimos' | 'disponivel';

/** Janela após o início em que o evento ainda é considerado "acontecendo" (igual à regra de venda). */
export const JANELA_EVENTO_EM_ANDAMENTO_MS = 6 * 60 * 60 * 1000;
export const LIMITE_ULTIMOS_INGRESSOS = 20;

function lotesDisponiveis(lotes?: LoteResumo[] | null): LoteResumo[] {
  return (lotes || []).filter((l) => l.ativo && l.quantidade_vendida < l.quantidade_total);
}

/** Menor preço entre os lotes ativos com estoque; null quando nada está à venda. */
export function menorPrecoDisponivel(lotes?: LoteResumo[] | null): number | null {
  const ativos = lotesDisponiveis(lotes);
  if (ativos.length === 0) return null;
  return Math.min(...ativos.map((l) => Number(l.preco)));
}

/** Total de ingressos ainda disponíveis somando os lotes ativos. */
export function ingressosRestantes(lotes?: LoteResumo[] | null): number {
  return lotesDisponiveis(lotes).reduce((acc, l) => acc + (l.quantidade_total - l.quantidade_vendida), 0);
}

/** O evento já passou (encerrado/cancelado ou começou há mais que a janela de andamento). */
export function eventoJaPassou(
  evento: { status: string; data_evento: string },
  agora: number = Date.now()
): boolean {
  if (evento.status === 'encerrado' || evento.status === 'cancelado') return true;
  const inicio = new Date(evento.data_evento).getTime();
  if (!Number.isFinite(inicio)) return false;
  return inicio < agora - JANELA_EVENTO_EM_ANDAMENTO_MS;
}

/** Situação comercial de um evento para exibir selos e botões. */
export function situacaoEvento(
  evento: { status: string; data_evento: string; lotes_ingresso?: LoteResumo[] | null },
  agora: number = Date.now()
): SituacaoEvento {
  if (evento.status === 'cancelado') return 'cancelado';
  if (eventoJaPassou(evento, agora)) return 'encerrado';
  const restantes = ingressosRestantes(evento.lotes_ingresso);
  if (restantes <= 0) return 'esgotado';
  if (restantes <= LIMITE_ULTIMOS_INGRESSOS) return 'ultimos';
  return 'disponivel';
}

export const ROTULO_SITUACAO_EVENTO: Record<SituacaoEvento, string> = {
  cancelado: 'Cancelado',
  encerrado: 'Encerrado',
  esgotado: 'Esgotado',
  ultimos: 'Últimos ingressos',
  disponivel: 'Vendas abertas',
};

/** Dia e mês abreviado (ex.: { dia: '07', mes: 'MAR', semana: 'SÁB' }) para os selos de data. */
export function partesData(dataIso: string): { dia: string; mes: string; semana: string } {
  const d = new Date(dataIso);
  if (!Number.isFinite(d.getTime())) return { dia: '--', mes: '---', semana: '' };
  return {
    dia: d.getDate().toString().padStart(2, '0'),
    mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
    semana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
  };
}

/** Rótulo relativo amigável: "Hoje", "Amanhã", "Em 5 dias" ou null quando distante/passado. */
export function rotuloContagem(dataIso: string, agora: number = Date.now()): string | null {
  const alvo = new Date(dataIso);
  if (!Number.isFinite(alvo.getTime())) return null;
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioAlvo = new Date(alvo);
  inicioAlvo.setHours(0, 0, 0, 0);
  const dias = Math.round((inicioAlvo.getTime() - inicioHoje.getTime()) / 86_400_000);
  if (dias < 0) return null;
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  if (dias <= 14) return `Em ${dias} dias`;
  return null;
}
