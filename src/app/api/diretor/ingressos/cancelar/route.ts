import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi, ehGestorAtivo, podeGerenciarAtletica } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { ehUuid, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';

/** Cancelamento de ingresso pelo diretor da atlética do evento ou por admin. */
export async function POST(request: NextRequest) {
  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) {
      return NextResponse.json({ erro: 'Sessão expirada. Faça login novamente para continuar.' }, { status: 401 });
    }
    if (!ehGestorAtivo(sessao.perfil)) {
      return NextResponse.json({ erro: 'Acesso restrito a diretores ou administradores ativos.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const ingressoId = body?.ingresso_id;
    if (!ehUuid(ingressoId)) {
      return NextResponse.json({ erro: 'ID do ingresso inválido ou ausente.' }, { status: 400 });
    }

    const supabase = criarClienteAdmin();
    const { data: ingresso } = await supabase
      .from('ingressos')
      .select('id, status, evento:eventos(id, atletica_id)')
      .eq('id', ingressoId)
      .maybeSingle();

    if (!ingresso) {
      return NextResponse.json({ erro: 'Ingresso não encontrado.' }, { status: 404 });
    }

    const evento = Array.isArray(ingresso.evento) ? ingresso.evento[0] : ingresso.evento;
    if (!podeGerenciarAtletica(sessao.perfil, (evento as { atletica_id?: string } | null)?.atletica_id)) {
      logger.security('Tentativa não autorizada de cancelar ingresso de outra atlética', { userId: sessao.user.id, ingressoId });
      return NextResponse.json({ erro: 'Você não tem permissão para cancelar ingressos deste evento.' }, { status: 403 });
    }

    if (ingresso.status === 'cancelado') {
      return NextResponse.json({ sucesso: true, mensagem: 'Ingresso já estava cancelado.' });
    }

    const { error } = await supabase
      .from('ingressos')
      .update({ status: 'cancelado' })
      .eq('id', ingressoId)
      .neq('status', 'cancelado');

    if (error) {
      logger.error('Erro ao cancelar ingresso', error);
      return NextResponse.json({ erro: 'Falha ao atualizar o status do ingresso.' }, { status: 500 });
    }

    logger.info('Ingresso cancelado pela diretoria', { ingressoId, por: sessao.user.id });
    return NextResponse.json({ sucesso: true, mensagem: 'Ingresso cancelado com sucesso.' });
  } catch (err: unknown) {
    logger.error('Exceção ao cancelar ingresso', err);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
