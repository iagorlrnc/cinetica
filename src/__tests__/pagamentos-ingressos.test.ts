import { describe, it, expect, beforeAll } from 'vitest';
import { criarSupabaseFake } from './helpers/supabaseFake';
import {
  calcularValoresPedido,
  criarOuReutilizarPedidoPendente,
  gerarHashesPedido,
  liberarIngressosDoPagamento,
  traduzirErroLiberacao,
  validarCompraIngresso,
} from '@/lib/pagamentos/ingressos';

const EVENTO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENTO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LOTE_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const LOTE_B_GRATIS = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTRO_USER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const futuro = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

function base() {
  return {
    eventos: [
      { id: EVENTO_A, titulo: 'Show caro', atletica_id: 'atl', data_evento: futuro, status: 'publicado', apagado_pelo_diretor: false },
      { id: EVENTO_B, titulo: 'Palestra', atletica_id: 'atl', data_evento: futuro, status: 'publicado', apagado_pelo_diretor: false },
    ],
    lotes_ingresso: [
      { id: LOTE_A, evento_id: EVENTO_A, nome_lote: '1º Lote', preco: 100, quantidade_total: 50, quantidade_vendida: 48, ativo: true },
      { id: LOTE_B_GRATIS, evento_id: EVENTO_B, nome_lote: 'Free', preco: 0, quantidade_total: 100, quantidade_vendida: 0, ativo: true },
    ],
  };
}

beforeAll(() => {
  process.env.QR_CODE_SECRET = 'segredo-de-teste-com-mais-de-16-chars';
});

describe('calcularValoresPedido', () => {
  it('aplica taxa de 10% por ingresso', () => {
    expect(calcularValoresPedido(100, 2)).toEqual({ valorUnitario: 100, taxaServicoTotal: 20, totalFinal: 220 });
  });
  it('não cobra taxa de lote gratuito', () => {
    expect(calcularValoresPedido(0, 1)).toEqual({ valorUnitario: 0, taxaServicoTotal: 0, totalFinal: 0 });
  });
  it('arredonda centavos corretamente', () => {
    expect(calcularValoresPedido(33.33, 3).totalFinal).toBe(109.98);
  });
});

describe('validarCompraIngresso', () => {
  it('aceita compra válida', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: base() });
    const r = await validarCompraIngresso(cliente, { eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 2 });
    expect(r.ok).toBe(true);
  });

  it('BLOQUEIA lote gratuito de outro evento (manipulação de preço)', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: base() });
    const r = await validarCompraIngresso(cliente, { eventoId: EVENTO_A, loteId: LOTE_B_GRATIS, quantidade: 1 });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it('bloqueia evento em rascunho', async () => {
    const t = base();
    t.eventos[0].status = 'rascunho';
    const { cliente } = criarSupabaseFake({ tabelas: t });
    const r = await validarCompraIngresso(cliente, { eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 1 });
    expect(r.ok).toBe(false);
  });

  it('bloqueia evento que já passou', async () => {
    const t = base();
    t.eventos[0].data_evento = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const { cliente } = criarSupabaseFake({ tabelas: t });
    const r = await validarCompraIngresso(cliente, { eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 1 });
    expect(r).toMatchObject({ ok: false, erro: 'Este evento já foi encerrado.' });
  });

  it('bloqueia quantidade acima do estoque', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: base() });
    const r = await validarCompraIngresso(cliente, { eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 3 });
    expect(r).toMatchObject({ ok: false, erro: 'Ingressos insuficientes para este lote.' });
  });

  it.each([0, 11, -1, 'abc'])('bloqueia quantidade inválida %s', async (qtd) => {
    const { cliente } = criarSupabaseFake({ tabelas: base() });
    const r = await validarCompraIngresso(cliente, { eventoId: EVENTO_A, loteId: LOTE_A, quantidade: qtd });
    expect(r.ok).toBe(false);
  });

  it('bloqueia identificadores não-UUID', async () => {
    const { cliente } = criarSupabaseFake({ tabelas: base() });
    const r = await validarCompraIngresso(cliente, { eventoId: "x' OR 1=1", loteId: LOTE_A, quantidade: 1 });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });
});

