/**
 * Compra de cotas de sorteio via Pix — testes de segurança e do fluxo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { criarSupabaseFake } from './helpers/supabaseFake';
import {
  confirmarPedidoSorteio,
  traduzirErroReserva,
  validarEntradaCompraSorteio,
} from '@/lib/pagamentos/sorteios';

const estado = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import('./helpers/supabaseFake').criarSupabaseFake>,
  sessao: null as null | { user: { id: string; email: string }; perfil: Record<string, unknown> | null },
  pagamentos: {} as Record<string, Record<string, unknown>>,
  criar: (async () => ({ id: 999, point_of_interaction: { transaction_data: { qr_code: 'PIX-COPIA-COLA', qr_code_base64: 'QkFTRTY0' } } })) as (
    args: unknown
  ) => Promise<unknown>,
  ultimoCreate: null as unknown,
}));

vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => estado.fake.cliente }));
vi.mock('@/lib/autenticacaoApi', async (original) => ({
  ...(await original<typeof import('@/lib/autenticacaoApi')>()),
  obterSessaoApi: async () => estado.sessao,
}));
vi.mock('@/lib/mercadopago', async (original) => ({
  ...(await original<typeof import('@/lib/mercadopago')>()),
  ehMercadoPagoConfigurado: () => true,
  paymentClient: {
    get: async ({ id }: { id: string }) => estado.pagamentos[id] ?? null,
    create: async (args: unknown) => {
      estado.ultimoCreate = args;
      return estado.criar(args);
    },
  },
}));

const SORTEIO = '11111111-1111-4111-8111-111111111111';
const PEDIDO = '22222222-2222-4222-8222-222222222222';
const OUTRO_PEDIDO = '33333333-3333-4333-8333-333333333333';
const COMPRADOR = '44444444-4444-4444-8444-444444444444';
const ATACANTE = '55555555-5555-4555-8555-555555555555';
const futuro = () => new Date(Date.now() + 10 * 60_000).toISOString();

function pedidoPendente(extra: Record<string, unknown> = {}) {
  return {
    id: PEDIDO, sorteio_id: SORTEIO, usuario_id: COMPRADOR, quantidade: 3, valor_total: 15, status: 'pendente',
    gateway_payment_id: '777', expira_em: futuro(), qr_code: 'PIX', qr_code_base64: null, criado_em: new Date().toISOString(),
    ...extra,
  };
}

function post(body: unknown) {
  return new NextRequest('https://site.test/api/sorteios/pix', { method: 'POST', body: JSON.stringify(body) });
}
function get(pedidoId: string) {
  return new NextRequest(`https://site.test/api/sorteios/pix?pedido_id=${pedidoId}`);
}

beforeEach(() => {
  estado.pagamentos = {};
  estado.sessao = { user: { id: COMPRADOR, email: 'c@c.com' }, perfil: { role: 'cliente', status: 'ativo', nome: 'Comprador' } };
  estado.criar = async () => ({ id: 999, point_of_interaction: { transaction_data: { qr_code: 'PIX-COPIA-COLA', qr_code_base64: 'QkFTRTY0' } } });
  estado.ultimoCreate = null;
  estado.fake = criarSupabaseFake({
    tabelas: {
      sorteio_pedidos: [{ ...pedidoPendente(), id: 'ja-existente-outro-sorteio', sorteio_id: 'x' }],
      sorteio_bilhetes: [],
      webhook_logs: [],
      store_orders: [],
      pedidos: [],
    },
    rpc: {
      reservar_cotas_sorteio: (args) => {
        // o banco calcula o valor: R$ 5,00 por cota
        const qtd = Number(args.p_quantidade);
        estado.fake.tabelas.sorteio_pedidos.push({
          ...pedidoPendente({ id: PEDIDO, quantidade: qtd, valor_total: qtd * 5, gateway_payment_id: null, qr_code: null }),
        });
        return { data: { sucesso: true, pedido_id: PEDIDO, valor_total: qtd * 5, expira_em: futuro(), titulo: 'Rifa' }, error: null };
      },
      confirmar_pagamento_sorteio: () => {
        const p = estado.fake.tabelas.sorteio_pedidos.find((x) => x.id === PEDIDO)!;
        p.status = 'pago';
        estado.fake.tabelas.sorteio_bilhetes.push({ numero: 7, pedido_id: PEDIDO }, { numero: 42, pedido_id: PEDIDO });
        return { data: { sucesso: true, numeros: [7, 42] }, error: null };
      },
      estornar_pagamento_sorteio: () => ({ data: { sucesso: true }, error: null }),
      processar_estorno_pagamento: () => ({ data: { sucesso: true }, error: null }),
    },
  });
});

describe('validação de entrada', () => {
  it('aceita sorteio e quantidade válidos e ignora qualquer valor enviado', () => {
    expect(validarEntradaCompraSorteio({ sorteio_id: SORTEIO, quantidade: 3, valor_total: 0.01 })).toEqual({
      ok: true,
      sorteioId: SORTEIO,
      quantidade: 3,
    });
  });
  it('recusa id inválido, quantidade zero, fracionada ou acima do limite', () => {
    expect(validarEntradaCompraSorteio({ sorteio_id: 'abc', quantidade: 1 }).ok).toBe(false);
    expect(validarEntradaCompraSorteio({ sorteio_id: SORTEIO, quantidade: 0 }).ok).toBe(false);
    expect(validarEntradaCompraSorteio({ sorteio_id: SORTEIO, quantidade: 1.5 }).ok).toBe(false);
    expect(validarEntradaCompraSorteio({ sorteio_id: SORTEIO, quantidade: 101 }).ok).toBe(false);
    expect(validarEntradaCompraSorteio(null).ok).toBe(false);
  });
  it('traduz os erros de reserva', () => {
    expect(traduzirErroReserva('cotas_insuficientes', 2)).toMatch(/restam 2/);
    expect(traduzirErroReserva('cotas_insuficientes', 0)).toMatch(/esgotaram/);
    expect(traduzirErroReserva('muitos_pendentes')).toMatch(/aguardando/);
  });
});

describe('confirmarPedidoSorteio (antifraude)', () => {
  const pedido = { id: PEDIDO, valor_total: 15, status: 'pendente' as const };

  it('não libera pagamento não aprovado', async () => {
    const r = await confirmarPedidoSorteio(estado.fake.cliente as never, pedido, { id: 1, status: 'pending', external_reference: PEDIDO, transaction_amount: 15 });
    expect(r).toEqual({ sucesso: false, erro: 'pagamento_nao_aprovado' });
  });

  it('não libera com pagamento de outro pedido', async () => {
    const r = await confirmarPedidoSorteio(estado.fake.cliente as never, pedido, { id: 1, status: 'approved', external_reference: OUTRO_PEDIDO, transaction_amount: 15 });
    expect(r).toEqual({ sucesso: false, erro: 'referencia_divergente' });
  });

  it('não libera quando o valor pago é menor que o devido', async () => {
    const r = await confirmarPedidoSorteio(estado.fake.cliente as never, pedido, { id: 1, status: 'approved', external_reference: PEDIDO, transaction_amount: 5 });
    expect(r).toEqual({ sucesso: false, erro: 'valor_insuficiente' });
  });

  it('libera e envia ao banco o valor que o gateway confirmou', async () => {
    estado.fake.tabelas.sorteio_pedidos.push(pedidoPendente());
    const r = await confirmarPedidoSorteio(estado.fake.cliente as never, pedido, { id: 777, status: 'approved', external_reference: PEDIDO, transaction_amount: 15 });
    expect(r).toEqual({ sucesso: true, numeros: [7, 42] });
    const chamada = estado.fake.chamadasRpc.find((c) => c.nome === 'confirmar_pagamento_sorteio');
    expect(chamada?.args).toEqual({ p_pedido_id: PEDIDO, p_gateway_payment_id: '777', p_valor_pago: 15 });
  });
});

describe('POST /api/sorteios/pix', () => {
  it('exige login', async () => {
    estado.sessao = null;
    const { POST } = await import('@/app/api/sorteios/pix/route');
    expect((await POST(post({ sorteio_id: SORTEIO, quantidade: 1 }))).status).toBe(401);
  });

  it('reserva para o usuário da sessão e cobra o valor do banco (não o do cliente)', async () => {
    const { POST } = await import('@/app/api/sorteios/pix/route');
    const res = await POST(post({ sorteio_id: SORTEIO, quantidade: 3, valor_total: 0.01, usuario_id: ATACANTE }));
    const corpo = await res.json();
    expect(res.status).toBe(200);
    expect(corpo).toMatchObject({ pedido_id: PEDIDO, qr_code: 'PIX-COPIA-COLA', valor_total: 15 });

    const reserva = estado.fake.chamadasRpc.find((c) => c.nome === 'reservar_cotas_sorteio');
    expect(reserva?.args).toMatchObject({ p_sorteio_id: SORTEIO, p_usuario_id: COMPRADOR, p_quantidade: 3 });

    const cobranca = estado.ultimoCreate as { body: { transaction_amount: number; external_reference: string; payment_method_id: string } };
    expect(cobranca.body).toMatchObject({ transaction_amount: 15, external_reference: PEDIDO, payment_method_id: 'pix' });
  });

  it('devolve o motivo quando não há cotas', async () => {
    estado.fake = criarSupabaseFake({
      tabelas: { sorteio_pedidos: [] },
      rpc: { reservar_cotas_sorteio: () => ({ data: { sucesso: false, erro: 'cotas_insuficientes', restantes: 1 }, error: null }) },
    });
    const { POST } = await import('@/app/api/sorteios/pix/route');
    const res = await POST(post({ sorteio_id: SORTEIO, quantidade: 5 }));
    expect(res.status).toBe(409);
    expect((await res.json()).erro).toMatch(/restam 1/);
  });

  it('libera a reserva se o Mercado Pago não gerar o QR Code', async () => {
    estado.criar = async () => ({ id: 1 });
    const { POST } = await import('@/app/api/sorteios/pix/route');
    const res = await POST(post({ sorteio_id: SORTEIO, quantidade: 2 }));
    expect(res.status).toBe(502);
    expect(estado.fake.tabelas.sorteio_pedidos.find((p) => p.id === PEDIDO)?.status).toBe('cancelado');
  });
});

describe('POST /api/sorteios/gratuito (1 cota por pessoa)', () => {
  function postGratis(body: unknown) {
    return new NextRequest('https://site.test/api/sorteios/gratuito', { method: 'POST', body: JSON.stringify(body) });
  }

  it('exige login', async () => {
    estado.sessao = null;
    const { POST } = await import('@/app/api/sorteios/gratuito/route');
    expect((await POST(postGratis({ sorteio_id: SORTEIO }))).status).toBe(401);
  });

  it('resgata para o usuário da sessão (ignora usuário enviado pelo cliente)', async () => {
    estado.fake = criarSupabaseFake({
      rpc: { resgatar_cota_gratuita_sorteio: () => ({ data: { sucesso: true, numeros: [12] }, error: null }) },
    });
    const { POST } = await import('@/app/api/sorteios/gratuito/route');
    const res = await POST(postGratis({ sorteio_id: SORTEIO, usuario_id: ATACANTE, quantidade: 50 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ numeros: [12] });
    const chamada = estado.fake.chamadasRpc.find((c) => c.nome === 'resgatar_cota_gratuita_sorteio');
    expect(chamada?.args).toEqual({ p_sorteio_id: SORTEIO, p_usuario_id: COMPRADOR });
  });

  it('bloqueia o segundo resgate com mensagem clara', async () => {
    estado.fake = criarSupabaseFake({
      rpc: { resgatar_cota_gratuita_sorteio: () => ({ data: { sucesso: false, erro: 'ja_resgatou' }, error: null }) },
    });
    const { POST } = await import('@/app/api/sorteios/gratuito/route');
    const res = await POST(postGratis({ sorteio_id: SORTEIO }));
    expect(res.status).toBe(409);
    expect((await res.json()).erro).toMatch(/apenas|limite é 1/i);
  });

  it('explica quando a função do banco ainda não foi instalada (migração 036)', async () => {
    estado.fake = criarSupabaseFake({
      rpc: { resgatar_cota_gratuita_sorteio: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }) },
    });
    const { POST } = await import('@/app/api/sorteios/gratuito/route');
    const res = await POST(postGratis({ sorteio_id: SORTEIO }));
    expect(res.status).toBe(503);
    expect((await res.json()).erro).toMatch(/036/);
  });

  it('recusa sorteio inválido', async () => {
    const { POST } = await import('@/app/api/sorteios/gratuito/route');
    expect((await POST(postGratis({ sorteio_id: 'x' }))).status).toBe(400);
  });
});

describe('GET /api/sorteios/pix (status)', () => {
  it('não mostra pedido de outra pessoa (IDOR)', async () => {
    estado.fake.tabelas.sorteio_pedidos.push(pedidoPendente());
    estado.sessao = { user: { id: ATACANTE, email: 'a@a.com' }, perfil: { role: 'cliente', status: 'ativo' } };
    const { GET } = await import('@/app/api/sorteios/pix/route');
    expect((await GET(get(PEDIDO))).status).toBe(404);
  });

  it('pendente não entrega bilhete nenhum', async () => {
    estado.fake.tabelas.sorteio_pedidos.push(pedidoPendente());
    estado.pagamentos['777'] = { id: 777, status: 'pending', external_reference: PEDIDO, transaction_amount: 15 };
    const { GET } = await import('@/app/api/sorteios/pix/route');
    const corpo = await (await GET(get(PEDIDO))).json();
    expect(corpo).toMatchObject({ status: 'pendente', numeros: [] });
    expect(estado.fake.chamadasRpc.some((c) => c.nome === 'confirmar_pagamento_sorteio')).toBe(false);
  });

  it('pago no gateway → confirma e devolve os números', async () => {
    estado.fake.tabelas.sorteio_pedidos.push(pedidoPendente());
    estado.pagamentos['777'] = { id: 777, status: 'approved', external_reference: PEDIDO, transaction_amount: 15 };
    const { GET } = await import('@/app/api/sorteios/pix/route');
    const corpo = await (await GET(get(PEDIDO))).json();
    expect(corpo).toMatchObject({ status: 'pago', numeros: [7, 42], qr_code: null });
  });

  it('prazo vencido aparece como expirado e sem QR Code', async () => {
    estado.fake.tabelas.sorteio_pedidos.push(pedidoPendente({ gateway_payment_id: null, expira_em: new Date(Date.now() - 60_000).toISOString() }));
    const { GET } = await import('@/app/api/sorteios/pix/route');
    const corpo = await (await GET(get(PEDIDO))).json();
    expect(corpo).toMatchObject({ status: 'expirado', qr_code: null, numeros: [] });
  });
});
