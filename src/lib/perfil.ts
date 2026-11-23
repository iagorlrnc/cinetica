/**
 * Foto de perfil: só aceita arquivos do bucket "avatares" dentro da pasta do
 * próprio usuário (mesma regra das políticas de Storage da migração 037).
 */
export const BUCKET_AVATARES = 'avatares';
export const TAMANHO_AVATAR_PX = 512;
export const TIPOS_AVATAR = ['image/jpeg', 'image/png', 'image/webp'];
export const LIMITE_ARQUIVO_AVATAR = 8 * 1024 * 1024; // antes de redimensionar

export function ehUrlAvatarDoUsuario(url: string, userId: string, supabaseUrl: string | undefined): boolean {
  if (!url || !userId || !supabaseUrl) return false;
  const base = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET_AVATARES}/${userId}/`;
  if (!url.startsWith(base)) return false;
  const resto = url.slice(base.length).split('?')[0];
  // nome simples de arquivo, sem subpastas nem "..": evita apontar para outra pasta
  return /^[A-Za-z0-9._-]{1,100}$/.test(resto) && !resto.includes('..');
}
