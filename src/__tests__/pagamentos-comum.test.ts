import { describe, it, expect } from 'vitest';
import {
  EMAIL_PAYER_PADRAO,
  montarPayer,
  normalizarIssuer,
  normalizarMetodoCartao,
  normalizarParcelas,
  obterUrlWebhook,
  pagamentoCorrespondeAoPedido,
} from '@/lib/pagamentos/comum';

const PEDIDO = '11111111-1111-4111-8111-111111111111';

describe('pagamentoCorrespondeAoPedido', () => {
  it('aceita pagamento do próprio pedido com valor integral', () => {
    expect(pagamentoCorrespondeAoPedido({ external_reference: PEDIDO, transaction_amount: 55 }, PEDIDO, 55)).toEqual({ ok: true });
  });

  it('aceita via metadata.pedido_id', () => {
    expect(
      pagamentoCorrespondeAoPedido({ external_reference: null, metadata: { pedido_id: PEDIDO }, transaction_amount: 10 }, PEDIDO, 10).ok
    ).toBe(true);
  });

  it('rejeita pagamento de OUTRO pedido (reuso de payment_id)', () => {
    const r = pagamentoCorrespondeAoPedido({ external_reference: '22222222-2222-4222-8222-222222222222', transaction_amount: 999 }, PEDIDO, 10);
    expect(r).toEqual({ ok: false, motivo: 'referencia_divergente' });
  });

  it('rejeita valor pago menor que o devido', () => {
    const r = pagamentoCorrespondeAoPedido({ external_reference: PEDIDO, transaction_amount: 1 }, PEDIDO, 110);
    expect(r).toEqual({ ok: false, motivo: 'valor_insuficiente' });
  });

  it('tolera diferença de arredondamento de 1 centavo', () => {
    expect(pagamentoCorrespondeAoPedido({ external_reference: PEDIDO, transaction_amount: 54.99 }, PEDIDO, 55).ok).toBe(true);
  });
});

describe('montarPayer', () => {
  it('usa dados do perfil e CPF válido', () => {
    const p = montarPayer({ nome: 'Maria Souza Lima', email: 'maria@ex.com', cpf: '529.982.247-25' }, 'outro@ex.com');
    expect(p).toEqual({
      email: 'maria@ex.com',
      first_name: 'Maria',
      last_name: 'Souza Lima',
      identification: { type: 'CPF', number: '52998224725' },
    });
  });

  it('cai para e-mail padrão quando nenhum é válido', () => {
    expect(montarPayer(null, 'invalido').email).toBe(EMAIL_PAYER_PADRAO);
    expect(montarPayer({ email: 'x@testuser.com' }, null).email).toBe(EMAIL_PAYER_PADRAO);
  });

  it('omite identificação com documento inválido', () => {
    expect(montarPayer({ nome: 'A', cpf: '123' }, null).identification).toBeUndefined();
  });
});

describe('normalizadores do Card Brick', () => {
  it('normalizarMetodoCartao', () => {
    expect(normalizarMetodoCartao('Mastercard')).toBe('master');
    expect(normalizarMetodoCartao('visa')).toBe('visa');
    expect(normalizarMetodoCartao('undefined')).toBeNull();
    expect(normalizarMetodoCartao('<script>')).toBeNull();
    expect(normalizarMetodoCartao(42)).toBeNull();
  });

  it('normalizarParcelas limita entre 1 e 12', () => {
    expect(normalizarParcelas('3')).toBe(3);
    expect(normalizarParcelas(99)).toBe(12);
    expect(normalizarParcelas(-1)).toBe(1);
    expect(normalizarParcelas('abc')).toBe(1);
  });

  it('normalizarIssuer aceita apenas dígitos', () => {
    expect(normalizarIssuer('24')).toBe('24');
    expect(normalizarIssuer('null')).toBeUndefined();
    expect(normalizarIssuer('1;drop')).toBeUndefined();
  });
});

describe('obterUrlWebhook', () => {
  it('sempre usa HTTPS', () => {
    const antes = process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL;
    process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL = 'exemplo.com.br/';
    expect(obterUrlWebhook()).toBe('https://exemplo.com.br/api/webhook-mercadopago');
    process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL = antes;
  });
});
