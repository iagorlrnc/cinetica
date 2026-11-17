import { describe, it, expect } from 'vitest';
import { criarSupabaseFake } from './helpers/supabaseFake';
import {
  MAX_UNIDADES_POR_ITEM,
  confirmarPedidoLoja,
  criarPedidoLoja,
  normalizarItensLoja,
  validarItensLoja,
} from '@/lib/pagamentos/loja';

const CAMISA = '10000000-0000-4000-8000-000000000001';
const COPO = '10000000-0000-4000-8000-000000000002';
const BRINDE = '10000000-0000-4000-8000-000000000003';
const USER = '20000000-0000-4000-8000-000000000001';

const produtos = [
  { id: CAMISA, name: 'Camisa', price: 5000, stock_quantity: 3, is_active: true, atletica_id: 'atl', sizes: ['P', 'M', 'G'] },
  { id: COPO, name: 'Copo', price: 1500, stock_quantity: 10, is_active: true, atletica_id: 'atl', sizes: [] },
  { id: BRINDE, name: 'Adesivo', price: 0, stock_quantity: 50, is_active: true, atletica_id: 'atl', sizes: [] },
];

describe('normalizarItensLoja', () => {
  it('agrupa itens repetidos do mesmo produto/tamanho', () => {
    const r = normalizarItensLoja([
      { product_id: COPO, quantity: 2 },
      { product_id: COPO, quantity: 3 },
    ]);
    expect(r).toEqual({ ok: true, itens: [{ product_id: COPO, size: null, quantity: 5 }] });
  });

  it('rejeita carrinho vazio, id inválido e quantidade fora do limite', () => {
    expect(normalizarItensLoja([]).ok).toBe(false);
    expect(normalizarItensLoja([{ product_id: 'abc', quantity: 1 }]).ok).toBe(false);
    expect(normalizarItensLoja([{ product_id: COPO, quantity: 0 }]).ok).toBe(false);
    expect(normalizarItensLoja([{ product_id: COPO, quantity: MAX_UNIDADES_POR_ITEM + 1 }]).ok).toBe(false);
  });

  it('rejeita soma acima do limite ao agrupar', () => {
    expect(
      normalizarItensLoja([
        { product_id: COPO, quantity: 15 },
        { product_id: COPO, quantity: 15 },
      ]).ok
    ).toBe(false);
  });
});

describe('validarItensLoja', () => {
  it('calcula total com preço do BANCO (ignora preço enviado pelo cliente)', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: { store_products: produtos }, respostasFixas: { store_order_items: { data: [] } } });
    const r = await validarItensLoja(cliente, [{ product_id: COPO, quantity: 2, price: 1 }], { userId: USER, modo: 'pago' });
    expect(r).toMatchObject({ ok: true, totalCentavos: 3000 });
  });

  it('bloqueia estoque insuficiente somando linhas repetidas com tamanhos diferentes', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: { store_products: produtos }, respostasFixas: { store_order_items: { data: [] } } });
    const r = await validarItensLoja(
      cliente,
      [
        { product_id: CAMISA, size: 'P', quantity: 2 },
        { product_id: CAMISA, size: 'M', quantity: 2 },
      ],
      { userId: USER, modo: 'pago' }
    );
    expect(r.ok).toBe(false);
  });

  it('exige tamanho válido quando o produto possui grade', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: { store_products: produtos }, respostasFixas: { store_order_items: { data: [] } } });
    const r = await validarItensLoja(cliente, [{ product_id: CAMISA, size: 'XXXL', quantity: 1 }], { userId: USER, modo: 'pago' });
    expect(r).toMatchObject({ ok: false });
  });

  it('endpoint gratuito rejeita produto pago', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: { store_products: produtos }, respostasFixas: { store_order_items: { data: [] } } });
    const r = await validarItensLoja(cliente, [{ product_id: COPO, quantity: 1 }], { userId: USER, modo: 'gratuito' });
    expect(r.ok).toBe(false);
  });

  it('produto gratuito: 1 unidade e apenas um resgate por usuário', async () => {
    const semResgate = criarSupabaseFake({ tabelas: { store_products: produtos }, respostasFixas: { store_order_items: { data: [] } } });
    expect((await validarItensLoja(semResgate.cliente, [{ product_id: BRINDE, quantity: 2 }], { userId: USER, modo: 'gratuito' })).ok).toBe(false);
    expect((await validarItensLoja(semResgate.cliente, [{ product_id: BRINDE, quantity: 1 }], { userId: USER, modo: 'gratuito' })).ok).toBe(true);

    const jaResgatou = criarSupabaseFake({
      tabelas: { store_products: produtos },
      respostasFixas: { store_order_items: { data: [{ product_id: BRINDE }] } },
    });
    expect((await validarItensLoja(jaResgatou.cliente, [{ product_id: BRINDE, quantity: 1 }], { userId: USER, modo: 'gratuito' })).ok).toBe(false);
  });

  it('rejeita produto inativo', async () => {
    const inativos = produtos.map((p) => ({ ...p, is_active: p.id !== COPO }));
    const { cliente } = criarSupabaseFake({ tabelas: { store_products: inativos }, respostasFixas: { store_order_items: { data: [] } } });
    expect((await validarItensLoja(cliente, [{ product_id: COPO, quantity: 1 }], { userId: USER, modo: 'pago' })).ok).toBe(false);
  });
});

