/**
 * Testes de integração das rotas de API com Supabase e Mercado Pago simulados.
 * Reproduzem os ataques encontrados na auditoria e garantem que estão bloqueados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { criarSupabaseFake } from './helpers/supabaseFake';

const estado = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import('./helpers/supabaseFake').criarSupabaseFake>,
  sessao: null as null | { user: { id: string; email: string }; perfil: Record<string, unknown> | null },
  pagamentos: {} as Record<string, Record<string, unknown>>,
  buscas: [] as Record<string, unknown>[],
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
    search: async () => ({ results: estado.buscas }),
    create: async () => ({ id: 1 }),
  },
}));

const SECRET_WEBHOOK = 'segredo-webhook-de-teste';
const PEDIDO_CARO = '40000000-0000-4000-8000-000000000001';
const PEDIDO_BARATO = '40000000-0000-4000-8000-000000000002';
const EVENTO = '50000000-0000-4000-8000-000000000001';
const LOTE = '60000000-0000-4000-8000-000000000001';
const ATACANTE = '70000000-0000-4000-8000-000000000001';

function assinar(dataId: string, requestId = 'req-1') {
  const ts = Math.floor(Date.now() / 1000).toString();
  const v1 = crypto.createHmac('sha256', SECRET_WEBHOOK).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

function requisicaoWebhook(dataId: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://site.test/api/webhook-mercadopago', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
  });
}

const pedidoCaro = {
  id: PEDIDO_CARO, comprador_id: ATACANTE, evento_id: EVENTO, lote_id: LOTE,
  quantidade: 2, valor_total: 440, status: 'pendente', gateway_payment_id: null, criado_em: new Date().toISOString(),
};

beforeEach(() => {
  process.env.QR_CODE_SECRET = 'segredo-de-teste-com-mais-de-16-chars';
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET_WEBHOOK;
  estado.pagamentos = {};
  estado.buscas = [];
  estado.sessao = null;
  estado.fake = criarSupabaseFake({
    tabelas: { pedidos: [{ ...pedidoCaro }], store_orders: [], webhook_logs: [] },
    rpc: {
      processar_pagamento_aprovado: () => ({ data: { sucesso: true, ja_processado: false, ingressos_ids: ['x'] }, error: null }),
      processar_pedido_loja_aprovado: () => ({ data: { sucesso: true }, error: null }),
      processar_estorno_pagamento: () => ({ data: { sucesso: true }, error: null }),
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/webhook-mercadopago', () => {
  it('rejeita (401) webhook sem assinatura em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const { POST } = await import('@/app/api/webhook-mercadopago/route');
    const res = await POST(requisicaoWebhook('123'));
    expect(res.status).toBe(401);
    expect(estado.fake.chamadasRpc).toHaveLength(0);
  });

  it('rejeita (401) assinatura forjada', async () => {
    const { POST } = await import('@/app/api/webhook-mercadopago/route');
    const res = await POST(requisicaoWebhook('123', { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r' }));
    expect(res.status).toBe(401);
  });

  it('rejeita data.id que não é numérico (injeção de filtro)', async () => {
    const { POST } = await import('@/app/api/webhook-mercadopago/route');
    const id = '1,status.eq.aprovado';
    const res = await POST(requisicaoWebhook(id, assinar(id)));
    expect(res.status).toBe(400);
  });

  it('NÃO libera ingressos quando o valor pago é menor que o do pedido', async () => {
    estado.pagamentos['900'] = { id: 900, status: 'approved', external_reference: PEDIDO_CARO, transaction_amount: 1, payment_method_id: 'pix' };
    const { POST } = await import('@/app/api/webhook-mercadopago/route');
    const res = await POST(requisicaoWebhook('900', assinar('900')));
    expect(res.status).toBe(200);
    expect(estado.fake.chamadasRpc.filter((c) => c.nome === 'processar_pagamento_aprovado')).toHaveLength(0);
  });

  it('libera ingressos para pagamento legítimo e assinado', async () => {
    estado.pagamentos['901'] = { id: 901, status: 'approved', external_reference: PEDIDO_CARO, transaction_amount: 440, payment_method_id: 'pix' };
    const { POST } = await import('@/app/api/webhook-mercadopago/route');
    const res = await POST(requisicaoWebhook('901', assinar('901')));
    expect(res.status).toBe(200);
    const chamadas = estado.fake.chamadasRpc.filter((c) => c.nome === 'processar_pagamento_aprovado');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].args.p_pedido_id).toBe(PEDIDO_CARO);
  });

  it('estorno aciona a RPC de estorno', async () => {
    estado.pagamentos['902'] = { id: 902, status: 'refunded', external_reference: PEDIDO_CARO, transaction_amount: 440 };
    const { POST } = await import('@/app/api/webhook-mercadopago/route');
    await POST(requisicaoWebhook('902', assinar('902')));
    expect(estado.fake.chamadasRpc.map((c) => c.nome)).toContain('processar_estorno_pagamento');
  });
});

describe('GET /api/consultar-status-pedido', () => {
  function req(qs: string) {
    return new NextRequest(`https://site.test/api/consultar-status-pedido?${qs}`);
  }

  it('exige autenticação', async () => {
    const { GET } = await import('@/app/api/consultar-status-pedido/route');
    expect((await GET(req(`pedido_id=${PEDIDO_CARO}`))).status).toBe(401);
  });

  it('ATAQUE: payment_id de compra barata não libera pedido caro', async () => {
    estado.sessao = { user: { id: ATACANTE, email: 'a@a.com' }, perfil: { role: 'cliente', status: 'ativo' } };
    estado.pagamentos['555'] = { id: 555, status: 'approved', external_reference: PEDIDO_BARATO, transaction_amount: 1 };
    const { GET } = await import('@/app/api/consultar-status-pedido/route');
    const res = await GET(req(`pedido_id=${PEDIDO_CARO}&payment_id=555&evento_id=${EVENTO}&lote_id=${LOTE}`));
    const body = await res.json();
    expect(body.status_pedido).toBe('aguardando');
    expect(estado.fake.chamadasRpc).toHaveLength(0);
  });

  it('ATAQUE: não cria pedido/ingresso a partir de evento_id e lote_id na URL', async () => {
    estado.sessao = { user: { id: ATACANTE, email: 'a@a.com' }, perfil: { role: 'cliente', status: 'ativo' } };
    estado.fake = criarSupabaseFake({ tabelas: { pedidos: [] } });
    estado.pagamentos['556'] = { id: 556, status: 'approved', external_reference: PEDIDO_BARATO, transaction_amount: 1 };
    const { GET } = await import('@/app/api/consultar-status-pedido/route');
    const res = await GET(req(`payment_id=556&evento_id=${EVENTO}&lote_id=${LOTE}&comprador_id=${ATACANTE}`));
    const body = await res.json();
    expect(body.status_pedido).toBeNull();
    expect(estado.fake.escritas).toHaveLength(0);
    expect(estado.fake.chamadasRpc).toHaveLength(0);
  });

  it('IDOR: não revela pedido de outro usuário', async () => {
    estado.sessao = { user: { id: '80000000-0000-4000-8000-000000000001', email: 'b@b.com' }, perfil: { role: 'cliente', status: 'ativo' } };
    const { GET } = await import('@/app/api/consultar-status-pedido/route');
    expect((await GET(req(`pedido_id=${PEDIDO_CARO}`))).status).toBe(403);
  });

  it('reconcilia pagamento aprovado do próprio pedido', async () => {
    estado.sessao = { user: { id: ATACANTE, email: 'a@a.com' }, perfil: { role: 'cliente', status: 'ativo' } };
    estado.buscas = [{ id: 777, status: 'approved', external_reference: PEDIDO_CARO, transaction_amount: 440 }];
    const { GET } = await import('@/app/api/consultar-status-pedido/route');
    const body = await (await GET(req(`pedido_id=${PEDIDO_CARO}`))).json();
    expect(body.status_pedido).toBe('aprovado');
  });
});

describe('POST /api/diretor/lotes', () => {
  const ATL_A = '90000000-0000-4000-8000-00000000000a';
  const ATL_B = '90000000-0000-4000-8000-00000000000b';
  const EVT_A = '91000000-0000-4000-8000-00000000000a';
  const EVT_B = '91000000-0000-4000-8000-00000000000b';
  const LOTE_B = '92000000-0000-4000-8000-00000000000b';

  function req(body: Record<string, unknown>) {
    return new NextRequest('https://site.test/api/diretor/lotes', { method: 'POST', body: JSON.stringify(body) });
  }

  beforeEach(() => {
    estado.fake = criarSupabaseFake({
      tabelas: {
        eventos: [{ id: EVT_A, atletica_id: ATL_A }, { id: EVT_B, atletica_id: ATL_B }],
        lotes_ingresso: [{ id: LOTE_B, evento_id: EVT_B, nome_lote: 'VIP', preco: 200, quantidade_total: 10, quantidade_vendida: 0 }],
      },
    });
  });

  it('IDOR: diretor não altera lote de outra atlética informando o próprio evento', async () => {
    estado.sessao = { user: { id: 'u', email: 'd@d.com' }, perfil: { role: 'diretor', status: 'ativo', atletica_id: ATL_A } };
    const { POST } = await import('@/app/api/diretor/lotes/route');
    const res = await POST(req({ evento_id: EVT_A, lote_id: LOTE_B, nome_lote: 'Hack', preco: 0, quantidade_total: 10 }));
    expect(res.status).toBe(404);
    expect(estado.fake.tabelas.lotes_ingresso[0]).toMatchObject({ preco: 200, nome_lote: 'VIP' });
  });

  it('diretor pendente não gerencia lotes', async () => {
    estado.sessao = { user: { id: 'u', email: 'd@d.com' }, perfil: { role: 'diretor', status: 'pendente', atletica_id: ATL_B } };
    const { POST } = await import('@/app/api/diretor/lotes/route');
    const res = await POST(req({ evento_id: EVT_B, lote_id: LOTE_B, nome_lote: 'X', preco: 1, quantidade_total: 10 }));
    expect(res.status).toBe(403);
  });

  it('diretor ativo altera o lote da própria atlética', async () => {
    estado.sessao = { user: { id: 'u', email: 'd@d.com' }, perfil: { role: 'diretor', status: 'ativo', atletica_id: ATL_B } };
    const { POST } = await import('@/app/api/diretor/lotes/route');
    const res = await POST(req({ evento_id: EVT_B, lote_id: LOTE_B, nome_lote: 'VIP 2', preco: 250, quantidade_total: 20 }));
    expect(res.status).toBe(200);
    expect(estado.fake.tabelas.lotes_ingresso[0]).toMatchObject({ preco: 250, nome_lote: 'VIP 2' });
  });
});
