import { describe, expect, it } from 'vitest';
import { ehUrlAvatarDoUsuario } from '@/lib/perfil';

const SUPABASE = 'https://projeto.supabase.co';
const EU = '11111111-1111-4111-8111-111111111111';
const OUTRO = '22222222-2222-4222-8222-222222222222';
const base = `${SUPABASE}/storage/v1/object/public/avatares`;

describe('ehUrlAvatarDoUsuario', () => {
  it('aceita foto na pasta do próprio usuário', () => {
    expect(ehUrlAvatarDoUsuario(`${base}/${EU}/foto-123.webp`, EU, SUPABASE)).toBe(true);
    expect(ehUrlAvatarDoUsuario(`${base}/${EU}/foto-123.webp?v=2`, EU, `${SUPABASE}/`)).toBe(true);
  });

  it('recusa foto da pasta de outra pessoa', () => {
    expect(ehUrlAvatarDoUsuario(`${base}/${OUTRO}/foto.webp`, EU, SUPABASE)).toBe(false);
  });

  it('recusa endereços externos, outros buckets e caminhos com subpasta ou ..', () => {
    expect(ehUrlAvatarDoUsuario('https://evil.com/foto.webp', EU, SUPABASE)).toBe(false);
    expect(ehUrlAvatarDoUsuario(`${SUPABASE}/storage/v1/object/public/imagens/${EU}/foto.webp`, EU, SUPABASE)).toBe(false);
    expect(ehUrlAvatarDoUsuario(`${base}/${EU}/../${OUTRO}/foto.webp`, EU, SUPABASE)).toBe(false);
    expect(ehUrlAvatarDoUsuario(`${base}/${EU}/sub/foto.webp`, EU, SUPABASE)).toBe(false);
    expect(ehUrlAvatarDoUsuario('javascript:alert(1)', EU, SUPABASE)).toBe(false);
  });

  it('recusa quando falta configuração', () => {
    expect(ehUrlAvatarDoUsuario(`${base}/${EU}/foto.webp`, EU, undefined)).toBe(false);
    expect(ehUrlAvatarDoUsuario('', EU, SUPABASE)).toBe(false);
  });
});
