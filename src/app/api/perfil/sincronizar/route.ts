import { NextRequest, NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { validarCPF } from '@/lib/utilitarios';
import { limitarRequisicao } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { ehUrlAvatarDoUsuario } from '@/lib/perfil';

/**
 * Atualiza apenas nome, CPF, telefone e foto do PRÓPRIO usuário.
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

    // Foto de perfil: só arquivos da pasta do próprio usuário no bucket "avatares"; null remove
    let avatar: string | null | undefined;
    if (body.avatar_url === null) {
      avatar = null;
    } else if (typeof body.avatar_url === 'string' && body.avatar_url.trim()) {
      const url = body.avatar_url.trim();
      if (!ehUrlAvatarDoUsuario(url, user.id, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
        return NextResponse.json({ erro: 'Foto de perfil inválida.' }, { status: 400 });
      }
      avatar = url;
    }

    if (Object.keys(payload).length === 0 && avatar === undefined) {
      return NextResponse.json({ ok: true, mensagem: 'Nenhum dado para atualizar' });
    }

    const { error } = await criarClienteAdmin()
      .from('profiles')
      .update({ ...payload, ...(avatar !== undefined ? { avatar_url: avatar } : {}), atualizado_em: new Date().toISOString() })
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
