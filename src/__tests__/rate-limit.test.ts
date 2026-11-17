import { describe, it, expect } from 'vitest';
import {
  limitarRequisicao,
  registrarErroRateLimit,
  registrarSucessoRateLimit,
  verificarRateLimit,
  verificarRateLimitEmailRecuperacao,
  registrarEnvioEmailRecuperacao,
} from '@/lib/rateLimit';

const chave = (s: string) => `${s}-${Math.random().toString(36).slice(2)}`;

describe('rate limit por janela', () => {
  it('bloqueia após exceder o máximo da janela', () => {
    const k = chave('janela');
    for (let i = 0; i < 3; i++) expect(verificarRateLimit(k, { janelaMs: 60_000, maxRequisicoes: 3 }).permitido).toBe(true);
    const r = verificarRateLimit(k, { janelaMs: 60_000, maxRequisicoes: 3 });
    expect(r.permitido).toBe(false);
    expect(r.segundosRestantes).toBeGreaterThan(0);
  });

  it('limitarRequisicao funciona sem banco configurado (fallback em memória)', async () => {
    const antes = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const k = chave('dist');
    expect((await limitarRequisicao(k, { janelaMs: 60_000, maxRequisicoes: 1 })).permitido).toBe(true);
    expect((await limitarRequisicao(k, { janelaMs: 60_000, maxRequisicoes: 1 })).permitido).toBe(false);
    if (antes) process.env.SUPABASE_SERVICE_ROLE_KEY = antes;
  });
});

describe('rate limit de autenticação (tentativas erradas)', () => {
  it('bloqueia cliente após 5 erros consecutivos', () => {
    const ip = chave('ip');
    for (let i = 0; i < 4; i++) expect(registrarErroRateLimit(ip).bloqueado).toBe(false);
    expect(registrarErroRateLimit(ip).bloqueado).toBe(true);
    expect(verificarRateLimit(ip).bloqueado).toBe(true);
  });

  it('admin é bloqueado por 1 hora após 5 erros', () => {
    const ip = chave('admin');
    for (let i = 0; i < 4; i++) registrarErroRateLimit(ip, true);
    const r = registrarErroRateLimit(ip, true);
    expect(r.bloqueado).toBe(true);
    expect(r.segundosRestantes).toBeGreaterThan(3500);
  });

  it('sucesso zera o contador', () => {
    const ip = chave('ok');
    registrarErroRateLimit(ip);
    registrarSucessoRateLimit(ip);
    expect(verificarRateLimit(ip).tentativasConsecutivas).toBe(0);
  });
});

describe('recuperação de senha por e-mail', () => {
  it('aplica cooldown de 60s entre envios', () => {
    const email = `${chave('u')}@ex.com`;
    expect(verificarRateLimitEmailRecuperacao(email).bloqueado).toBe(false);
    registrarEnvioEmailRecuperacao(email);
    expect(verificarRateLimitEmailRecuperacao(email).bloqueado).toBe(true);
  });
});
