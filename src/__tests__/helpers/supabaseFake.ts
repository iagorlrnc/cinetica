/**
 * Fake mínimo e em memória do cliente Supabase (PostgREST) para testes de unidade.
 * Suporta: select, eq, neq, in, is, lt, gt, order, limit, range, maybeSingle, single,
 * insert, update, delete, upsert e rpc. Filtros por relacionamento ("tabela.coluna")
 * são ignorados — use `respostasFixas` para esses casos.
 */
type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;

export interface ChamadaRpc {
  nome: string;
  args: Record<string, unknown>;
}

export interface ConfigFake {
  tabelas?: Record<string, Linha[]>;
  rpc?: Record<string, (args: Record<string, unknown>) => { data: unknown; error: unknown }>;
  /** Força a resposta de um SELECT em uma tabela (ignora filtros). */
  respostasFixas?: Record<string, { data: unknown; error?: unknown }>;
}

export function criarSupabaseFake(config: ConfigFake = {}) {
  const tabelas: Record<string, Linha[]> = {};
  for (const [nome, linhas] of Object.entries(config.tabelas || {})) {
    tabelas[nome] = linhas.map((l) => ({ ...l }));
  }
  const chamadasRpc: ChamadaRpc[] = [];
  const escritas: { tabela: string; tipo: string; dados: unknown }[] = [];

  function construtor(tabela: string) {
    const filtros: Filtro[] = [];
    let operacao: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Linha | Linha[] | null = null;
    let limite: number | null = null;
    let modo: 'lista' | 'single' | 'maybeSingle' = 'lista';

    const linhasDaTabela = () => (tabelas[tabela] ||= []);

    function executar(): { data: unknown; error: unknown; count?: number } {
      if (operacao === 'select' && config.respostasFixas?.[tabela]) {
        const r = config.respostasFixas[tabela];
        return { data: r.data, error: r.error ?? null };
      }

      if (operacao === 'insert') {
        const novos = (Array.isArray(payload) ? payload : [payload!]).map((l) => ({ ...l }));
        linhasDaTabela().push(...novos);
        escritas.push({ tabela, tipo: 'insert', dados: novos });
        return { data: modo === 'lista' ? novos : novos[0], error: null };
      }

      const alvo = linhasDaTabela().filter((l) => filtros.every((f) => f(l)));

      if (operacao === 'update') {
        alvo.forEach((l) => Object.assign(l, payload));
        escritas.push({ tabela, tipo: 'update', dados: payload });
        return { data: modo === 'lista' ? alvo : alvo[0] ?? null, error: null };
      }
      if (operacao === 'delete') {
        tabelas[tabela] = linhasDaTabela().filter((l) => !alvo.includes(l));
        escritas.push({ tabela, tipo: 'delete', dados: alvo });
        return { data: alvo, error: null };
      }

      const resultado = limite !== null ? alvo.slice(0, limite) : alvo;
      if (modo === 'single') {
        return resultado.length === 1 ? { data: resultado[0], error: null } : { data: null, error: { message: 'not single' } };
      }
      if (modo === 'maybeSingle') return { data: resultado[0] ?? null, error: null };
      return { data: resultado, error: null, count: alvo.length };
    }

    const ehRelacao = (col: string) => col.includes('.');

    const b = {
      select: () => b,
      insert: (d: Linha | Linha[]) => { operacao = 'insert'; payload = d; return b; },
      upsert: (d: Linha | Linha[]) => { operacao = 'insert'; payload = d; return b; },
      update: (d: Linha) => { operacao = 'update'; payload = d; return b; },
      delete: () => { operacao = 'delete'; return b; },
      eq: (c: string, v: unknown) => { if (!ehRelacao(c)) filtros.push((l) => l[c] === v); return b; },
      neq: (c: string, v: unknown) => { if (!ehRelacao(c)) filtros.push((l) => l[c] !== v); return b; },
      is: (c: string, v: unknown) => { filtros.push((l) => (l[c] ?? null) === v); return b; },
      in: (c: string, v: unknown[]) => { if (!ehRelacao(c)) filtros.push((l) => v.includes(l[c])); return b; },
      lt: (c: string, v: unknown) => { filtros.push((l) => String(l[c]) < String(v)); return b; },
      gt: (c: string, v: unknown) => { filtros.push((l) => String(l[c]) > String(v)); return b; },
      or: () => b,
      order: () => b,
      range: () => b,
      limit: (n: number) => { limite = n; return b; },
      single: () => { modo = 'single'; return b; },
      maybeSingle: () => { modo = 'maybeSingle'; return b; },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        try {
          resolve(executar());
        } catch (e) {
          reject?.(e);
        }
      },
    };
    return b;
  }

  const cliente = {
    from: (tabela: string) => construtor(tabela),
    rpc: async (nome: string, args: Record<string, unknown>) => {
      chamadasRpc.push({ nome, args });
      const fn = config.rpc?.[nome];
      return fn ? fn(args) : { data: null, error: { message: `rpc ${nome} não configurada` } };
    },
  };

  return { cliente: cliente as never, tabelas, chamadasRpc, escritas };
}
