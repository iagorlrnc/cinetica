import { describe, expect, it } from 'vitest';
import { construirUrl, obterSubdominio, obterUrlPorRole, obterUrlSite, usaSubdominios } from '@/lib/dominios';
import { montarRotaPainel, prefixoPainelAtual } from '@/lib/rotasPainel';

// Os testes rodam sem NEXT_PUBLIC_DOMINIO_PRINCIPAL / subdomínios: modo "por caminho".
describe('dominios (modo por caminho)', () => {
  it('não usa subdomínios sem configuração', () => {
    expect(usaSubdominios()).toBe(false);
  });

  it('monta links dos painéis por caminho', () => {
    expect(construirUrl('diretor', '/')).toBe('/diretor');
    expect(construirUrl('diretoria', '/autenticacao/entrar')).toBe('/diretor/autenticacao/entrar');
    expect(construirUrl('admin', '/')).toBe('/admin');
    expect(construirUrl('dev', 'usuarios')).toBe('/admin/usuarios');
    expect(construirUrl('cliente', '/eventos')).toBe('/eventos');
  });

  it('envia cada papel para o painel certo', () => {
    expect(obterUrlPorRole('diretor')).toBe('/diretor');
    expect(obterUrlPorRole('admin')).toBe('/admin');
    expect(obterUrlPorRole('cliente')).toBe('/');
  });

  it('identifica a área pelo host', () => {
    expect(obterSubdominio('localhost:3000')).toBe('cliente');
    expect(obterSubdominio('diretoria.exemplo.com')).toBe('diretoria');
    expect(obterSubdominio('dev.exemplo.com')).toBe('dev');
  });

  it('sem domínio configurado, a URL do site é a local (nenhum domínio fixo no código)', () => {
    const antes = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const antesUrl = process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(obterUrlSite()).toBe('http://localhost:3000');
    if (antes !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = antes;
    if (antesUrl !== undefined) process.env.VERCEL_URL = antesUrl;
  });
});

describe('rotas internas dos painéis', () => {
  it('detecta o prefixo do painel pela URL atual', () => {
    expect(prefixoPainelAtual('/diretor/eventos')).toBe('/diretor');
    expect(prefixoPainelAtual('/admin')).toBe('/admin');
    expect(prefixoPainelAtual('/eventos')).toBe('');
    expect(prefixoPainelAtual('/diretoria-x')).toBe('');
  });

  it('mantém o link relativo em modo subdomínio e prefixa em modo caminho', () => {
    expect(montarRotaPainel('/eventos', '/eventos/novo')).toBe('/eventos/novo');
    expect(montarRotaPainel('/diretor/eventos', '/eventos/novo')).toBe('/diretor/eventos/novo');
    expect(montarRotaPainel('/admin/usuarios', '/')).toBe('/admin');
  });
});
