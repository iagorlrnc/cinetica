'use client';

import { usePathname } from 'next/navigation';

/**
 * Links internos dos painéis (diretoria e admin).
 *
 * Em modo subdomínio, o navegador vê "/eventos" (o proxy reescreve para /diretor/eventos).
 * Em modo caminho, o navegador vê "/diretor/eventos". O prefixo é deduzido da URL atual,
 * então o mesmo código funciona nos dois modos.
 */
export function prefixoPainelAtual(pathname: string): '' | '/diretor' | '/admin' {
  if (pathname === '/diretor' || pathname.startsWith('/diretor/')) return '/diretor';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return '/admin';
  return '';
}

export function montarRotaPainel(pathname: string, href: string): string {
  const prefixo = prefixoPainelAtual(pathname);
  const caminho = href.startsWith('/') ? href : `/${href}`;
  if (!prefixo) return caminho;
  return caminho === '/' ? prefixo : `${prefixo}${caminho}`;
}

/** Hook: devolve uma função que monta o caminho correto dentro do painel atual. */
export function usarRotaPainel(): (href: string) => string {
  const pathname = usePathname() || '';
  return (href: string) => montarRotaPainel(pathname, href);
}
