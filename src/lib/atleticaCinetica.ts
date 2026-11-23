import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * O sistema é exclusivo da Atlética Cinética: todo diretor/admin ativo a gerencia.
 * Esta função devolve o id dela para gravar em eventos, produtos e sorteios.
 * Mesma regra de public.atletica_padrao() no banco (migração 035).
 */
let idCache: string | null = null;

const ehCinetica = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .includes('cinetica');

export async function obterIdAtleticaCinetica(supabase: SupabaseClient): Promise<string | null> {
  if (idCache) return idCache;

  const { data, error } = await supabase
    .from('atleticas')
    .select('id, nome, status, criado_em')
    .order('criado_em', { ascending: true })
    .limit(50);

  if (error || !data?.length) return null;

  const escolhida =
    data.find((a) => ehCinetica(a.nome || '') && a.status === 'ativa') ||
    data.find((a) => ehCinetica(a.nome || '')) ||
    data.find((a) => a.status === 'ativa') ||
    data[0];

  idCache = escolhida.id;
  return idCache;
}
