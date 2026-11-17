import { NextRequest, NextResponse } from 'next/server';
import {
  obterIPCliente,
  verificarRateLimit,
  registrarErroRateLimit,
  registrarSucessoRateLimit,
  verificarRateLimitEmailRecuperacao,
  registrarEnvioEmailRecuperacao,
  limitarRequisicao,
} from '@/lib/rateLimit';
import { validarTurnstileToken } from '@/lib/turnstile';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const MSG_CAPTCHA = 'Verificação de segurança (captcha) falhou. Recarregue a página e tente novamente.';

function emailNormalizado(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const e = valor.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Captcha é obrigatório sempre que o servidor tem a secret do Turnstile configurada. */
async function captchaValido(token: unknown, ip: string): Promise<boolean> {
  if (!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    return process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
  }
  return typeof token === 'string' && token.length > 0 && token.length < 4096 && validarTurnstileToken(token, ip);
}

export async function GET(request: NextRequest) {
  const ip = obterIPCliente(request);
  const email = emailNormalizado(request.nextUrl.searchParams.get('email'));

  if (email) {
    const statusEmail = verificarRateLimitEmailRecuperacao(email);
    if (statusEmail.bloqueado) return NextResponse.json(statusEmail, { status: 429 });
  }

  const status = verificarRateLimit(ip);
  return NextResponse.json(status, { status: status.bloqueado ? 429 : 200 });
}

export async function POST(request: NextRequest) {
  const ip = obterIPCliente(request);

  // Proteção do próprio endpoint contra abuso
  const limiteEndpoint = await limitarRequisicao(`auth_rl_endpoint:${ip}`, { janelaMs: 60_000, maxRequisicoes: 40 });
  if (!limiteEndpoint.permitido) {
    return NextResponse.json(limiteEndpoint, { status: 429 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const acao = body.acao;
  const ehAdmin = body.tipo === 'admin' || body.ehAdmin === true;
  const email = emailNormalizado(body.email);

  if (acao === 'registrar_recuperacao') {
    if (!email) return NextResponse.json({ bloqueado: false, segundosRestantes: 60 });
    return NextResponse.json(registrarEnvioEmailRecuperacao(email));
  }

  if (acao === 'verificar_recuperacao') {
    if (!(await captchaValido(body.turnstileToken, ip))) {
      return NextResponse.json({ bloqueado: true, segundosRestantes: 0, tentativasConsecutivas: 0, mensagem: MSG_CAPTCHA }, { status: 403 });
    }
    const statusIp = verificarRateLimit(ip);
    if (statusIp.bloqueado) return NextResponse.json(statusIp, { status: 429 });
    if (email) {
      const statusEmail = verificarRateLimitEmailRecuperacao(email);
      if (statusEmail.bloqueado) return NextResponse.json(statusEmail, { status: 429 });
    }
    return NextResponse.json({ bloqueado: false, segundosRestantes: 0 });
  }

  if (acao === 'verificar') {
    if (!(await captchaValido(body.turnstileToken, ip))) {
      return NextResponse.json({ bloqueado: true, segundosRestantes: 0, tentativasConsecutivas: 0, mensagem: MSG_CAPTCHA }, { status: 403 });
    }
    const status = verificarRateLimit(ip);
    return NextResponse.json(status, { status: status.bloqueado ? 429 : 200 });
  }

  if (acao === 'registrar_erro') {
    const status = registrarErroRateLimit(ip, ehAdmin);
    return NextResponse.json(status, { status: status.bloqueado ? 429 : 200 });
  }

  if (acao === 'registrar_sucesso') {
    // Só zera o contador quando existe de fato uma sessão autenticada (impede reset arbitrário)
    try {
      const supabase = await criarClienteServidor();
      const { data } = await supabase.auth.getUser();
      if (data?.user) registrarSucessoRateLimit(ip);
    } catch {
      // sem sessão: não zera
    }
    return NextResponse.json({ bloqueado: false, segundosRestantes: 0, tentativasConsecutivas: 0 });
  }

  const status = verificarRateLimit(ip);
  return NextResponse.json(status, { status: status.bloqueado ? 429 : 200 });
}
