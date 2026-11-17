/**
 * Validações puras, seguras para uso no navegador e no servidor (sem dependências de Node).
 */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_REGEX.test(valor);
}

/**
 * Sanitiza destinos de redirecionamento pós-login para impedir open redirect e
 * `javascript:` XSS. Aceita apenas caminhos relativos ao próprio site.
 */
export function sanitizarRedirecionamento(destino: string | null | undefined, padrao: string = '/'): string {
  if (!destino || typeof destino !== 'string') return padrao;
  const valor = destino.trim();
  if (!valor.startsWith('/')) return padrao;
  // "//evil.com" e "/\evil.com" são interpretados como URLs absolutas pelos navegadores
  if (valor.startsWith('//') || valor.startsWith('/\\')) return padrao;
  // Caracteres de controle / quebras de linha (header injection, bypass de parsers)
  if (/[\u0000-\u001f\u007f]/.test(valor)) return padrao;
  try {
    const url = new URL(valor, 'https://base.invalid');
    if (url.origin !== 'https://base.invalid') return padrao;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return padrao;
  }
}
