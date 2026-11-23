/**
 * Converte erros do Supabase/PostgREST em mensagens claras para o painel.
 * (Antes os formulários mostravam só "Tente novamente" e o console exibia "{}".)
 */
interface ErroBancoLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function comoErro(err: unknown): ErroBancoLike {
  if (err && typeof err === 'object') return err as ErroBancoLike;
  if (typeof err === 'string') return { message: err };
  return {};
}

export function ehErroPermissao(err: unknown): boolean {
  const e = comoErro(err);
  return e.code === '42501' || /row-level security|permission denied|violates row-level/i.test(e.message || '');
}

export function traduzirErroBanco(err: unknown, contexto = 'salvar'): string {
  const e = comoErro(err);
  const msg = (e.message || '').trim();

  if (ehErroPermissao(e)) {
    return 'Sua conta não tem permissão para isso. Só diretores e administradores ativos podem fazer alterações (confira se a migração 035 foi aplicada no Supabase).';
  }
  if (e.code === '23505' || /duplicate key/i.test(msg)) {
    if (/slug/i.test(msg + (e.details || ''))) return 'Já existe um item com esse nome/endereço. Mude o título e tente de novo.';
    return 'Já existe um registro com esses dados.';
  }
  if (e.code === '23502' || /null value in column/i.test(msg)) {
    const coluna = msg.match(/column "([^"]+)"/)?.[1];
    return coluna ? `Campo obrigatório não preenchido: ${coluna}.` : 'Há um campo obrigatório sem preencher.';
  }
  if (e.code === '23514' || /check constraint|violates check/i.test(msg)) {
    return 'Algum valor está fora do permitido (ex.: preço negativo, quantidade zero ou texto muito longo).';
  }
  if (e.code === '23503' || /foreign key/i.test(msg)) {
    return 'Este registro está ligado a outro que não existe mais (ou ainda tem itens vinculados).';
  }
  if (e.code === 'PGRST204' || /Could not find the '.*' column/i.test(msg)) {
    return 'O banco está desatualizado em relação ao site. Rode as migrações pendentes no Supabase.';
  }
  if (e.code === 'PGRST205' || e.code === '42P01') {
    return 'Uma tabela necessária não existe no banco. Rode as migrações pendentes no Supabase.';
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) {
    return 'Arquivo grande demais para enviar.';
  }
  return msg ? `Não foi possível ${contexto}: ${msg}` : `Não foi possível ${contexto}. Tente novamente.`;
}
