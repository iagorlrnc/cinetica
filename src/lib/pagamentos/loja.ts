import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { ehUuid } from '@/lib/seguranca';
import { pagamentoCorrespondeAoPedido, type PagamentoGateway } from './comum';

export const MAX_ITENS_DISTINTOS_PEDIDO = 30;
export const MAX_UNIDADES_POR_ITEM = 20;

export interface ItemEntradaLoja {
  product_id?: unknown;
  size?: unknown;
  quantity?: unknown;
}

export interface ItemLojaValidado {
  product_id: string;
  name: string;
  size: string | null;
  quantity: number;
  price_cents: number;
  subtotal_cents: number;
  atletica_id: string;
}

export interface ProdutoBanco {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  atletica_id: string;
  sizes: unknown;
}

/**
 * Agrupa itens repetidos (mesmo produto + tamanho) e valida formato.
 * Função pura — exportada para testes.
 */
export function normalizarItensLoja(
  itens: unknown
): { ok: true; itens: { product_id: string; size: string | null; quantity: number }[] } | { ok: false; erro: string } {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { ok: false, erro: 'O carrinho está vazio ou os itens são inválidos.' };
  }
  if (itens.length > MAX_ITENS_DISTINTOS_PEDIDO) {
    return { ok: false, erro: `Limite de ${MAX_ITENS_DISTINTOS_PEDIDO} itens por pedido.` };
  }

  const mapa = new Map<string, { product_id: string; size: string | null; quantity: number }>();
  for (const bruto of itens as ItemEntradaLoja[]) {
    if (!bruto || !ehUuid(bruto.product_id)) {
      return { ok: false, erro: 'Identificador de produto inválido.' };
    }
    const qtd = parseInt(String(bruto.quantity ?? 1), 10);
    if (isNaN(qtd) || qtd < 1 || qtd > MAX_UNIDADES_POR_ITEM) {
      return { ok: false, erro: `Quantidade inválida (1 a ${MAX_UNIDADES_POR_ITEM} unidades por item).` };
    }
    const size = typeof bruto.size === 'string' && bruto.size.trim() ? bruto.size.trim().slice(0, 20) : null;
    const chave = `${bruto.product_id}::${size ?? ''}`;
    const atual = mapa.get(chave);
    if (atual) {
      atual.quantity += qtd;
      if (atual.quantity > MAX_UNIDADES_POR_ITEM) {
        return { ok: false, erro: `Quantidade inválida (1 a ${MAX_UNIDADES_POR_ITEM} unidades por item).` };
      }
    } else {
      mapa.set(chave, { product_id: bruto.product_id as string, size, quantity: qtd });
    }
  }
  return { ok: true, itens: [...mapa.values()] };
}

function tamanhosDoProduto(sizes: unknown): string[] {
  if (!Array.isArray(sizes)) return [];
  return sizes.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim());
}

/**
 * Valida itens contra o banco: produto ativo, preço do banco, tamanho existente,
 * estoque agregado por produto e regras de gratuidade.
 */
export async function validarItensLoja(
  supabase: SupabaseClient,
  itensBrutos: unknown,
  opcoes: { userId: string; modo: 'pago' | 'gratuito' }
): Promise<{ ok: true; itens: ItemLojaValidado[]; totalCentavos: number; atleticaId: string | null } | { ok: false; erro: string }> {
  const normalizados = normalizarItensLoja(itensBrutos);
  if (!normalizados.ok) return normalizados;

  const ids = [...new Set(normalizados.itens.map((i) => i.product_id))];
  const { data: produtos, error } = await supabase
    .from('store_products')
    .select('id, name, price, stock_quantity, is_active, atletica_id, sizes')
    .in('id', ids);

  if (error) {
    logger.error('Erro ao consultar produtos da loja', error);
    return { ok: false, erro: 'Não foi possível validar os produtos. Tente novamente.' };
  }

  const porId = new Map((produtos as ProdutoBanco[] | null || []).map((p) => [p.id, p]));
  const qtdPorProduto = new Map<string, number>();
  const validados: ItemLojaValidado[] = [];
  let total = 0;

  for (const item of normalizados.itens) {
    const prod = porId.get(item.product_id);
    if (!prod || !prod.is_active) {
      return { ok: false, erro: `Produto "${prod?.name || 'solicitado'}" indisponível ou inativo.` };
    }

    const tamanhos = tamanhosDoProduto(prod.sizes);
    if (tamanhos.length > 0 && (!item.size || !tamanhos.includes(item.size))) {
      return { ok: false, erro: `Selecione um tamanho válido para "${prod.name}".` };
    }
    const size = tamanhos.length > 0 ? item.size : null;

    const gratuito = Number(prod.price) === 0;
    if (opcoes.modo === 'gratuito' && !gratuito) {
      logger.security('Tentativa de resgatar produto pago via endpoint gratuito', { productId: prod.id, userId: opcoes.userId });
      return { ok: false, erro: `O produto "${prod.name}" não é gratuito. Prossiga pelo fluxo de pagamento.` };
    }

    const acumulado = (qtdPorProduto.get(prod.id) || 0) + item.quantity;
    qtdPorProduto.set(prod.id, acumulado);
    if (gratuito && acumulado > 1) {
      return { ok: false, erro: 'Produtos gratuitos possuem limite de 1 unidade por usuário.' };
    }
    if (acumulado > prod.stock_quantity) {
      return { ok: false, erro: `Estoque insuficiente para "${prod.name}". Disponível: ${prod.stock_quantity}.` };
    }

    const subtotal = Number(prod.price) * item.quantity;
    total += subtotal;
    validados.push({
      product_id: prod.id,
      name: prod.name,
      size,
      quantity: item.quantity,
      price_cents: Number(prod.price),
      subtotal_cents: subtotal,
      atletica_id: prod.atletica_id,
    });
  }

  const gratuitos = validados.filter((v) => v.price_cents === 0).map((v) => v.product_id);
  if (gratuitos.length > 0) {
    const { data: anteriores } = await supabase
      .from('store_order_items')
      .select('product_id, store_orders!inner(user_id, status)')
      .in('product_id', gratuitos)
      .eq('store_orders.user_id', opcoes.userId)
      .in('store_orders.status', ['paid', 'pending_payment']);
    if (anteriores && anteriores.length > 0) {
      return { ok: false, erro: 'Você já resgatou este produto gratuito. O limite é de 1 por usuário.' };
    }
  }

  if (opcoes.modo === 'pago' && total <= 0) {
    return { ok: false, erro: 'Valor do pedido inválido.' };
  }

  return { ok: true, itens: validados, totalCentavos: total, atleticaId: validados[0]?.atletica_id ?? null };
}

