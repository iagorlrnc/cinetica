import { NextRequest, NextResponse } from 'next/server';
import { paymentClient, ehMercadoPagoConfigurado } from '@/lib/mercadopago';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterSessaoApi } from '@/lib/autenticacaoApi';
import { logger } from '@/lib/logger';
import { limitarRequisicao } from '@/lib/rateLimit';
import { ehUuid, obterIpRequisicao, MENSAGEM_ERRO_INTERNO } from '@/lib/seguranca';
import { TEMPO_RESERVA_COTAS_MINUTOS } from '@/lib/constantes';
import { montarPayer, obterUrlWebhook, STATUS_GATEWAY_CANCELADOS, type PagamentoGateway } from '@/lib/pagamentos/comum';
import {
  confirmarPedidoSorteio,
  ehFuncaoAusente,
  MENSAGEM_SORTEIO_INDISPONIVEL,
  traduzirErroReserva,
  validarEntradaCompraSorteio,
  type PedidoSorteio,
} from '@/lib/pagamentos/sorteios';

const COLUNAS_PEDIDO = 'id, sorteio_id, usuario_id, quantidade, valor_total, status, gateway_payment_id, expira_em, qr_code, qr_code_base64';

type PedidoComQr = PedidoSorteio & { qr_code: string | null; qr_code_base64: string | null };

