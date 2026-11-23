import { TipoSubdominio } from '@/tipos';

/**
 * Roteamento dos painéis.
 *
 * - Com NEXT_PUBLIC_DOMINIO_PRINCIPAL, NEXT_PUBLIC_SUBDOMINIO_DIRETORIA e NEXT_PUBLIC_SUBDOMINIO_DEV
 *   configurados, cada área usa o próprio subdomínio (URLs absolutas).
 * - Sem essa configuração (ex.: localhost ou um único domínio), tudo funciona por caminho no mesmo site:
 *   painel da diretoria em /diretor e administração em /admin.
 *
 * Nenhum domínio é fixado no código: o padrão é sempre o modo por caminho.
 */

const limparDominio = (valor?: string) =>
  (valor || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

const DOMINIO_PRINCIPAL = limparDominio(process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL);
const SUBDOMINIO_DIRETORIA = limparDominio(
  process.env.NEXT_PUBLIC_SUBDOMINIO_DIRETORIA || process.env.NEXT_PUBLIC_SUBDOMINIO_DIRETOR
);
const SUBDOMINIO_DEV = limparDominio(process.env.NEXT_PUBLIC_SUBDOMINIO_DEV || process.env.NEXT_PUBLIC_SUBDOMINIO_ADMIN);
const PROTOCOLO = process.env.NEXT_PUBLIC_PROTOCOLO === 'http' ? 'http' : 'https';

/** Prefixo de caminho de cada painel quando não há subdomínios. */
export const PREFIXO_PAINEL = { diretoria: '/diretor', dev: '/admin' } as const;

/** Verdadeiro quando os três domínios estão configurados no ambiente. */
export function usaSubdominios(): boolean {
  return Boolean(DOMINIO_PRINCIPAL && SUBDOMINIO_DIRETORIA && SUBDOMINIO_DEV);
}

export function obterSubdominio(hostname: string): TipoSubdominio {
  const host = hostname.split(':')[0].toLowerCase();

  if (SUBDOMINIO_DIRETORIA ? host === SUBDOMINIO_DIRETORIA.split(':')[0] : host.startsWith('diretoria.')) {
    return 'diretoria';
  }
  if (SUBDOMINIO_DEV ? host === SUBDOMINIO_DEV.split(':')[0] : host.startsWith('dev.')) {
    return 'dev';
  }
  return 'cliente';
}

function normalizarCaminho(caminho: string): string {
  return caminho.startsWith('/') ? caminho : `/${caminho}`;
}

/**
 * Monta o link para uma área do sistema.
 * Modo subdomínio → URL absoluta; modo caminho → caminho relativo (ex.: /diretor/eventos).
 */
export function construirUrl(subdominio: TipoSubdominio | 'diretor' | 'admin', caminho: string = '/'): string {
  const c = normalizarCaminho(caminho);
  const area: TipoSubdominio =
    subdominio === 'diretor' || subdominio === 'diretoria' ? 'diretoria' : subdominio === 'admin' || subdominio === 'dev' ? 'dev' : 'cliente';

  if (usaSubdominios()) {
    const dominio = area === 'diretoria' ? SUBDOMINIO_DIRETORIA : area === 'dev' ? SUBDOMINIO_DEV : DOMINIO_PRINCIPAL;
    return `${PROTOCOLO}://${dominio}${c}`;
  }

  if (area === 'cliente') return c;
  const prefixo = PREFIXO_PAINEL[area];
  return c === '/' ? prefixo : `${prefixo}${c}`;
}

/** Navega para uma URL do sistema (absoluta em modo subdomínio, relativa em modo caminho). */
export function navegarPara(url: string, push: (href: string) => void): void {
  if (/^https?:\/\//i.test(url) && typeof window !== 'undefined') {
    window.location.href = url;
  } else {
    push(url);
  }
}

export function obterDominioCookie(): string | undefined {
  const dom = limparDominio(process.env.NEXT_PUBLIC_DOMINIO_COOKIE);
  return dom && !dom.includes('localhost') ? dom : undefined;
}

export function ehDominioPrincipal(hostname: string): boolean {
  return obterSubdominio(hostname) === 'cliente';
}

export function obterUrlLogin(): string {
  return construirUrl('cliente', '/autenticacao/entrar');
}

export function obterUrlPorRole(role: string): string {
  switch (role) {
    case 'diretor':
      return construirUrl('diretoria', '/');
    case 'admin':
      return construirUrl('dev', '/');
    default:
      return construirUrl('cliente', '/');
  }
}

/**
 * URL pública do site (para SEO, sitemap, links em e-mails e webhooks).
 * Usa NEXT_PUBLIC_DOMINIO_PRINCIPAL; sem ele, a URL de produção da Vercel; por fim, localhost.
 */
export function obterUrlSite(): string {
  if (DOMINIO_PRINCIPAL) return `${PROTOCOLO}://${DOMINIO_PRINCIPAL}`;
  const vercel = limparDominio(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL);
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

/** Nome da marca exibido em títulos, metadados e comprovantes. */
export const NOME_MARCA = 'Cinética';
export const NOME_PLATAFORMA = 'Cinética';