describe('criarOuReutilizarPedidoPendente', () => {
  const valores = calcularValoresPedido(100, 1);

  it('NÃO sobrescreve pedido de outro usuário com o mesmo ID sugerido', async () => {
    const idAlheio = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const { cliente, tabelas } = criarSupabaseFake({
      tabelas: { pedidos: [{ id: idAlheio, comprador_id: OUTRO_USER, evento_id: EVENTO_A, lote_id: LOTE_A, quantidade: 1, status: 'aprovado', valor_total: 110 }] },
    });
    const r = await criarOuReutilizarPedidoPendente(cliente, {
      idSugerido: idAlheio, compradorId: USER, eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 1, valores, metodo: 'pix',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pedidoId).not.toBe(idAlheio);
    expect(tabelas.pedidos.find((p) => p.id === idAlheio)).toMatchObject({ comprador_id: OUTRO_USER, status: 'aprovado' });
  });

  it('reutiliza pedido pendente do mesmo usuário e mesma compra', async () => {
    const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const { cliente } = criarSupabaseFake({
      tabelas: { pedidos: [{ id, comprador_id: USER, evento_id: EVENTO_A, lote_id: LOTE_A, quantidade: 1, status: 'pendente', valor_total: 110 }] },
    });
    const r = await criarOuReutilizarPedidoPendente(cliente, {
      idSugerido: id, compradorId: USER, eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 1, valores, metodo: 'pix',
    });
    expect(r).toEqual({ ok: true, pedidoId: id });
  });

  it('grava external_reference igual ao id do pedido', async () => {
    const { cliente, tabelas } = criarSupabaseFake({ tabelas: { pedidos: [] } });
    const r = await criarOuReutilizarPedidoPendente(cliente, {
      compradorId: USER, eventoId: EVENTO_A, loteId: LOTE_A, quantidade: 1, valores, metodo: 'pix',
    });
    expect(r.ok).toBe(true);
    expect(tabelas.pedidos[0].external_reference).toBe(tabelas.pedidos[0].id);
    expect(tabelas.pedidos[0].valor_total).toBe(110);
  });
});

describe('liberarIngressosDoPagamento', () => {
  const pedido = { id: '12121212-1212-4121-8121-121212121212', comprador_id: USER, evento_id: EVENTO_A, lote_id: LOTE_A, quantidade: 2, valor_total: 220, status: 'pendente' };

  function fakeComRpc() {
    return criarSupabaseFake({
      rpc: { processar_pagamento_aprovado: () => ({ data: { sucesso: true, ja_processado: false, ingressos_ids: ['i1', 'i2'] }, error: null }) },
    });
  }

  it('libera quando o pagamento pertence ao pedido e cobre o valor', async () => {
    const fake = fakeComRpc();
    const r = await liberarIngressosDoPagamento(
      fake.cliente,
      pedido,
      { id: 777, status: 'approved', external_reference: pedido.id, transaction_amount: 220, payment_method_id: 'pix' },
      { notificar: false }
    );
    expect(r).toMatchObject({ sucesso: true });
    expect(fake.chamadasRpc).toHaveLength(1);
    const args = fake.chamadasRpc[0].args;
    expect(args.p_pedido_id).toBe(pedido.id);
    expect(args.p_gateway_payment_id).toBe('777');
    expect(args.p_qr_hashes).toEqual(gerarHashesPedido(EVENTO_A, '777', 2));
  });

  it('NÃO chama a RPC com payment_id de outra compra', async () => {
    const fake = fakeComRpc();
    const r = await liberarIngressosDoPagamento(
      fake.cliente,
      pedido,
      { id: 888, status: 'approved', external_reference: '99999999-9999-4999-8999-999999999999', transaction_amount: 5 },
      { notificar: false }
    );
    expect(r).toEqual({ sucesso: false, erro: 'referencia_divergente' });
    expect(fake.chamadasRpc).toHaveLength(0);
  });

  it('NÃO libera pagamento com valor inferior ao pedido', async () => {
    const fake = fakeComRpc();
    const r = await liberarIngressosDoPagamento(
      fake.cliente,
      pedido,
      { id: 889, status: 'approved', external_reference: pedido.id, transaction_amount: 1 },
      { notificar: false }
    );
    expect(r).toEqual({ sucesso: false, erro: 'valor_insuficiente' });
    expect(fake.chamadasRpc).toHaveLength(0);
  });

  it('NÃO libera pagamento não aprovado', async () => {
    const fake = fakeComRpc();
    const r = await liberarIngressosDoPagamento(fake.cliente, pedido, { id: 1, status: 'pending', external_reference: pedido.id, transaction_amount: 220 });
    expect(r.sucesso).toBe(false);
    expect(fake.chamadasRpc).toHaveLength(0);
  });

  it('propaga erro de estoque da RPC sem emitir ingressos por fallback', async () => {
    const fake = criarSupabaseFake({
      rpc: { processar_pagamento_aprovado: () => ({ data: { sucesso: false, erro: 'estoque_esgotado' }, error: null }) },
    });
    const r = await liberarIngressosDoPagamento(
      fake.cliente, pedido,
      { id: 5, status: 'approved', external_reference: pedido.id, transaction_amount: 220 },
      { notificar: false }
    );
    expect(r).toEqual({ sucesso: false, erro: 'estoque_esgotado' });
    expect(fake.escritas.filter((e) => e.tabela === 'ingressos')).toHaveLength(0);
  });
});

describe('gerarHashesPedido / traduzirErroLiberacao', () => {
  it('hashes são determinísticos e únicos por posição', () => {
    const a = gerarHashesPedido(EVENTO_A, '123', 3);
    expect(a).toEqual(gerarHashesPedido(EVENTO_A, '123', 3));
    expect(new Set(a).size).toBe(3);
    expect(gerarHashesPedido(EVENTO_B, '123', 1)[0]).not.toBe(a[0]);
  });

  it('mapeia erros conhecidos', () => {
    expect(traduzirErroLiberacao('estoque_esgotado').status).toBe('estoque_esgotado');
    expect(traduzirErroLiberacao('referencia_divergente').status).toBe('cancelado');
    expect(traduzirErroLiberacao('qualquer').status).toBe('aguardando');
  });
});
