import crypto from 'crypto';

export { UUID_REGEX, ehUuid, sanitizarRedirecionamento } from './validacoes';

/** IDs de pagamento do Mercado Pago são numéricos. Evita injeção de filtros PostgREST. */
export function ehIdPagamentoGateway(valor: unknown): boolean {
  return (typeof valor === 'string' || typeof valor === 'number') && /^\d{1,20}$/.test(String(valor));
}

/**
 * Comparação em tempo constante para segredos (CRON_SECRET, TEST_SUITE_SECRET, etc).
 */
export function compararSegredo(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Valida cabeçalho `Authorization: Bearer <segredo>` em tempo constante. */
export function validarBearer(authHeader: string | null, segredo: string | undefined): boolean {
  if (!authHeader || !segredo || !authHeader.startsWith('Bearer ')) return false;
  return compararSegredo(authHeader.slice(7).trim(), segredo);
}

/**
 * Obtém o IP do cliente priorizando cabeçalhos definidos pela plataforma.
 * `cf-connecting-ip` só é confiável quando a aplicação está atrás do Cloudflare
 * (defina CONFIAR_CF_CONNECTING_IP=true).
 */
export function obterIpRequisicao(headers: Headers): string {
  if (process.env.CONFIAR_CF_CONNECTING_IP === 'true') {
    const cf = headers.get('cf-connecting-ip');
    if (cf) return cf.trim().slice(0, 64);
  }
  const real = headers.get('x-real-ip');
  if (real) return real.trim().slice(0, 64);
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const ip = fwd.split(',')[0]?.trim();
    if (ip) return ip.slice(0, 64);
  }
  return '127.0.0.1';
}

/** Mensagem genérica para erros internos — nunca vaza detalhes do banco para o cliente. */
export const MENSAGEM_ERRO_INTERNO = 'Não foi possível concluir a operação. Tente novamente em instantes.';

export function limitarTexto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  if (!t) return null;
  return t.slice(0, max);
}
