import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi, ehGestorAtivo } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { ehUuid, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';

/** Marca um pedido pago da loja como entregue (irreversível). */
export async function POST(request: NextRequest) {
  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }
    if (!ehGestorAtivo(sessao.perfil)) {
      return NextResponse.json({ erro: 'Acesso restrito para diretores e administradores ativos.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = body?.order_id;
    if (!ehUuid(orderId)) {
      return NextResponse.json({ erro: 'ID de pedido inválido.' }, { status: 400 });
    }

    const admin = criarClienteAdmin();
    const { data: order } = await admin
      .from('store_orders')
      .select('id, atletica_id, status, metadata')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 });
    }
    if (order.status !== 'paid') {
      return NextResponse.json({ erro: 'Apenas pedidos pagos podem ser marcados como entregues.' }, { status: 400 });
    }

    const metadataAtual = order.metadata && typeof order.metadata === 'object' ? order.metadata as Record<string, unknown> : {};
    if (metadataAtual.entregue) {
      return NextResponse.json({ erro: 'Este pedido já foi marcado como entregue e não pode ser desmarcado.' }, { status: 400 });
    }

    const { data: atualizado, error } = await admin
      .from('store_orders')
      .update({
        metadata: {
          ...metadataAtual,
          entregue: true,
          entregue_em: new Date().toISOString(),
          entregue_por_nome: sessao.perfil?.nome || 'Diretoria',
          entregue_por_id: sessao.user.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*, user:profiles(id, nome, email, telefone), items:store_order_items(*)')
      .single();

    if (error || !atualizado) {
      logger.error('Erro ao atualizar entrega do pedido', error);
      return NextResponse.json({ erro: 'Falha ao atualizar status de entrega.' }, { status: 500 });
    }

    logger.info('Pedido da loja marcado como entregue', { orderId, usuarioId: sessao.user.id });
    return NextResponse.json({ sucesso: true, mensagem: 'Pedido marcado como entregue!', order: atualizado });
  } catch (error) {
    logger.error('Erro inesperado ao atualizar entrega do pedido', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
