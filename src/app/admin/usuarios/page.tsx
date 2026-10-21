'use client';

import { useState, useEffect } from 'react';
import Cartao from '@/componentes/ui/Cartao';
import Botao from '@/componentes/ui/Botao';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import Distintivo from '@/componentes/ui/Distintivo';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Carregando from '@/componentes/ui/Carregando';
import Modal from '@/componentes/ui/Modal';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { useNotificacao } from '@/componentes/ui/Notificacao';
import { formatarDataCurta, obterIniciais } from '@/lib/utilitarios';
import type { Perfil, Atletica } from '@/tipos';
import { Search, Users, Edit3, Check } from 'lucide-react';

export default function PaginaGestaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [atleticas, setAtleticas] = useState<Atletica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('');

  // Paginação Backend
  const [pagina, setPagina] = useState(1);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const limite = 20;

  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Perfil | null>(null);
  const [roleEdit, setRoleEdit] = useState<'cliente' | 'diretor' | 'admin'>('cliente');
  const [atleticaIdEdit, setAtleticaIdEdit] = useState<string>('');
  const [statusEdit, setStatusEdit] = useState<'ativo' | 'bloqueado' | 'pendente'>('ativo');
  const [salvandoModal, setSalvandoModal] = useState(false);

  const supabase = criarClienteNavegador();
  const { sucesso, erro } = useNotificacao();

  async function buscarDados() {
    setCarregando(true);
    const inicio = (pagina - 1) * limite;
    const fim = inicio + limite - 1;

    let query = supabase
      .from('profiles')
      .select('id, nome, email, role, atletica_id, status, criado_em, atletica:atleticas(id, nome, faculdade)', { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(inicio, fim);

    if (filtroRole) {
      query = query.eq('role', filtroRole);
    }

    const [usuariosRes, atleticasRes] = await Promise.all([
      query,
      supabase.from('atleticas').select('id, nome, faculdade, cidade').order('nome', { ascending: true }),
    ]);

    if (usuariosRes.data) {
      setUsuarios(usuariosRes.data as unknown as Perfil[]);
      setTotalUsuarios(usuariosRes.count || 0);
    }
    if (atleticasRes.data) setAtleticas(atleticasRes.data as Atletica[]);
    setCarregando(false);
  }

  useEffect(() => {
    buscarDados();
  }, [pagina, filtroRole]);

  function abrirModalEdicao(u: Perfil) {
    setUsuarioEmEdicao(u);
    setRoleEdit(u.role);
    setAtleticaIdEdit(u.atletica_id || '');
    setStatusEdit(u.status);
  }

  async function salvarEdicaoUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioEmEdicao) return;

    setSalvandoModal(true);

    const { error: err } = await supabase
      .from('profiles')
      .update({
        role: roleEdit,
        atletica_id: atleticaIdEdit === '' ? null : atleticaIdEdit,
        status: statusEdit,
      })
      .eq('id', usuarioEmEdicao.id);

    if (err) {
      erro('Erro ao atualizar', err.message || 'Não foi possível salvar os dados do usuário.');
      setSalvandoModal(false);
      return;
    }

    sucesso('Usuário Atualizado', `As alterações de ${usuarioEmEdicao.nome || usuarioEmEdicao.email} foram salvas com sucesso!`);
    setUsuarioEmEdicao(null);
    setSalvandoModal(false);
    buscarDados();
  }

  async function alterarStatusRapido(id: string, novoStatus: 'ativo' | 'bloqueado') {
    const { error: err } = await supabase.from('profiles').update({ status: novoStatus }).eq('id', id);
    if (err) { erro('Erro', 'Não foi possível alterar o status'); return; }
    sucesso('Atualizado', `Usuário ${novoStatus === 'ativo' ? 'desbloqueado' : 'bloqueado'}`);
    buscarDados();
  }

  const filtrados = usuarios.filter(u =>
    (!busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())) &&
    (!filtroRole || u.role === filtroRole)
  );

  if (carregando) return <div className="flex items-center justify-center h-96"><Carregando tamanho="lg" /></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-titulo mb-1 text-slate-900">
            Gestão de <span className="text-[#c59941]">Usuários</span>
          </h1>
          <p className="text-slate-500">{usuarios.length} usuários cadastrados na plataforma</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <CampoTexto placeholder="Buscar por nome ou email..." value={busca} onChange={(e) => setBusca((e.target as HTMLInputElement).value)} icone={<Search size={18} />} />
        </div>
        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base sm:text-sm min-h-[44px] focus:outline-none focus:border-[#c59941] shadow-sm cursor-pointer"
        >
          <option value="">Todos os perfis</option>
          <option value="cliente">Clientes</option>
          <option value="diretor">Diretores</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* Tabela de Usuários */}
      <Cartao variante="vidro" semPadding>
        <div className="overflow-x-auto">
          {filtrados.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-6 py-4">Usuário</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-6 py-4">Perfil</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-6 py-4">Atlética Vinculada</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-6 py-4">Status</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-6 py-4">Cadastro</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500 px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => {
                  const perfilComAtletica = u as Perfil & { atletica?: { nome: string } };
                  const atleticaVinculada = perfilComAtletica.atletica?.nome;

                  return (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c59941] to-[#9a7228] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                            {obterIniciais(u.nome || 'U')}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{u.nome}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${
                          u.role === 'admin'
                            ? 'bg-[#c59941]/15 text-[#9a7228] border-[#c59941]/30 font-bold'
                            : u.role === 'diretor'
                            ? 'bg-[#121826]/10 text-[#121826] border-[#121826]/20 font-bold'
                            : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                        {atleticaVinculada || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${
                          u.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                            : u.status === 'bloqueado'
                            ? 'bg-red-50 text-red-700 border-red-200 font-bold'
                            : 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatarDataCurta(u.criado_em)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => abrirModalEdicao(u)}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Editar usuário"
                        >
                          <Edit3 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EstadoVazio
              titulo="Nenhum usuário encontrado"
              descricao="Não há usuários cadastrados com os filtros selecionados."
              icone={<Users className="w-7 h-7" />}
            />
          )}
        </div>
      </Cartao>

      {totalUsuarios > limite && (
        <div className="flex items-center justify-between mt-6 px-2">
          <p className="text-xs text-slate-500">
            Exibindo página <strong className="text-slate-900">{pagina}</strong> de{' '}
            <strong className="text-slate-900">{Math.ceil(totalUsuarios / limite)}</strong>
          </p>
          <div className="flex items-center gap-2">
            <Botao
              variante="contorno"
              tamanho="sm"
              disabled={pagina === 1 || carregando}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Botao>
            <Botao
              variante="contorno"
              tamanho="sm"
              disabled={pagina * limite >= totalUsuarios || carregando}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Botao>
          </div>
        </div>
      )}

      <Modal
        aberto={!!usuarioEmEdicao}
        aoFechar={() => setUsuarioEmEdicao(null)}
        titulo="Editar Perfil & Vincular Atlética"
        descricao={usuarioEmEdicao ? `Editando permissões para ${usuarioEmEdicao.nome || usuarioEmEdicao.email}` : ''}
      >
        {usuarioEmEdicao && (
          <form onSubmit={salvarEdicaoUsuario} className="space-y-5">
            <div className="p-4 rounded-xl bg-fundo-input border border-borda-sutil">
              <p className="text-xs text-texto-terciario mb-1">Usuário</p>
              <p className="font-bold text-sm text-texto-principal">{usuarioEmEdicao.nome || 'Sem nome'}</p>
              <p className="text-xs text-texto-secundario">{usuarioEmEdicao.email}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-texto-secundario">
                Perfil de Acesso (Role)
              </label>
              <select
                value={roleEdit}
                onChange={(e) => setRoleEdit(e.target.value as 'cliente' | 'diretor' | 'admin')}
                className="w-full bg-fundo-input border border-borda-sutil rounded-xl px-4 py-3 text-texto-principal text-sm focus:outline-none focus:border-amber-400 font-medium"
              >
                <option value="cliente">Cliente (Comprador de ingressos)</option>
                <option value="diretor">Diretor de Atlética (Organizador)</option>
                <option value="admin">Administrador (Gestão global)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-texto-secundario flex items-center justify-between">
                <span>Vincular a uma Atlética</span>
                {roleEdit === 'diretor' && (
                  <span className="text-xs text-[#9a7228] font-semibold">* Recomendado para Diretores</span>
                )}
              </label>
              <select
                value={atleticaIdEdit}
                onChange={(e) => setAtleticaIdEdit(e.target.value)}
                className="w-full bg-fundo-input border border-borda-sutil rounded-xl px-4 py-3 text-texto-principal text-sm focus:outline-none focus:border-amber-400 font-medium"
              >
                <option value="">-- Nenhuma atlética vinculada --</option>
                {atleticas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.faculdade} - {a.cidade})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-texto-secundario">
                Status da Conta
              </label>
              <select
                value={statusEdit}
                onChange={(e) => setStatusEdit(e.target.value as 'ativo' | 'bloqueado' | 'pendente')}
                className="w-full bg-fundo-input border border-borda-sutil rounded-xl px-4 py-3 text-texto-principal text-sm focus:outline-none focus:border-amber-400 font-medium"
              >
                <option value="ativo">Ativo</option>
                <option value="bloqueado">Bloqueado</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-borda-sutil">
              <Botao
                variante="fantasma"
                type="button"
                onClick={() => setUsuarioEmEdicao(null)}
              >
                Cancelar
              </Botao>
              <Botao
                type="submit"
                carregando={salvandoModal}
                icone={<Check size={16} />}
              >
                Salvar Alterações
              </Botao>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
