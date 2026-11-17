import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import {
  calcularValoresPedido,
  criarOuReutilizarPedidoPendente,
  liberarIngressosDoPagamento,
  traduzirErroLiberacao,
  validarCompraIngresso,
} from '@/lib/pagamentos/ingressos';

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);

  const limiteIp = await limitarRequisicao(`checkout_free_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 20 });
  if (!limiteIp.permitido) {
    return NextResponse.json({ erro: 'Muitas tentativas em curto intervalo. Aguarde um minuto.' }, { status: 429 });
  }

  try {
    const sessao = await obterSessaoApi();
    if (!sessao) {
      return NextResponse.json({ erro: 'Autenticação necessária para reservar ingressos.' }, { status: 401 });
    }
    const { user, perfil } = sessao;

    if (!perfil) {
      return NextResponse.json({ erro: 'Complete seu cadastro antes de reservar ingressos.' }, { status: 400 });
    }
    if (perfil.status === 'bloqueado') {
      return NextResponse.json({ erro: 'Sua conta está bloqueada.' }, { status: 403 });
    }

    const limiteUsuario = await limitarRequisicao(`checkout_free_user:${user.id}`, { janelaMs: 60_000, maxRequisicoes: 5 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.comprador_id && body.comprador_id !== user.id) {
      logger.security('IDOR prevenido ao reservar ingresso gratuito', { caller: user.id, target: String(body.comprador_id) });
      return NextResponse.json({ erro: 'Ação não autorizada para este comprador.' }, { status: 403 });
    }

    if (parseInt(String(body.quantidade), 10) !== 1) {
      return NextResponse.json({ erro: 'Ingressos gratuitos possuem limite estrito de apenas 1 por usuário.' }, { status: 400 });
    }

    const supabase = criarClienteAdmin();
    const validacao = await validarCompraIngresso(supabase, {
      eventoId: body.evento_id,
      loteId: body.lote_id,
      quantidade: 1,
    });
    if (!validacao.ok) {
      return NextResponse.json({ erro: validacao.erro }, { status: validacao.status });
    }
    const { evento, lote } = validacao;

    if (lote.preco !== 0) {
      logger.security('Tentativa de reservar lote pago via endpoint gratuito', { loteId: lote.id, userId: user.id });
      return NextResponse.json({ erro: 'Este lote não é gratuito. Prossiga pelo fluxo de pagamento regular.' }, { status: 400 });
    }

    const { data: existentes } = await supabase
      .from('ingressos')
      .select('id')
      .eq('comprador_id', user.id)
      .eq('evento_id', evento.id)
      .neq('status', 'cancelado')
      .limit(1);

    if (existentes && existentes.length > 0) {
      return NextResponse.json(
        { erro: 'Você já possui 1 ingresso garantido para este evento. Ingressos gratuitos têm limite de 1 por usuário.' },
        { status: 400 }
      );
    }

    const pedido = await criarOuReutilizarPedidoPendente(supabase, {
      compradorId: user.id,
      eventoId: evento.id,
      loteId: lote.id,
      quantidade: 1,
      valores: calcularValoresPedido(0, 1),
      metodo: 'gratuito',
    });
    if (!pedido.ok) {
      return NextResponse.json({ erro: pedido.erro }, { status: 500 });
    }

    const freeGatewayId = `FREE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const liberacao = await liberarIngressosDoPagamento(
      supabase,
      { id: pedido.pedidoId, comprador_id: user.id, evento_id: evento.id, lote_id: lote.id, quantidade: 1, valor_total: 0, status: 'pendente' },
      { id: freeGatewayId, status: 'approved', external_reference: pedido.pedidoId, transaction_amount: 0, payment_method_id: 'gratuito' },
      { emailComprador: perfil.email || user.email }
    );

    if (!liberacao.sucesso) {
      const traducao = traduzirErroLiberacao(liberacao.erro);
      await supabase.from('pedidos').update({ status: 'recusado' }).eq('id', pedido.pedidoId).eq('status', 'pendente');
      return NextResponse.json({ erro: traducao.mensagem }, { status: 409 });
    }

    logger.info('Ingresso gratuito reservado', { pedido_id: pedido.pedidoId, evento_id: evento.id, comprador_id: user.id });

    return NextResponse.json({
      sucesso: true,
      pedido_id: pedido.pedidoId,
      status: 'approved',
      mensagem: 'Ingresso gratuito garantido com sucesso!',
      url: `/meus-ingressos?pedido_id=${pedido.pedidoId}&status_pedido=aprovado`,
    });
  } catch (error: unknown) {
    logger.error('Erro na emissão de ingresso gratuito', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
