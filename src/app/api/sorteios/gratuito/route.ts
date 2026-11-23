import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { ehUuid, obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import { ehFuncaoAusente, MENSAGEM_SORTEIO_INDISPONIVEL, traduzirErroReserva } from '@/lib/pagamentos/sorteios';

/** Resgate de cota em sorteio gratuito: 1 por usuário (garantido no banco). */
export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limiteIp = await limitarRequisicao(`sorteio_gratis_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 20 });
  if (!limiteIp.permitido) return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });

  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) return NextResponse.json({ erro: 'Entre na sua conta para resgatar.' }, { status: 401 });
    if (sessao.perfil?.status === 'bloqueado') return NextResponse.json({ erro: 'Sua conta está bloqueada.' }, { status: 403 });

    const limiteUsuario = await limitarRequisicao(`sorteio_gratis_user:${sessao.user.id}`, { janelaMs: 60_000, maxRequisicoes: 5 });
    if (!limiteUsuario.permitido) return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });

    const body = await request.json().catch(() => null);
    const sorteioId = body && typeof body === 'object' ? (body as Record<string, unknown>).sorteio_id : null;
    if (!ehUuid(sorteioId)) return NextResponse.json({ erro: 'Sorteio inválido.' }, { status: 400 });

    const { data, error } = await criarClienteAdmin().rpc('resgatar_cota_gratuita_sorteio', {
      p_sorteio_id: sorteioId,
      p_usuario_id: sessao.user.id,
    });
    const r = data as { sucesso?: boolean; erro?: string; restantes?: number; numeros?: number[] } | null;
    if (ehFuncaoAusente(error)) {
      logger.error('Função resgatar_cota_gratuita_sorteio ausente: aplique supabase/migracoes/036_sorteio_pix.sql', error);
      return NextResponse.json({ erro: MENSAGEM_SORTEIO_INDISPONIVEL }, { status: 503 });
    }
    if (error || !r?.sucesso) {
      if (error) logger.error('Falha no resgate gratuito de cota', error, { userId: sessao.user.id });
      return NextResponse.json({ erro: traduzirErroReserva(r?.erro, r?.restantes) }, { status: error ? 500 : 409 });
    }

    logger.info('Cota gratuita resgatada', { userId: sessao.user.id, sorteioId });
    return NextResponse.json({ numeros: r.numeros || [] });
  } catch (err) {
    logger.error('Erro no resgate gratuito de cota', err);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
