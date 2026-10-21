import type { SupabaseClient } from '@supabase/supabase-js';

export const DADOS_ATLETICA_CINETICA = {
  nome: 'Atlética Cinética',
  faculdade: 'A.A.A.F.A. Fisioterapia',
  cidade: 'Palmas - TO',
  descricao: 'Associação Atlética Acadêmica de Fisioterapia Araguaia (A.A.A.F.A.) — Atlética Cinética.',
  logo_url: '/cinetica-logo.png',
  cor_primaria: '#c59941',
  cor_secundaria: '#0e1422',
  status: 'ativa' as const,
};

let idCineticaCache: string | null = null;

/**
 * Retorna o ID da Atlética Cinética.
 * Como o sistema agora é exclusivo para a Atlética Cinética,
 * diretores e admins gerenciam diretamente esta única atlética.
 */
export async function obterIdAtleticaCinetica(supabase: SupabaseClient): Promise<string | null> {
  if (idCineticaCache) {
    return idCineticaCache;
  }

  try {
    // 1. Tentar buscar por nome 'Cinética'
    const { data: atleticaCin } = await supabase
      .from('atleticas')
      .select('id, nome')
      .ilike('nome', '%cinética%')
      .limit(1)
      .maybeSingle();

    if (atleticaCin?.id) {
      idCineticaCache = atleticaCin.id;
      return atleticaCin.id;
    }

    // 2. Tentar buscar sem acento 'Cinetica'
    const { data: atleticaCinSemAcento } = await supabase
      .from('atleticas')
      .select('id, nome')
      .ilike('nome', '%cinetica%')
      .limit(1)
      .maybeSingle();

    if (atleticaCinSemAcento?.id) {
      idCineticaCache = atleticaCinSemAcento.id;
      return atleticaCinSemAcento.id;
    }

    // 3. Fallback: primeira atlética ativa
    const { data: primeira } = await supabase
      .from('atleticas')
      .select('id, nome')
      .limit(1)
      .maybeSingle();

    if (primeira?.id) {
      idCineticaCache = primeira.id;
      return primeira.id;
    }

    // 4. Se não existir nenhuma atlética no banco, criar a Atlética Cinética
    const { data: nova, error: erroInsert } = await supabase
      .from('atleticas')
      .insert({
        ...DADOS_ATLETICA_CINETICA,
      })
      .select('id')
      .single();

    if (nova?.id && !erroInsert) {
      idCineticaCache = nova.id;
      return nova.id;
    }
  } catch (err) {
    console.error('Erro ao resolver Atlética Cinética:', err);
  }

  return null;
}
