/**
 * Utilidades compartilhadas pelos fluxos de pagamento (ingressos e loja).
 * Funções puras — cobertas por testes em src/__tests__/pagamentos-comum.test.ts
 */

export const EMAIL_PAYER_PADRAO = 'comprador@example.com';

/**
 * URL do webhook enviada ao Mercado Pago. Só existe com um domínio público configurado
 * (o Mercado Pago não aceita localhost); sem ele, a confirmação fica por conta da
 * consulta de status e do cron de reconciliação.
 */
export function obterUrlWebhook(): string | undefined {
  const bruto = process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  const dominio = bruto.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!dominio || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(dominio)) return undefined;
  return `https://${dominio}/api/webhook-mercadopago`;
}

export interface DadosPayer {
  email: string;
  first_name: string;
  last_name: string;
  identification?: { type: string; number: string };
}

function emailValido(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Monta o objeto `payer` do Mercado Pago a partir do perfil do banco.
 * Dados vindos do cliente (formulário do Brick) só são usados como complemento.
 */
export function montarPayer(
  perfil: { nome?: string | null; email?: string | null; cpf?: string | null } | null,
  emailSessao: string | null | undefined,
  dadosCliente?: { email?: unknown; first_name?: unknown; last_name?: unknown; identification?: { type?: unknown; number?: unknown } } | null
): DadosPayer {
  const nomeBase = (perfil?.nome || emailSessao || 'Comprador').trim();
  const partes = nomeBase.split(/\s+/);
  const primeiroNome = typeof dadosCliente?.first_name === 'string' && dadosCliente.first_name.trim()
    ? dadosCliente.first_name.trim().slice(0, 60)
    : partes[0] || 'Comprador';
  const sobrenome = typeof dadosCliente?.last_name === 'string' && dadosCliente.last_name.trim()
    ? dadosCliente.last_name.trim().slice(0, 60)
    : partes.slice(1).join(' ') || 'Cliente';

  let email = emailValido(dadosCliente?.email)
    ? dadosCliente!.email as string
    : emailValido(perfil?.email)
      ? perfil!.email as string
      : emailValido(emailSessao)
        ? emailSessao as string
        : EMAIL_PAYER_PADRAO;

  if (email.includes('@testuser.com') || email.includes('@placeholder')) {
    email = EMAIL_PAYER_PADRAO;
  }

  const docCliente = typeof dadosCliente?.identification?.number === 'string' ? dadosCliente.identification.number : '';
  const docNumero = (docCliente || perfil?.cpf || '').replace(/\D/g, '');
  const identification = docNumero.length === 11 || docNumero.length === 14
    ? { type: docNumero.length === 14 ? 'CNPJ' : 'CPF', number: docNumero }
    : undefined;

  return { email, first_name: primeiroNome, last_name: sobrenome, identification };
}

/** Normaliza o payment_method_id enviado pelo Card Brick. */
export function normalizarMetodoCartao(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.toLowerCase().trim();
  if (!v || v === 'undefined' || v === 'null') return null;
  if (v === 'mastercard') return 'master';
  if (!/^[a-z_]{2,30}$/.test(v)) return null;
  return v;
}

export function normalizarParcelas(valor: unknown): number {
  const n = parseInt(String(valor ?? '1'), 10);
  if (isNaN(n) || n < 1) return 1;
  return Math.min(n, 12);
}

export function normalizarIssuer(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  const v = String(valor).trim();
  if (!v || v === 'undefined' || v === 'null') return undefined;
  return /^\d{1,12}$/.test(v) ? v : undefined;
}

export interface PagamentoGateway {
  id?: number | string | null;
  status?: string | null;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  metadata?: Record<string, unknown> | null;
  payer?: { email?: string | null } | null;
  date_approved?: string | null;
}

/**
 * Confere se um pagamento do gateway realmente pertence a um pedido local e cobre o valor devido.
 * Impede reutilizar o payment_id de outra compra (mais barata) para liberar um pedido.
 */
export function pagamentoCorrespondeAoPedido(
  pagamento: PagamentoGateway,
  pedidoId: string,
  valorDevidoReais: number
): { ok: true } | { ok: false; motivo: string } {
  const metadataPedido = pagamento.metadata?.pedido_id ?? pagamento.metadata?.order_id;
  const referencia = pagamento.external_reference;
  if (referencia !== pedidoId && metadataPedido !== pedidoId) {
    return { ok: false, motivo: 'referencia_divergente' };
  }
  const pago = Number(pagamento.transaction_amount ?? 0);
  if (!Number.isFinite(pago) || pago + 0.01 < Number(valorDevidoReais)) {
    return { ok: false, motivo: 'valor_insuficiente' };
  }
  return { ok: true };
}

export const STATUS_GATEWAY_CANCELADOS = ['refunded', 'charged_back', 'cancelled', 'rejected'];
export const STATUS_GATEWAY_EM_ANALISE = ['in_process', 'pending', 'authorized', 'in_mediation'];