describe('criarPedidoLoja / confirmarPedidoLoja', () => {
  it('cria pedido pending_payment com itens', async () => {
    const fake = criarSupabaseFake({ tabelas: { store_orders: [], store_order_items: [] } });
    const r = await criarPedidoLoja(fake.cliente, {
      userId: USER,
      itens: [{ product_id: COPO, name: 'Copo', size: null, quantity: 2, price_cents: 1500, subtotal_cents: 3000, atletica_id: 'atl' }],
      totalCentavos: 3000,
      atleticaId: 'atl',
      metodo: 'pix',
    });
    expect(r.ok).toBe(true);
    expect(fake.tabelas.store_orders[0]).toMatchObject({ status: 'pending_payment', total_amount: 3000, user_id: USER });
    expect(fake.tabelas.store_order_items).toHaveLength(1);
  });

  const pedido = { id: '30000000-0000-4000-8000-000000000001', user_id: USER, status: 'pending_payment', total_amount: 3000 };

  it('confirma quando pagamento é do pedido e cobre o total', async () => {
    const fake = criarSupabaseFake({ rpc: { processar_pedido_loja_aprovado: () => ({ data: { sucesso: true }, error: null }) } });
    const r = await confirmarPedidoLoja(fake.cliente, pedido, { id: 1, status: 'approved', external_reference: pedido.id, transaction_amount: 30 });
    expect(r).toEqual({ sucesso: true, status: 'paid' });
  });

  it('BLOQUEIA reutilizar pagamento barato de outra compra', async () => {
    const fake = criarSupabaseFake({ rpc: { processar_pedido_loja_aprovado: () => ({ data: { sucesso: true }, error: null }) } });
    const r = await confirmarPedidoLoja(fake.cliente, pedido, { id: 2, status: 'approved', external_reference: 'outro', transaction_amount: 1 });
    expect(r.sucesso).toBe(false);
    expect(fake.chamadasRpc).toHaveLength(0);
  });

  it('BLOQUEIA valor pago inferior ao total', async () => {
    const fake = criarSupabaseFake({ rpc: { processar_pedido_loja_aprovado: () => ({ data: { sucesso: true }, error: null }) } });
    const r = await confirmarPedidoLoja(fake.cliente, pedido, { id: 3, status: 'approved', external_reference: pedido.id, transaction_amount: 10 });
    expect(r).toEqual({ sucesso: false, erro: 'valor_insuficiente' });
  });
});