/** Gera (ou reaproveita) o Pix para comprar cotas de um sorteio. */
export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers);
  const limiteIp = await limitarRequisicao(`sorteio_pix_ip:${ip}`, { janelaMs: 60_000, maxRequisicoes: 20 });
  if (!limiteIp.permitido) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
  }

  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) return NextResponse.json({ erro: 'Entre na sua conta para comprar cotas.' }, { status: 401 });
    const { user, perfil } = sessao;
    if (perfil?.status === 'bloqueado') return NextResponse.json({ erro: 'Sua conta está bloqueada.' }, { status: 403 });

    const limiteUsuario = await limitarRequisicao(`sorteio_pix_user:${user.id}`, { janelaMs: 60_000, maxRequisicoes: 6 });
    if (!limiteUsuario.permitido) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const entrada = validarEntradaCompraSorteio(await request.json().catch(() => null));
    if (!entrada.ok) return NextResponse.json({ erro: entrada.erro }, { status: 400 });

    if (!ehMercadoPagoConfigurado()) {
      return NextResponse.json({ erro: 'O pagamento online está temporariamente indisponível.' }, { status: 503 });
    }

    const supabase = criarClienteAdmin();

    // Reaproveita um Pix ainda válido do mesmo usuário/sorteio/quantidade (evita cobranças duplicadas)
    const { data: existente } = await supabase
      .from('sorteio_pedidos')
      .select(COLUNAS_PEDIDO)
      .eq('usuario_id', user.id)
      .eq('sorteio_id', entrada.sorteioId)
      .eq('quantidade', entrada.quantidade)
      .eq('status', 'pendente')
      .gt('expira_em', new Date(Date.now() + 60_000).toISOString())
      .not('qr_code', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      const p = existente as PedidoComQr;
      return NextResponse.json({
        pedido_id: p.id,
        qr_code: p.qr_code,
        qr_code_base64: p.qr_code_base64,
        expira_em: p.expira_em,
        valor_total: Number(p.valor_total),
        quantidade: p.quantidade,
      });
    }

    // Reserva as cotas no banco (valor calculado lá: valor_cota × quantidade)
    const { data: reserva, error: erroReserva } = await supabase.rpc('reservar_cotas_sorteio', {
      p_sorteio_id: entrada.sorteioId,
      p_usuario_id: user.id,
      p_quantidade: entrada.quantidade,
      p_minutos: TEMPO_RESERVA_COTAS_MINUTOS,
    });
    const r = reserva as { sucesso?: boolean; erro?: string; restantes?: number; pedido_id?: string; valor_total?: number; expira_em?: string; titulo?: string } | null;
    if (ehFuncaoAusente(erroReserva)) {
      logger.error('Função reservar_cotas_sorteio ausente: aplique supabase/migracoes/036_sorteio_pix.sql', erroReserva);
      return NextResponse.json({ erro: MENSAGEM_SORTEIO_INDISPONIVEL }, { status: 503 });
    }
    if (erroReserva || !r?.sucesso || !r.pedido_id) {
      if (erroReserva) logger.error('Falha ao reservar cotas', erroReserva, { userId: user.id });
      return NextResponse.json({ erro: traduzirErroReserva(r?.erro, r?.restantes) }, { status: erroReserva ? 500 : 409 });
    }

    const pedidoId = r.pedido_id;
    const valorTotal = Number(r.valor_total);
    const expiraEm = String(r.expira_em);

    let mp;
    try {
      mp = await paymentClient.create({
        body: {
          transaction_amount: valorTotal,
          description: `Sorteio ${r.titulo || ''} — ${entrada.quantidade} cota(s)`.slice(0, 200),
          payment_method_id: 'pix',
          statement_descriptor: 'CINETICA',
          payer: montarPayer(perfil, user.email),
          external_reference: pedidoId,
          notification_url: obterUrlWebhook(),
          date_of_expiration: new Date(expiraEm).toISOString(),
          metadata: { tipo: 'sorteio', pedido_id: pedidoId, sorteio_id: entrada.sorteioId, usuario_id: user.id, quantidade: entrada.quantidade },
        },
        requestOptions: { idempotencyKey: `sorteio-${pedidoId}` },
      });
    } catch (err) {
      logger.error('Mercado Pago recusou o Pix do sorteio', err, { pedidoId });
      mp = null;
    }

    const dados = mp?.point_of_interaction?.transaction_data;
    if (!mp?.id || !dados?.qr_code) {
      // Libera a reserva na hora se a cobrança não foi criada
      await supabase.from('sorteio_pedidos').update({ status: 'cancelado', atualizado_em: new Date().toISOString() }).eq('id', pedidoId);
      return NextResponse.json({ erro: 'Não foi possível gerar o Pix agora. Tente novamente.' }, { status: 502 });
    }

    await supabase
      .from('sorteio_pedidos')
      .update({
        gateway_payment_id: String(mp.id),
        qr_code: dados.qr_code,
        qr_code_base64: dados.qr_code_base64 || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedidoId);

    logger.info('Pix de sorteio criado', { pedidoId, paymentId: String(mp.id), userId: user.id });

    return NextResponse.json({
      pedido_id: pedidoId,
      qr_code: dados.qr_code,
      qr_code_base64: dados.qr_code_base64 || null,
      expira_em: expiraEm,
      valor_total: valorTotal,
      quantidade: entrada.quantidade,
    });
  } catch (error) {
    logger.error('Erro ao gerar Pix do sorteio', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}

/**
 * Status do pedido (consultado pela tela a cada poucos segundos).
 * Confere o pagamento direto no Mercado Pago, então funciona mesmo sem webhook.
 */
export async function GET(request: NextRequest) {
  try {
    const sessao = await obterSessaoApi(request);
    if (!sessao) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

    const pedidoId = request.nextUrl.searchParams.get('pedido_id');
    if (!ehUuid(pedidoId)) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 });

    const limite = await limitarRequisicao(`sorteio_pix_status:${sessao.user.id}`, { janelaMs: 60_000, maxRequisicoes: 40 });
    if (!limite.permitido) return NextResponse.json({ erro: 'Muitas consultas.' }, { status: 429 });

    const supabase = criarClienteAdmin();
    const { data } = await supabase
      .from('sorteio_pedidos')
      .select(COLUNAS_PEDIDO)
      .eq('id', pedidoId)
      .eq('usuario_id', sessao.user.id) // só o dono consulta
      .maybeSingle();
    if (!data) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 });

    let pedido = data as PedidoComQr;

    if (pedido.status === 'pendente' && pedido.gateway_payment_id && ehMercadoPagoConfigurado()) {
      try {
        const pagamento = (await paymentClient.get({ id: pedido.gateway_payment_id })) as unknown as PagamentoGateway;
        const status = String(pagamento?.status || '');
        if (status === 'approved') {
          const resultado = await confirmarPedidoSorteio(supabase, pedido, pagamento);
          if (!resultado.sucesso) logger.warn('Pix de sorteio aprovado não confirmado', { pedidoId, erro: resultado.erro });
        } else if (STATUS_GATEWAY_CANCELADOS.includes(status)) {
          await supabase.rpc('estornar_pagamento_sorteio', { p_gateway_payment_id: pedido.gateway_payment_id, p_novo_status: status });
        }
        const { data: atualizado } = await supabase.from('sorteio_pedidos').select(COLUNAS_PEDIDO).eq('id', pedido.id).single();
        if (atualizado) pedido = atualizado as PedidoComQr;
      } catch (err) {
        logger.warn('Falha ao consultar Pix do sorteio no gateway', { pedidoId, erro: String(err) });
      }
    }

    const vencido = pedido.status === 'pendente' && new Date(pedido.expira_em).getTime() < Date.now();
    const status = vencido ? 'expirado' : pedido.status;

    let numeros: number[] = [];
    if (status === 'pago') {
      const { data: bilhetes } = await supabase.from('sorteio_bilhetes').select('numero').eq('pedido_id', pedido.id).order('numero');
      numeros = (bilhetes || []).map((b) => b.numero as number);
    }

    return NextResponse.json({
      status,
      numeros,
      expira_em: pedido.expira_em,
      quantidade: pedido.quantidade,
      valor_total: Number(pedido.valor_total),
      qr_code: status === 'pendente' ? pedido.qr_code : null,
      qr_code_base64: status === 'pendente' ? pedido.qr_code_base64 : null,
    });
  } catch (error) {
    logger.error('Erro ao consultar Pix do sorteio', error);
    return NextResponse.json({ erro: MENSAGEM_ERRO_INTERNO }, { status: 500 });
  }
}