/** Cria pedido + itens; desfaz o pedido se os itens não puderem ser gravados. */
export async function criarPedidoLoja(
  supabase: SupabaseClient,
  dados: { userId: string; itens: ItemLojaValidado[]; totalCentavos: number; atleticaId: string | null; metodo: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true; orderId: string } | { ok: false; erro: string }> {
  const orderId = crypto.randomUUID();
  const { error: errOrder } = await supabase.from('store_orders').insert({
    id: orderId,
    user_id: dados.userId,
    atletica_id: dados.atleticaId,
    status: 'pending_payment',
    payment_method: dados.metodo,
    total_amount: dados.totalCentavos,
    metadata: { tipo: 'loja', ...(dados.metadata || {}) },
  });

  if (errOrder) {
    logger.error('Erro ao registrar store_order', errOrder);
    return { ok: false, erro: 'Falha ao criar registro do pedido.' };
  }

  const { error: errItems } = await supabase.from('store_order_items').insert(
    dados.itens.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name_snapshot: item.name,
      size: item.size,
      quantity: item.quantity,
      unit_price_snapshot: item.price_cents,
      subtotal: item.subtotal_cents,
    }))
  );

  if (errItems) {
    logger.error('Erro ao registrar itens do pedido da loja — revertendo pedido', errItems);
    await supabase.from('store_orders').delete().eq('id', orderId);
    return { ok: false, erro: 'Falha ao registrar os itens do pedido.' };
  }

  return { ok: true, orderId };
}

export interface PedidoLojaBanco {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
}

/**
 * Confirma um pedido da loja somente se o pagamento for do próprio pedido e cobrir o total.
 */
export async function confirmarPedidoLoja(
  supabase: SupabaseClient,
  pedido: PedidoLojaBanco,
  pagamento: PagamentoGateway
): Promise<{ sucesso: true; status: string } | { sucesso: false; erro: string }> {
  if (pedido.status === 'paid') return { sucesso: true, status: 'paid' };
  if (pagamento.status !== 'approved' || !pagamento.id) return { sucesso: false, erro: 'pagamento_nao_aprovado' };

  const verificacao = pagamentoCorrespondeAoPedido(pagamento, pedido.id, Number(pedido.total_amount) / 100);
  if (!verificacao.ok) {
    logger.security('Pagamento não corresponde ao pedido da loja — confirmação bloqueada', {
      order_id: pedido.id,
      gateway_transaction_id: String(pagamento.id),
      motivo: verificacao.motivo,
    });
    return { sucesso: false, erro: verificacao.motivo };
  }

  const { data, error } = await supabase.rpc('processar_pedido_loja_aprovado', {
    p_order_id: pedido.id,
    p_gateway_payment_id: String(pagamento.id),
    p_payment_method: String(pagamento.payment_method_id || 'mercadopago'),
  });

  if (error || !data?.sucesso) {
    const erro = data?.erro || error?.message || 'falha_rpc';
    logger.error('RPC processar_pedido_loja_aprovado não concluiu', null, { order_id: pedido.id, erro });
    return { sucesso: false, erro };
  }
  return { sucesso: true, status: 'paid' };
}
