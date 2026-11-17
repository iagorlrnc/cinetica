import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteServidor } from '@/lib/supabase/servidor';

export interface PerfilApi {
  id: string;
  nome: string | null;
  email: string | null;
  role: 'cliente' | 'diretor' | 'admin';
  status: 'ativo' | 'bloqueado' | 'pendente';
  atletica_id: string | null;
  cpf?: string | null;
  telefone?: string | null;
}

export interface SessaoApi {
  user: User;
  perfil: PerfilApi | null;
}

/**
 * Resolve o usuário autenticado (cookie de sessão ou `Authorization: Bearer <jwt>`)
 * e carrega o perfil com a service role (fonte confiável de role/status).
 */
export async function obterSessaoApi(request?: NextRequest): Promise<SessaoApi | null> {
  const admin = criarClienteAdmin();
  let user: User | null = null;

  const authHeader = request?.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await admin.auth.getUser(authHeader.slice(7).trim());
    user = data?.user ?? null;
  }

  if (!user) {
    try {
      const servidor = await criarClienteServidor();
      const { data } = await servidor.auth.getUser();
      user = data?.user ?? null;
    } catch {
      user = null;
    }
  }

  if (!user) return null;

  const { data: perfil } = await admin
    .from('profiles')
    .select('id, nome, email, role, status, atletica_id, cpf, telefone')
    .eq('id', user.id)
    .maybeSingle();

  return { user, perfil: (perfil as PerfilApi | null) ?? null };
}

export function ehAdminAtivo(perfil: PerfilApi | null | undefined): boolean {
  return Boolean(perfil && perfil.role === 'admin' && perfil.status === 'ativo');
}

export function ehGestorAtivo(perfil: PerfilApi | null | undefined): boolean {
  return Boolean(perfil && (perfil.role === 'diretor' || perfil.role === 'admin') && perfil.status === 'ativo');
}

/** Diretor só gerencia a própria atlética; admin gerencia todas. */
export function podeGerenciarAtletica(perfil: PerfilApi | null | undefined, atleticaId: string | null | undefined): boolean {
  if (!ehGestorAtivo(perfil)) return false;
  if (perfil!.role === 'admin') return true;
  return Boolean(atleticaId && perfil!.atletica_id && perfil!.atletica_id === atleticaId);
}
