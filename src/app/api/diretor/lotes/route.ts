import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi, ehGestorAtivo, podeGerenciarAtletica } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { ehUuid, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';

const PRECO_MAXIMO = 100_000;
const QUANTIDADE_MAXIMA = 1_000_000;

/** Cria ou atualiza um lote. O lote precisa pertencer ao evento — e o evento à atlética do diretor. */
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
    const { lote_id, evento_id, nome_lote, preco, quantidade_total, ativo } = body;

    if (!ehUuid(evento_id)) {
      return NextResponse.json({ erro: 'ID do evento inválido ou ausente.' }, { status: 400 });
    }
    if (typeof nome_lote !== 'string' || !nome_lote.trim() || nome_lote.trim().length > 80) {
      return NextResponse.json({ erro: 'Nome do lote é obrigatório (até 80 caracteres).' }, { status: 400 });
    }
    const precoNum = Math.round(Number(preco) * 100) / 100;
    if (!Number.isFinite(precoNum) || precoNum < 0 || precoNum > PRECO_MAXIMO) {
      return NextResponse.json({ erro: 'Preço inválido.' }, { status: 400 });
    }
    const qtdNum = parseInt(String(quantidade_total), 10);
    if (isNaN(qtdNum) || qtdNum < 1 || qtdNum > QUANTIDADE_MAXIMA) {
      return NextResponse.json({ erro: 'Quantidade total deve ser de no mínimo 1.' }, { status: 400 });
    }

    const supabase = criarClienteAdmin();
    const { data: evento } = await supabase.from('eventos').select('id, atletica_id').eq('id', evento_id).maybeSingle();
    if (!evento) {
      return NextResponse.json({ erro: 'Evento não encontrado.' }, { status: 404 });
    }
    if (!podeGerenciarAtletica(sessao.perfil, evento.atletica_id)) {
      logger.security('Tentativa não autorizada de gerenciar lote de outra atlética', { userId: sessao.user.id, eventoId: evento_id });
      return NextResponse.json({ erro: 'Você não tem permissão para gerenciar lotes deste evento.' }, { status: 403 });
    }

    const dados = {
      nome_lote: nome_lote.trim(),
      preco: precoNum,
      quantidade_total: qtdNum,
      ativo: ativo !== undefined ? Boolean(ativo) : true,
    };

    if (lote_id !== undefined && lote_id !== null && lote_id !== '') {
      if (!ehUuid(lote_id)) {
        return NextResponse.json({ erro: 'ID do lote inválido.' }, { status: 400 });
      }
      // O lote precisa pertencer ao evento validado acima (impede IDOR entre atléticas)
      const { data: loteAtual } = await supabase
        .from('lotes_ingresso')
        .select('id, quantidade_vendida')
        .eq('id', lote_id)
        .eq('evento_id', evento_id)
        .maybeSingle();

      if (!loteAtual) {
        return NextResponse.json({ erro: 'Lote não encontrado neste evento.' }, { status: 404 });
      }
      if (qtdNum < loteAtual.quantidade_vendida) {
        return NextResponse.json({
          erro: `A quantidade total não pode ser menor que os ingressos já vendidos (${loteAtual.quantidade_vendida}).`,
        }, { status: 400 });
      }

      const { data: lote, error } = await supabase
        .from('lotes_ingresso')
        .update(dados)
        .eq('id', lote_id)
        .eq('evento_id', evento_id)
        .select('*')
        .single();

      if (error) {
        logger.error('Erro ao atualizar lote', error);
        return NextResponse.json({ erro: 'Erro ao atualizar lote' }, { status: 500 });
      }
      return NextResponse.json({ sucesso: true, lote, mensagem: 'Lote atualizado com sucesso' });
    }

    const { count } = await supabase
      .from('lotes_ingresso')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento_id);

    const { data: novoLote, error } = await supabase
      .from('lotes_ingresso')
      .insert({ evento_id, ...dados, quantidade_vendida: 0, ordem: count || 0 })
      .select('*')
      .single();

    if (error) {
      logger.error('Erro ao criar lote', error);
      return NextResponse.json({ erro: 'Erro ao criar lote' }, { status: 500 });
    }
    return NextResponse.json({ sucesso: true, lote: novoLote, mensagem: 'Novo lote criado com sucesso' });
  } catch (error) {
    logger.error('Erro interno na API de lotes', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }
    if (!ehGestorAtivo(sessao.perfil)) {
      return NextResponse.json({ erro: 'Acesso restrito a diretores ou administradores' }, { status: 403 });
    }

    const loteId = request.nextUrl.searchParams.get('lote_id');
    if (!ehUuid(loteId)) {
      return NextResponse.json({ erro: 'ID do lote inválido' }, { status: 400 });
    }

    const supabase = criarClienteAdmin();
    const { data: lote } = await supabase
      .from('lotes_ingresso')
      .select('id, quantidade_vendida, evento_id, eventos(atletica_id)')
      .eq('id', loteId)
      .maybeSingle();

    if (!lote) {
      return NextResponse.json({ erro: 'Lote não encontrado' }, { status: 404 });
    }

    const eventoRel = lote.eventos as { atletica_id?: string } | { atletica_id?: string }[] | null;
    const atleticaEvento = Array.isArray(eventoRel) ? eventoRel[0]?.atletica_id : eventoRel?.atletica_id;
    if (!podeGerenciarAtletica(sessao.perfil, atleticaEvento)) {
      return NextResponse.json({ erro: 'Você não tem permissão para excluir este lote' }, { status: 403 });
    }

    if (lote.quantidade_vendida > 0) {
      return NextResponse.json({ erro: 'Não é possível excluir um lote que já possui ingressos vendidos' }, { status: 400 });
    }

    const { count: pedidosVinculados } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('lote_id', loteId);
    if ((pedidosVinculados || 0) > 0) {
      return NextResponse.json({ erro: 'Este lote possui pedidos registrados. Desative-o em vez de excluir.' }, { status: 400 });
    }

    const { error } = await supabase.from('lotes_ingresso').delete().eq('id', loteId);
    if (error) {
      return NextResponse.json({ erro: 'Erro ao excluir lote' }, { status: 500 });
    }
    return NextResponse.json({ sucesso: true, mensagem: 'Lote excluído com sucesso' });
  } catch (error) {
    logger.error('Erro interno ao excluir lote', error);
    return NextResponse.json({ erro: 'Erro interno ao excluir lote' }, { status: 500 });
  }
}
