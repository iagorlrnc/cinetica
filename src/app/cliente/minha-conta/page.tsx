'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Ticket,
  Gift,
  Package,
  ShoppingBag,
  LogOut,
  LayoutDashboard,
  UserRound,
  ShieldCheck,
  ChevronRight,
  Camera,
  FileText,
  Trash2,
} from 'lucide-react';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { useNotificacao } from '@/componentes/ui/Notificacao';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Botao from '@/componentes/ui/Botao';
import Modal from '@/componentes/ui/Modal';
import IndicadorForcaSenha from '@/componentes/ui/IndicadorForcaSenha';
import Carregando from '@/componentes/ui/Carregando';
import { avaliarSenha, cn, formatarCPF, formatarData, formatarTelefone, mascararCPF } from '@/lib/utilitarios';
import { construirUrl } from '@/lib/dominios';
import { formatarNumeroBilhete } from '@/lib/sorteios';
import { BUCKET_AVATARES, LIMITE_ARQUIVO_AVATAR, TAMANHO_AVATAR_PX, TIPOS_AVATAR } from '@/lib/perfil';

type Rel<T> = T | T[] | null;
const um = <T,>(v: Rel<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

interface IngressoResumo {
  id: string;
  status: string;
  evento: Rel<{ titulo: string; data_evento: string; local: string; imagem_url: string | null }>;
  lote: Rel<{ nome_lote: string }>;
}

interface BilheteResumo {
  id: string;
  numero: number;
  sorteio: Rel<{ titulo: string; data_sorteio: string; total_cotas: number; status: string }>;
}

/** Recorta no centro e reduz a foto para um quadrado WebP leve antes do envio. */
async function prepararFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const lado = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO_AVATAR_PX;
  canvas.height = TAMANHO_AVATAR_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, TAMANHO_AVATAR_PX, TAMANHO_AVATAR_PX);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/webp', 0.85)
  );
}

