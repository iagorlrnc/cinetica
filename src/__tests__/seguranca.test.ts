import { describe, it, expect, afterEach } from 'vitest';
import {
  compararSegredo,
  ehIdPagamentoGateway,
  ehUuid,
  obterIpRequisicao,
  sanitizarRedirecionamento,
  validarBearer,
} from '@/lib/seguranca';

describe('sanitizarRedirecionamento (open redirect / XSS)', () => {
  it.each([
    ['/meus-ingressos', '/meus-ingressos'],
    ['/eventos/abc?x=1#y', '/eventos/abc?x=1#y'],
    ['/autenticacao/redefinir-senha', '/autenticacao/redefinir-senha'],
  ])('aceita caminho relativo %s', (entrada, esperado) => {
    expect(sanitizarRedirecionamento(entrada)).toBe(esperado);
  });

  it.each([
    'https://evil.com',
    'https://evil.com/autenticacao/redefinir-senha',
    '//evil.com',
    '//evil.com/autenticacao/redefinir-senha',
    '/\\evil.com',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    '/\nSet-Cookie: x=1',
    '',
    null,
    undefined,
  ])('bloqueia destino malicioso %s', (entrada) => {
    expect(sanitizarRedirecionamento(entrada as string)).toBe('/');
  });

  it('usa o padrão informado', () => {
    expect(sanitizarRedirecionamento('https://x.com', '/painel')).toBe('/painel');
  });
});

describe('validadores de identificadores', () => {
  it('ehUuid', () => {
    expect(ehUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(ehUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301,id.neq.x')).toBe(false);
    expect(ehUuid(123)).toBe(false);
  });

  it('ehIdPagamentoGateway impede injeção de filtros PostgREST', () => {
    expect(ehIdPagamentoGateway('123456789')).toBe(true);
    expect(ehIdPagamentoGateway(987654)).toBe(true);
    expect(ehIdPagamentoGateway('1,comprador_id.neq.0')).toBe(false);
    expect(ehIdPagamentoGateway('')).toBe(false);
    expect(ehIdPagamentoGateway(null)).toBe(false);
  });
});

describe('comparação de segredos', () => {
  it('compararSegredo é exato', () => {
    expect(compararSegredo('abc', 'abc')).toBe(true);
    expect(compararSegredo('abc', 'abd')).toBe(false);
    expect(compararSegredo('', '')).toBe(false);
    expect(compararSegredo(null, 'abc')).toBe(false);
  });

  it('validarBearer exige esquema Bearer e segredo configurado', () => {
    expect(validarBearer('Bearer s3cr3t', 's3cr3t')).toBe(true);
    expect(validarBearer('Bearer errado', 's3cr3t')).toBe(false);
    expect(validarBearer('s3cr3t', 's3cr3t')).toBe(false);
    expect(validarBearer('Bearer ', undefined)).toBe(false);
    expect(validarBearer(null, 's3cr3t')).toBe(false);
  });
});

describe('obterIpRequisicao', () => {
  afterEach(() => {
    delete process.env.CONFIAR_CF_CONNECTING_IP;
  });

  it('ignora cf-connecting-ip forjado quando não está atrás do Cloudflare', () => {
    const h = new Headers({ 'cf-connecting-ip': '6.6.6.6', 'x-real-ip': '1.2.3.4' });
    expect(obterIpRequisicao(h)).toBe('1.2.3.4');
  });

  it('usa cf-connecting-ip quando explicitamente confiável', () => {
    process.env.CONFIAR_CF_CONNECTING_IP = 'true';
    const h = new Headers({ 'cf-connecting-ip': '9.9.9.9', 'x-real-ip': '1.2.3.4' });
    expect(obterIpRequisicao(h)).toBe('9.9.9.9');
  });

  it('usa o primeiro IP do x-forwarded-for como fallback', () => {
    const h = new Headers({ 'x-forwarded-for': '5.5.5.5, 10.0.0.1' });
    expect(obterIpRequisicao(h)).toBe('5.5.5.5');
  });

  it('retorna loopback quando não há cabeçalhos', () => {
    expect(obterIpRequisicao(new Headers())).toBe('127.0.0.1');
  });
});
