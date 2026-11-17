import type { Sorteio, StatusSorteio } from '@/tipos';

export const STATUS_SORTEIO_ROTULO: Record<StatusSorteio, string> = {
  rascunho: 'Rascunho',
  em_breve: 'Em breve',
  ativo: 'Vendas abertas',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

/** Status exibidos na vitrine pública (o RLS do banco aplica a mesma regra). */
export const STATUS_SORTEIO_PUBLICOS: StatusSorteio[] = ['em_breve', 'ativo', 'encerrado'];

export function calcularProgressoCotas(vendidas: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const p = Math.round((Math.max(0, vendidas) / total) * 100);
  return Math.min(100, Math.max(0, p));
}

export function cotasRestantes(s: Pick<Sorteio, 'total_cotas' | 'cotas_vendidas'>): number {
  return Math.max(0, s.total_cotas - s.cotas_vendidas);
}

/** Um sorteio só aceita participação quando ativo, com cotas e antes da data de apuração. */
export function sorteioAceitaParticipacao(
  s: Pick<Sorteio, 'status' | 'total_cotas' | 'cotas_vendidas' | 'data_sorteio'>,
  agora: Date = new Date()
): boolean {
  return s.status === 'ativo' && cotasRestantes(s) > 0 && new Date(s.data_sorteio).getTime() > agora.getTime();
}

/**
 * Gera link wa.me a partir do WhatsApp cadastrado na atlética.
 * Retorna null quando o número é inválido (o botão não é exibido).
 */
export function montarLinkWhatsapp(numero: string | null | undefined, mensagem: string): string | null {
  const digitos = (numero || '').replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 13) return null;
  const completo = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${completo}?text=${encodeURIComponent(mensagem.slice(0, 500))}`;
}

/** Ordena: destaque → ativos → em breve → encerrados; dentro do grupo por data. */
export function ordenarSorteios<T extends Pick<Sorteio, 'status' | 'destaque' | 'data_sorteio'>>(lista: T[]): T[] {
  const peso: Record<string, number> = { ativo: 0, em_breve: 1, encerrado: 2, cancelado: 3, rascunho: 4 };
  return [...lista].sort((a, b) => {
    const pa = peso[a.status] ?? 9;
    const pb = peso[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
    const da = new Date(a.data_sorteio).getTime();
    const db = new Date(b.data_sorteio).getTime();
    return a.status === 'encerrado' ? db - da : da - db;
  });
}

export interface FormularioSorteio {
  titulo: string;
  subtitulo: string;
  descricao: string;
  premio_principal: string;
  premios_secundarios: string;
  valor_cota: string;
  total_cotas: string;
  cotas_vendidas: string;
  data_sorteio: string;
  status: StatusSorteio;
  destaque: boolean;
  imagem_url: string;
  regulamento: string;
  forma_apuracao: string;
  ganhador_nome: string;
  ganhador_bilhete: string;
  ganhador_cidade: string;
}

export type DadosSorteioBanco = Omit<
  Sorteio,
  'id' | 'atletica_id' | 'criado_em' | 'atualizado_em' | 'atletica' | 'apurado_em'
> & { apurado_em: string | null };

const STATUS_VALIDOS: StatusSorteio[] = ['rascunho', 'em_breve', 'ativo', 'encerrado', 'cancelado'];

const textoOuNulo = (v: string, max: number) => {
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/**
 * Valida o formulário da diretoria e devolve o payload pronto para o banco.
 * As mesmas regras existem como CHECK constraints na tabela `sorteios`.
 */
export function validarFormularioSorteio(
  f: FormularioSorteio
): { ok: true; dados: DadosSorteioBanco } | { ok: false; erros: Record<string, string> } {
  const erros: Record<string, string> = {};

  const titulo = f.titulo.trim();
  if (titulo.length < 3 || titulo.length > 140) erros.titulo = 'Informe um título entre 3 e 140 caracteres.';

  const premio = f.premio_principal.trim();
  if (premio.length < 2 || premio.length > 300) erros.premio_principal = 'Descreva o prêmio principal.';

  const valor = Number(String(f.valor_cota).replace(',', '.'));
  if (!Number.isFinite(valor) || valor < 0 || valor > 100000) erros.valor_cota = 'Valor da cota inválido.';

  const total = parseInt(f.total_cotas, 10);
  if (isNaN(total) || total < 1 || total > 1_000_000) erros.total_cotas = 'Total de cotas deve ser entre 1 e 1.000.000.';

  const vendidas = f.cotas_vendidas.trim() === '' ? 0 : parseInt(f.cotas_vendidas, 10);
  if (isNaN(vendidas) || vendidas < 0) erros.cotas_vendidas = 'Cotas vendidas inválidas.';
  else if (!isNaN(total) && vendidas > total) erros.cotas_vendidas = 'Cotas vendidas não podem exceder o total.';

  const data = new Date(f.data_sorteio);
  if (!f.data_sorteio || isNaN(data.getTime())) erros.data_sorteio = 'Informe a data da apuração.';

  if (!STATUS_VALIDOS.includes(f.status)) erros.status = 'Status inválido.';

  const imagem = f.imagem_url.trim();
  if (imagem && !/^https:\/\/[^\s]+$/i.test(imagem) && !imagem.startsWith('/')) {
    erros.imagem_url = 'A imagem deve ser uma URL https.';
  }

  if (f.status === 'encerrado' && !f.ganhador_nome.trim()) {
    erros.ganhador_nome = 'Informe o ganhador para encerrar o sorteio.';
  }

  if (f.descricao.length > 4000) erros.descricao = 'Descrição muito longa (máx. 4000).';
  if (f.regulamento.length > 10000) erros.regulamento = 'Regulamento muito longo (máx. 10000).';

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const premiosSecundarios = f.premios_secundarios
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((p) => p.slice(0, 300));

  return {
    ok: true,
    dados: {
      titulo,
      subtitulo: textoOuNulo(f.subtitulo, 200),
      descricao: f.descricao.trim(),
      premio_principal: premio,
      premios_secundarios: premiosSecundarios,
      valor_cota: Math.round(valor * 100) / 100,
      total_cotas: total,
      cotas_vendidas: vendidas,
      data_sorteio: data.toISOString(),
      status: f.status,
      destaque: Boolean(f.destaque),
      imagem_url: textoOuNulo(imagem, 1000),
      regulamento: textoOuNulo(f.regulamento, 10000),
      forma_apuracao: textoOuNulo(f.forma_apuracao, 300),
      ganhador_nome: textoOuNulo(f.ganhador_nome, 120),
      ganhador_bilhete: textoOuNulo(f.ganhador_bilhete, 40),
      ganhador_cidade: textoOuNulo(f.ganhador_cidade, 120),
      apurado_em: f.status === 'encerrado' ? new Date().toISOString() : null,
    },
  };
}
