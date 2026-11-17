import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { validarCPF } from '@/lib/utilitarios';
import { limitarRequisicao } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

/**
 * Atualiza apenas nome, CPF e telefone do PRÓPRIO usuário.
 * role / status / atletica_id nunca são aceitos aqui.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseServidor = await criarClienteServidor();
    const { data: { user } } = await supabaseServidor.auth.getUser();
    if (!user) {
      return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
    }

    const limite = await limitarRequisicao(`perfil_sync:${user.id}`, { janelaMs: 60_000, maxRequisicoes: 10 });
    if (!limite.permitido) {
      return NextResponse.json({ erro: 'Muitas solicitações. Aguarde um momento.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const payload: Record<string, string> = {};

    if (typeof body.nome === 'string' && body.nome.trim()) {
      const nome = body.nome.trim().replace(/\s+/g, ' ');
      if (nome.length < 2 || nome.length > 120) {
        return NextResponse.json({ erro: 'Nome inválido.' }, { status: 400 });
      }
      payload.nome = nome;
    }

    if (typeof body.cpf === 'string' && body.cpf.trim()) {
      const cpf = body.cpf.replace(/\D/g, '');
      if (!validarCPF(cpf)) {
        return NextResponse.json({ erro: 'CPF inválido.' }, { status: 400 });
      }
      payload.cpf = cpf;
    }

    if (typeof body.telefone === 'string' && body.telefone.trim()) {
      const tel = body.telefone.replace(/\D/g, '');
      if (tel.length < 10 || tel.length > 13) {
        return NextResponse.json({ erro: 'Telefone inválido.' }, { status: 400 });
      }
      payload.telefone = tel;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: true, mensagem: 'Nenhum dado para atualizar' });
    }

    const { error } = await criarClienteAdmin()
      .from('profiles')
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      logger.error('Erro ao sincronizar perfil', error, { comprador_id: user.id });
      return NextResponse.json({ erro: 'Não foi possível atualizar o perfil.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    logger.error('Exceção ao sincronizar perfil', err);
    return NextResponse.json({ erro: 'Erro ao sincronizar perfil' }, { status: 500 });
  }
}