export default function PaginaMinhaConta() {
  const { usuario, perfil, carregando, sair, recarregarPerfil } = usarAutenticacao();
  const { totalItens } = usarCarrinho();
  const { sucesso, erro: notificarErro } = useNotificacao();
  const [supabase] = useState(() => criarClienteNavegador());
  const entradaFoto = useRef<HTMLInputElement>(null);

  const [contagens, setContagens] = useState<{ ingressos: number; bilhetes: number; pedidos: number } | null>(null);
  const [ingressos, setIngressos] = useState<IngressoResumo[]>([]);
  const [bilhetes, setBilhetes] = useState<BilheteResumo[]>([]);
  const [abaTickets, setAbaTickets] = useState<'ingressos' | 'bilhetes'>('ingressos');
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const [modal, setModal] = useState<'dados' | 'senha' | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const temSenha = Boolean(usuario?.identities?.some((i) => i.provider === 'email'));
  const ehGestor = perfil?.status === 'ativo' && (perfil.role === 'diretor' || perfil.role === 'admin');

  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    (async () => {
      const contar = (tabela: string, coluna: string) =>
        supabase.from(tabela).select('id', { count: 'exact', head: true }).eq(coluna, usuario.id);
      const [ing, bil, ped, listaIng, listaBil] = await Promise.all([
        contar('ingressos', 'comprador_id'),
        contar('sorteio_bilhetes', 'usuario_id'),
        contar('store_orders', 'user_id'),
        supabase
          .from('ingressos')
          .select('id, status, evento:eventos(titulo, data_evento, local, imagem_url), lote:lotes_ingresso(nome_lote)')
          .eq('comprador_id', usuario.id)
          .order('data_compra', { ascending: false })
          .limit(30),
        supabase
          .from('sorteio_bilhetes')
          .select('id, numero, sorteio:sorteios(titulo, data_sorteio, total_cotas, status)')
          .eq('usuario_id', usuario.id)
          .order('criado_em', { ascending: false })
          .limit(30),
      ]);
      if (!ativo) return;
      setContagens({ ingressos: ing.count ?? 0, bilhetes: bil.count ?? 0, pedidos: ped.count ?? 0 });
      setIngressos((listaIng.data || []) as unknown as IngressoResumo[]);
      setBilhetes((listaBil.data || []) as unknown as BilheteResumo[]);
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, usuario]);

  function abrirDados() {
    setNome(perfil?.nome || '');
    setTelefone(perfil?.telefone ? formatarTelefone(perfil.telefone) : '');
    setCpf('');
    setModal('dados');
  }

  async function enviarPerfil(dados: Record<string, unknown>): Promise<boolean> {
    const res = await fetch('/api/perfil/sincronizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      notificarErro('Não foi possível salvar', corpo.erro || 'Tente de novo.');
      return false;
    }
    await recarregarPerfil();
    return true;
  }

  async function trocarFoto(arquivo: File | undefined) {
    if (!arquivo || !usuario) return;
    if (!TIPOS_AVATAR.includes(arquivo.type)) {
      notificarErro('Formato não aceito', 'Use uma foto JPG, PNG ou WebP.');
      return;
    }
    if (arquivo.size > LIMITE_ARQUIVO_AVATAR) {
      notificarErro('Foto muito grande', 'Escolha uma imagem de até 8 MB.');
      return;
    }
    setEnviandoFoto(true);
    try {
      const blob = await prepararFoto(arquivo);
      const caminho = `${usuario.id}/foto-${Date.now()}.webp`;
      const { error } = await supabase.storage
        .from(BUCKET_AVATARES)
        .upload(caminho, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
      if (error) {
        notificarErro('Falha ao enviar a foto', error.message.includes('Bucket not found') ? 'Rode a migração 037 no Supabase.' : error.message);
        return;
      }
      const { data } = supabase.storage.from(BUCKET_AVATARES).getPublicUrl(caminho);
      const anterior = perfil?.avatar_url;
      if (await enviarPerfil({ avatar_url: data.publicUrl })) {
        sucesso('Foto atualizada', 'Sua nova foto de perfil já aparece no site.');
        removerArquivoAntigo(anterior);
      }
    } catch {
      notificarErro('Não foi possível ler a imagem', 'Tente outra foto.');
    } finally {
      setEnviandoFoto(false);
      if (entradaFoto.current) entradaFoto.current.value = '';
    }
  }

  function removerArquivoAntigo(url: string | null | undefined) {
    const marcador = `/object/public/${BUCKET_AVATARES}/`;
    if (!url || !url.includes(marcador)) return;
    void supabase.storage.from(BUCKET_AVATARES).remove([url.split(marcador)[1].split('?')[0]]);
  }

  async function removerFoto() {
    const anterior = perfil?.avatar_url;
    if (await enviarPerfil({ avatar_url: null })) {
      removerArquivoAntigo(anterior);
      sucesso('Foto removida');
    }
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoDados(true);
    const ok = await enviarPerfil({ nome, telefone, ...(cpf.trim() ? { cpf } : {}) });
    setSalvandoDados(false);
    if (ok) {
      setModal(null);
      sucesso('Dados atualizados');
    }
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario?.email) return;
    if (!avaliarSenha(novaSenha).valida) {
      notificarErro('Senha fraca', 'Use pelo menos 8 caracteres com letra maiúscula, número e símbolo.');
      return;
    }
    if (novaSenha !== confirmacao) {
      notificarErro('As senhas não conferem', 'Digite a mesma senha nos dois campos.');
      return;
    }
    setSalvandoSenha(true);
    try {
      if (temSenha) {
        const { error: erroAtual } = await supabase.auth.signInWithPassword({ email: usuario.email, password: senhaAtual });
        if (erroAtual) {
          notificarErro('Senha atual incorreta', 'Confira a senha atual e tente de novo.');
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) {
        notificarErro('Não foi possível trocar a senha', error.message);
        return;
      }
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
      setModal(null);
      sucesso('Senha alterada', 'Use a nova senha no próximo acesso.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Carregando tamanho="lg" texto="Abrindo seu perfil..." />
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <span className="w-20 h-20 rounded-full bg-ouro text-azul-950 flex items-center justify-center mx-auto mb-6">
          <UserRound size={34} />
        </span>
        <h1 className="titulo-display text-5xl text-texto-principal">Perfil</h1>
        <p className="text-texto-secundario mt-3 mb-8">Entre para ver seus ingressos, bilhetes e pedidos.</p>
        <Link href="/autenticacao/entrar?redirecionar=/minha-conta" className="botao-pop h-14 px-8 text-base">
          Entrar
        </Link>
      </div>
    );
  }

  const nomeExibido = perfil?.nome || usuario.email || 'Cinético(a)';
  const email = perfil?.email || usuario.email || '';
  const selo = perfil?.role === 'admin' ? 'Admin' : perfil?.role === 'diretor' ? 'Diretoria' : 'Membro';

  const menu = [
    { rotulo: 'Dados pessoais', icone: UserRound, acao: abrirDados },
    { rotulo: temSenha ? 'Senha e segurança' : 'Criar senha', icone: ShieldCheck, acao: () => setModal('senha') },
    { rotulo: 'Pedidos da loja', icone: Package, href: '/loja/meus-pedidos', extra: contagens?.pedidos },
    { rotulo: 'Carrinho', icone: ShoppingBag, href: '/loja/carrinho', extra: totalItens || undefined },
    { rotulo: 'Termos e privacidade', icone: FileText, href: '/termos-e-privacidade' },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
      <h1 className="titulo-display text-4xl text-texto-principal mb-6">Perfil</h1>

      {/* Foto, nome e selo */}
      <section className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-br from-ouro-vivo to-ouro-classico">
            <div className="w-full h-full rounded-full overflow-hidden bg-azul-800 flex items-center justify-center">
              {perfil?.avatar_url ? (
                <img src={perfil.avatar_url} alt="Sua foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="font-titulo font-extrabold text-5xl text-ouro">{nomeExibido[0]?.toUpperCase()}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => entradaFoto.current?.click()}
            disabled={enviandoFoto}
            aria-label="Trocar foto de perfil"
            className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-ouro text-azul-950 border-4 border-fundo-principal flex items-center justify-center hover:bg-ouro-vivo transition-colors cursor-pointer disabled:opacity-60"
          >
            <Camera size={17} className={enviandoFoto ? 'animate-pulse' : ''} />
          </button>
          <input ref={entradaFoto} type="file" accept={TIPOS_AVATAR.join(',')} className="hidden" onChange={(e) => trocarFoto(e.target.files?.[0])} />
        </div>
        {perfil?.avatar_url && (
          <button type="button" onClick={removerFoto} className="mt-2 text-xs text-texto-terciario hover:text-red-400 inline-flex items-center gap-1 cursor-pointer">
            <Trash2 size={12} /> Remover foto
          </button>
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
          <h2 className="font-titulo font-extrabold text-2xl text-texto-principal">{nomeExibido}</h2>
          <span className="selo !py-0.5 bg-azul-950 text-ouro border border-ouro/40">{selo}</span>
        </div>
        <p className="text-sm text-texto-secundario break-all">{email}</p>
        {perfil?.criado_em && <p className="text-xs text-texto-terciario mt-1">Membro desde {formatarData(perfil.criado_em)}</p>}
      </section>

      {/* Contadores */}
      <section className="mt-6 grid grid-cols-3 rounded-[1.5rem] bg-fundo-card border border-borda-sutil divide-x divide-borda-sutil">
        {[
          { rotulo: 'Ingressos', valor: contagens?.ingressos, href: '/meus-ingressos' },
          { rotulo: 'Bilhetes', valor: contagens?.bilhetes, href: '/meus-bilhetes' },
          { rotulo: 'Pedidos', valor: contagens?.pedidos, href: '/loja/meus-pedidos' },
        ].map((c) => (
          <Link key={c.rotulo} href={c.href} className="py-4 text-center hover:bg-fundo-hover first:rounded-l-[1.5rem] last:rounded-r-[1.5rem] transition-colors">
            <span className="block font-titulo font-extrabold text-2xl text-texto-principal">{c.valor ?? '–'}</span>
            <span className="text-xs font-semibold text-texto-secundario">{c.rotulo}</span>
          </Link>
        ))}
      </section>

      {/* Meus tickets */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-titulo font-extrabold text-xl text-texto-principal">Meus tickets</h2>
          <div className="flex p-1 rounded-full bg-fundo-card border border-borda-sutil">
            {(['ingressos', 'bilhetes'] as const).map((aba) => (
              <button
                key={aba}
                type="button"
                onClick={() => setAbaTickets(aba)}
                aria-pressed={abaTickets === aba}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors cursor-pointer',
                  abaTickets === aba ? 'bg-ouro text-azul-950' : 'text-texto-secundario'
                )}
              >
                {aba}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-fundo-card border border-borda-sutil divide-y divide-borda-sutil overflow-hidden">
          {abaTickets === 'ingressos' ? (
            ingressos.length === 0 ? (
              <p className="p-5 text-sm text-texto-secundario">Você ainda não tem ingressos.</p>
            ) : (
              ingressos.slice(0, 5).map((i) => {
                const ev = um(i.evento);
                return (
                  <Link key={i.id} href="/meus-ingressos" className="flex items-center gap-3 p-4 hover:bg-fundo-hover transition-colors">
                    <span className="w-11 h-11 rounded-xl bg-fundo-elevado overflow-hidden shrink-0 flex items-center justify-center">
                      {ev?.imagem_url ? <img src={ev.imagem_url} alt="" className="w-full h-full object-cover" /> : <Ticket size={18} className="text-ouro" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-texto-principal truncate">{ev?.titulo || 'Evento'}</span>
                      <span className="block text-xs text-texto-secundario truncate">
                        {um(i.lote)?.nome_lote || 'Ingresso'} · {ev ? formatarData(ev.data_evento) : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'selo !py-0.5 !text-[10px]',
                        i.status === 'valido' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-fundo-elevado text-texto-terciario'
                      )}
                    >
                      {i.status === 'valido' ? 'Válido' : i.status === 'utilizado' ? 'Usado' : 'Cancelado'}
                    </span>
                  </Link>
                );
              })
            )
          ) : bilhetes.length === 0 ? (
            <p className="p-5 text-sm text-texto-secundario">Você ainda não tem bilhetes de sorteio.</p>
          ) : (
            bilhetes.slice(0, 5).map((b) => {
              const s = um(b.sorteio);
              return (
                <Link key={b.id} href="/meus-bilhetes" className="flex items-center gap-3 p-4 hover:bg-fundo-hover transition-colors">
                  <span className="w-11 h-11 rounded-xl bg-ouro/15 text-ouro shrink-0 flex items-center justify-center">
                    <Gift size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-texto-principal truncate">{s?.titulo || 'Sorteio'}</span>
                    <span className="block text-xs text-texto-secundario truncate">Apuração {s ? formatarData(s.data_sorteio) : ''}</span>
                  </span>
                  <span className="font-mono font-black text-sm text-ouro">{formatarNumeroBilhete(b.numero, s?.total_cotas || 100)}</span>
                </Link>
              );
            })
          )}
          <Link
            href={abaTickets === 'ingressos' ? '/meus-ingressos' : '/meus-bilhetes'}
            className="flex items-center justify-center gap-1 p-3 text-xs font-bold text-ouro hover:bg-fundo-hover"
          >
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* Menu */}
      <section className="mt-6 rounded-[1.5rem] bg-fundo-card border border-borda-sutil divide-y divide-borda-sutil overflow-hidden">
        {ehGestor && (
          <a href={construirUrl('diretor', '/')} className="flex items-center gap-3 p-4 hover:bg-fundo-hover transition-colors">
            <LayoutDashboard size={19} className="text-ouro" />
            <span className="flex-1 text-sm font-bold text-ouro">Painel {perfil?.role === 'admin' ? 'admin' : 'da diretoria'}</span>
            <ChevronRight size={18} className="text-texto-terciario" />
          </a>
        )}
        {menu.map(({ rotulo, icone: Icone, href, acao, extra }) => {
          const conteudo = (
            <>
              <Icone size={19} className="text-texto-secundario" />
              <span className="flex-1 text-left text-sm font-semibold text-texto-principal">{rotulo}</span>
              {Boolean(extra) && <span className="px-2 py-0.5 rounded-full bg-ouro text-azul-950 text-[11px] font-black">{extra}</span>}
              <ChevronRight size={18} className="text-texto-terciario" />
            </>
          );
          return href ? (
            <Link key={rotulo} href={href} className="flex items-center gap-3 p-4 hover:bg-fundo-hover transition-colors">
              {conteudo}
            </Link>
          ) : (
            <button key={rotulo} type="button" onClick={acao} className="w-full flex items-center gap-3 p-4 hover:bg-fundo-hover transition-colors cursor-pointer">
              {conteudo}
            </button>
          );
        })}
        <button type="button" onClick={sair} className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 transition-colors cursor-pointer">
          <LogOut size={19} className="text-red-400" />
          <span className="flex-1 text-left text-sm font-semibold text-red-400">Sair da conta</span>
        </button>
      </section>

      {/* Dados pessoais (discreto, em janela) */}
      <Modal aberto={modal === 'dados'} aoFechar={() => setModal(null)} titulo="Dados pessoais" tamanho="sm">
        <form onSubmit={salvarDados} className="space-y-4">
          <CampoTexto rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
          <CampoTexto rotulo="E-mail" value={email} disabled dica="Identifica sua conta e não pode ser alterado aqui." />
          <CampoTexto
            rotulo="Telefone / WhatsApp"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            placeholder="(63) 99999-9999"
            maxLength={16}
          />
          <CampoTexto
            rotulo="CPF"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatarCPF(e.target.value))}
            placeholder={perfil?.cpf ? mascararCPF(perfil.cpf) : '000.000.000-00'}
            dica={perfil?.cpf ? 'Já cadastrado. Preencha só para corrigir.' : 'Usado nos pagamentos.'}
            maxLength={14}
          />
          <Botao type="submit" carregando={salvandoDados} larguraTotal>
            Salvar
          </Botao>
        </form>
      </Modal>

      {/* Senha (discreto, em janela) */}
      <Modal aberto={modal === 'senha'} aoFechar={() => setModal(null)} titulo={temSenha ? 'Alterar senha' : 'Criar senha'} tamanho="sm">
        <form onSubmit={salvarSenha} className="space-y-4">
          {!temSenha && <p className="text-sm text-texto-secundario">Você entra com o Google. Crie uma senha para também entrar com e-mail.</p>}
          {temSenha && (
            <CampoTexto rotulo="Senha atual" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" required />
          )}
          <CampoTexto rotulo="Nova senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" required />
          {novaSenha && <IndicadorForcaSenha senha={novaSenha} />}
          <CampoTexto
            rotulo="Confirmar nova senha"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password"
            erro={confirmacao && confirmacao !== novaSenha ? 'As senhas não conferem.' : undefined}
            required
          />
          <Botao type="submit" carregando={salvandoSenha} larguraTotal icone={<ShieldCheck size={16} />}>
            {temSenha ? 'Trocar senha' : 'Criar senha'}
          </Botao>
        </form>
      </Modal>
    </div>
  );
}
