'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Cartao from '@/componentes/ui/Cartao';
import Botao from '@/componentes/ui/Botao';
import Distintivo from '@/componentes/ui/Distintivo';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Carregando from '@/componentes/ui/Carregando';
import CaptchaCloudflare from '@/componentes/ui/CaptchaCloudflare';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { formatarMoeda, formatarDataCurta } from '@/lib/utilitarios';
import { obterIdAtleticaCinetica } from '@/lib/atleticaCinetica';
import {
  Ticket,
  DollarSign,
  CalendarDays,
  CalendarPlus,
  ScanLine,
  TrendingUp,
  ArrowRight,
  Mail,
  Lock,
  ArrowLeft,
  ShieldCheck,
  ShoppingCart,
  Package,
  BarChart3,
  Trophy,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

import { construirUrl } from '@/lib/dominios';
import type { Evento, LoteIngresso, PedidoLoja } from '@/tipos';

export default function DashboardDiretor() {
  const { usuario, perfil, entrar, carregando: carregandoAuth } = usarAutenticacao();
  const urlSitePrincipal = construirUrl('cliente', '/');
  const pathname = usePathname();
  
  const rotaBase = pathname.startsWith('/diretor') ? '/diretor' : '';
  function resolverLink(href: string) {
    if (href === '/') return rotaBase || '/';
    return `${rotaBase}${href}`;
  }
  
  const [stats, setStats] = useState({
    totalVendido: 0,
    receitaEventos: 0,
    eventosAtivos: 0,
    eventosTotal: 0,
    pedidosLoja: 0,
    receitaLoja: 0,
    produtosAtivos: 0,
    produtosTotal: 0,
    entregasPendentes: 0,
    receitaTotal: 0,
  });
  
  const [eventosRecentes, setEventosRecentes] = useState<(Evento & { lotes_ingresso?: LoteIngresso[] })[]>([]);
  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoLoja[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [processandoLogin, setProcessandoLogin] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const supabase = criarClienteNavegador();

  async function buscarDados() {
    try {
      let idAtletica = perfil?.atletica_id;
      if (!idAtletica) {
        idAtletica = (await obterIdAtleticaCinetica(supabase)) || undefined;
      }

      // 1. Buscar Eventos com lotes
      let queryEventos = supabase
        .from('eventos')
        .select('*, lotes_ingresso(id, preco, quantidade_total, quantidade_vendida)')
        .eq('apagado_pelo_diretor', false)
        .order('criado_em', { ascending: false });

      if (idAtletica) {
        queryEventos = queryEventos.eq('atletica_id', idAtletica);
      }

      // 2. Buscar Pedidos da Loja
      let queryPedidos = supabase
        .from('store_orders')
        .select(`
          id,
          status,
          total_amount,
          payment_method,
          metadata,
          created_at,
          user:profiles(id, nome, email),
          items:store_order_items(id, product_name_snapshot, quantity, subtotal)
        `)
        .order('created_at', { ascending: false });

      if (idAtletica) {
        queryPedidos = queryPedidos.eq('atletica_id', idAtletica);
      }

      // 3. Buscar Produtos da Loja
      let queryProdutos = supabase
        .from('store_products')
        .select('id, is_active');

      if (idAtletica) {
        queryProdutos = queryProdutos.eq('atletica_id', idAtletica);
      }

      const [resEventos, resPedidos, resProdutos] = await Promise.all([
        queryEventos,
        queryPedidos,
        queryProdutos,
      ]);

      // Processar Eventos
      const eventos = (resEventos.data || []) as (Evento & { lotes_ingresso?: LoteIngresso[] })[];
      setEventosRecentes(eventos.slice(0, 5));

      let totalVendido = 0;
      let receitaEventos = 0;
      let ativos = 0;

      eventos.forEach((ev) => {
        if (ev.status === 'publicado') ativos++;
        ev.lotes_ingresso?.forEach((l) => {
          totalVendido += l.quantidade_vendida;
          receitaEventos += l.quantidade_vendida * l.preco;
        });
      });

      // Processar Pedidos da Loja
      const pedidos = (resPedidos.data || []) as PedidoLoja[];
      setPedidosRecentes(pedidos.slice(0, 5));

      let receitaLoja = 0;
      let pedidosLojaCount = 0;
      let entregasPendentes = 0;

      pedidos.forEach((p) => {
        if (p.status === 'paid') {
          pedidosLojaCount++;
          receitaLoja += p.total_amount / 100;
          const estaEntregue = Boolean(p.metadata && (p.metadata as Record<string, unknown>).entregue);
          if (!estaEntregue) {
            entregasPendentes++;
          }
        }
      });

      // Processar Produtos
      const produtos = (resProdutos.data || []) as { id: string; is_active: boolean }[];
      const produtosAtivos = produtos.filter((p) => p.is_active).length;

      setStats({
        totalVendido,
        receitaEventos,
        eventosAtivos: ativos,
        eventosTotal: eventos.length,
        pedidosLoja: pedidosLojaCount,
        receitaLoja,
        produtosAtivos,
        produtosTotal: produtos.length,
        entregasPendentes,
        receitaTotal: receitaEventos + receitaLoja,
      });
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    if (perfil && (perfil.role === 'diretor' || perfil.role === 'admin')) {
      buscarDados();
    } else {
      setCarregandoDados(false);
    }
  }, [perfil]);

  async function aoSubmeterLogin(e: React.FormEvent) {
    e.preventDefault();
    setErroLogin('');
    setProcessandoLogin(true);

    const res = await entrar(email, senha);

    if (res.erro) {
      setErroLogin(res.erro.includes('Invalid login') ? 'Email ou senha incorretos' : res.erro);
      setProcessandoLogin(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: userPerfil } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userPerfil || (userPerfil.role !== 'diretor' && userPerfil.role !== 'admin')) {
        setErroLogin('Sua conta é de cliente. O portal do diretor é exclusivo para organizadores.');
        await supabase.auth.signOut();
        setProcessandoLogin(false);
        return;
      }
    }

    setProcessandoLogin(false);
  }

  const estaAutenticado = Boolean(usuario && perfil && (perfil.role === 'diretor' || perfil.role === 'admin'));

  if (!estaAutenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#fafafa]">
        <div className="w-96 h-96 rounded-full bg-[#c59941]/10 blur-3xl absolute -top-20 -left-20 pointer-events-none" />
        <div className="w-96 h-96 rounded-full bg-[#dc2626]/5 blur-3xl absolute bottom-10 right-0 pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <a
            href={urlSitePrincipal}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider mb-6 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-full border border-slate-200 shadow-sm"
          >
            <ArrowLeft size={14} />
            Voltar ao site principal
          </a>

          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 animar-entrar-baixo border border-slate-200/80">
            <div className="flex items-center gap-3.5 mb-8 pb-5 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#c59941] to-[#9a7228] flex items-center justify-center shadow-lg shadow-[#c59941]/20 shrink-0">
                <Ticket className="w-6 h-6 text-white transform -rotate-12" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c59941]/10 text-[#9a7228] border border-[#c59941]/30 text-[10px] font-bold tracking-wider uppercase mb-1">
                  <ShieldCheck size={12} /> Portal do Diretor
                </div>
                <h1 className="text-xl font-bold font-titulo text-slate-900">
                  Acesso do Diretor
                </h1>
              </div>
            </div>

            <form onSubmit={aoSubmeterLogin} className="space-y-5">
              <CampoTexto
                rotulo="Email corporativo ou da atlética"
                type="email"
                placeholder="diretor@atletica.com"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                icone={<Mail size={18} />}
                required
              />

              <CampoTexto
                rotulo="Senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha((e.target as HTMLInputElement).value)}
                icone={<Lock size={18} />}
                required
              />

              {erroLogin && (
                <div className="p-4 rounded-xl bg-erro/10 border border-erro/20 text-xs font-medium text-erro leading-relaxed">
                  {erroLogin}
                </div>
              )}

              <Botao
                type="submit"
                larguraTotal
                tamanho="lg"
                carregando={processandoLogin}
                disabled={processandoLogin || !turnstileToken}
              >
                Entrar no Painel do Diretor
              </Botao>

              <CaptchaCloudflare
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
              />
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-2">
              <p className="text-xs text-slate-500">
                Não tem perfil de diretor?{' '}
                <Link
                  href="/autenticacao/cadastro"
                  className="text-[#9a7228] hover:text-[#7a5818] font-bold transition-colors"
                >
                  Cadastre-se como diretor
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (carregandoDados) {
    return (
      <div className="flex items-center justify-center h-96">
        <Carregando tamanho="lg" texto="Carregando métricas..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black font-titulo text-slate-900">
              Olá, <span className="gradiente-texto">{perfil?.nome?.split(' ')[0]}</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#c59941]/10 text-[#9a7228] text-xs font-bold border border-[#c59941]/30">
              Atlética Cinética Oficial
            </span>
          </div>
          <p className="text-slate-500 mt-1">Visão geral e gestão exclusiva da Atlética Cinética</p>
        </div>
      </div>

      {/* Cartões de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita Consolidada */}
        <Cartao variante="vidro" className="animar-entrar-baixo border border-slate-200 shadow-sm bg-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Receita Total</p>
              <p className="text-2xl font-black font-titulo text-emerald-600">
                {formatarMoeda(stats.receitaTotal)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Bilheteria + Loja Oficial
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
        </Cartao>

        {/* Ingressos */}
        <Cartao variante="vidro" className="animar-entrar-baixo border border-slate-200 shadow-sm bg-white" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Ingressos Vendidos</p>
              <p className="text-2xl font-black font-titulo text-slate-900">{stats.totalVendido}</p>
              <p className="text-[11px] text-[#9a7228] font-bold mt-1">
                {formatarMoeda(stats.receitaEventos)} em bilheteria
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c59941] to-[#9a7228] flex items-center justify-center shadow-md">
              <Ticket className="w-5 h-5 text-white" />
            </div>
          </div>
        </Cartao>

        {/* Loja */}
        <Cartao variante="vidro" className="animar-entrar-baixo border border-slate-200 shadow-sm bg-white" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Vendas da Loja</p>
              <p className="text-2xl font-black font-titulo text-slate-900">
                {stats.pedidosLoja} <span className="text-xs font-normal text-slate-400">pedidos</span>
              </p>
              <p className="text-[11px] text-[#9a7228] font-bold mt-1">
                {formatarMoeda(stats.receitaLoja)} em produtos
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#b8872f] to-[#7a5818] flex items-center justify-center shadow-md">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
          </div>
        </Cartao>

        {/* Status Operacional */}
        <Cartao variante="vidro" className="animar-entrar-baixo border border-slate-200 shadow-sm bg-white" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Operações Ativas</p>
              <p className="text-2xl font-black font-titulo text-slate-900">
                {stats.eventosAtivos} <span className="text-xs font-normal text-slate-400">eventos</span>
              </p>
              <p className="text-[11px] font-medium mt-1">
                {stats.entregasPendentes > 0 ? (
                  <span className="text-amber-700 font-bold">{stats.entregasPendentes} entregas pendentes</span>
                ) : (
                  <span className="text-slate-500">{stats.produtosAtivos} produtos na loja</span>
                )}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#121826] to-[#1b2336] flex items-center justify-center shadow-md">
              <TrendingUp className="w-5 h-5 text-[#f4d68a]" />
            </div>
          </div>
        </Cartao>
      </div>

      {/* Ações Rápidas do Painel */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-texto-terciario mb-3">
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href={resolverLink('/eventos/novo')}>
            <Cartao variante="padrao" interativo className="flex items-center gap-3.5 p-4 h-full bg-white border border-slate-200 shadow-sm hover:border-[#c59941]">
              <div className="w-11 h-11 rounded-xl bg-[#c59941]/15 flex items-center justify-center flex-shrink-0">
                <CalendarPlus className="w-5 h-5 text-[#9a7228]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm font-titulo truncate text-slate-900">Criar Evento</h3>
                <p className="text-xs text-slate-500 truncate">Publique novos ingressos</p>
              </div>
              <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
            </Cartao>
          </Link>

          <Link href={resolverLink('/produtos')}>
            <Cartao variante="padrao" interativo className="flex items-center gap-3.5 p-4 h-full bg-white border border-slate-200 shadow-sm hover:border-[#c59941]">
              <div className="w-11 h-11 rounded-xl bg-[#c59941]/15 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-[#9a7228]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm font-titulo truncate text-slate-900">Produtos da Loja</h3>
                <p className="text-xs text-slate-500 truncate">Cadastre e gerencie itens</p>
              </div>
              <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
            </Cartao>
          </Link>

          <Link href={resolverLink('/metricas-loja')}>
            <Cartao variante="padrao" interativo className="flex items-center gap-3.5 p-4 h-full bg-white border border-slate-200 shadow-sm hover:border-[#c59941]">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm font-titulo truncate text-slate-900">Métricas & Entregas</h3>
                <p className="text-xs text-slate-500 truncate">
                  {stats.entregasPendentes > 0 ? `${stats.entregasPendentes} pendente(s)` : 'Relatórios e vendas'}
                </p>
              </div>
              <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
            </Cartao>
          </Link>

          <Link href={resolverLink('/validar-entrada')}>
            <Cartao variante="padrao" interativo className="flex items-center gap-3.5 p-4 h-full bg-white border border-slate-200 shadow-sm hover:border-[#c59941]">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <ScanLine className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm font-titulo truncate text-slate-900">Validar Entrada</h3>
                <p className="text-xs text-slate-500 truncate">Escanear QR Code</p>
              </div>
              <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
            </Cartao>
          </Link>
        </div>
      </div>

      {/* Seções de Atividades Recentes (Eventos e Loja) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Eventos Recentes */}
        <Cartao variante="vidro" className="flex flex-col h-full bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#9a7228]" />
              <h3 className="text-base font-bold font-titulo text-slate-900">Eventos Recentes</h3>
            </div>
            <Link href={resolverLink('/eventos')}>
              <Botao variante="fantasma" tamanho="sm" className="text-xs text-slate-600 hover:text-slate-900">
                Ver todos
              </Botao>
            </Link>
          </div>

          {eventosRecentes.length > 0 ? (
            <div className="space-y-2.5 flex-1">
              {eventosRecentes.map((evento) => (
                <Link
                  key={evento.id}
                  href={resolverLink(`/eventos/${evento.slug || evento.id}/vendas`)}
                  className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#c59941]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#c59941]/20 transition-colors">
                    <CalendarDays size={18} className="text-[#9a7228]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-800 group-hover:text-[#9a7228] transition-colors">
                      {evento.titulo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatarDataCurta(evento.data_evento)}
                    </p>
                  </div>
                  <Distintivo status={evento.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
              <p className="text-sm text-slate-400 mb-3">Nenhum evento criado ainda</p>
              <Link href={resolverLink('/eventos/novo')}>
                <Botao variante="primario" tamanho="sm">
                  Criar Primeiro Evento
                </Botao>
              </Link>
            </div>
          )}
        </Cartao>

        {/* Coluna 2: Últimos Pedidos da Loja */}
        <Cartao variante="vidro" className="flex flex-col h-full bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#9a7228]" />
              <h3 className="text-base font-bold font-titulo text-slate-900">Últimos Pedidos da Loja</h3>
            </div>
            <Link href={resolverLink('/metricas-loja')}>
              <Botao variante="fantasma" tamanho="sm" className="text-xs text-slate-600 hover:text-slate-900">
                Ver métricas
              </Botao>
            </Link>
          </div>

          {pedidosRecentes.length > 0 ? (
            <div className="space-y-2.5 flex-1">
              {pedidosRecentes.map((pedido) => {
                const compradorNome = (pedido.user as { nome?: string } | undefined)?.nome || 'Cliente';
                const itensCount = pedido.items?.length || 0;
                const primeiroItemNome = pedido.items?.[0]?.product_name_snapshot || 'Item';
                const resumoItens = itensCount > 1 ? `${primeiroItemNome} +${itensCount - 1}` : primeiroItemNome;
                const estaEntregue = Boolean(pedido.metadata && (pedido.metadata as Record<string, unknown>).entregue);

                return (
                  <Link
                    key={pedido.id}
                    href={resolverLink('/metricas-loja')}
                    className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#c59941]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#c59941]/20 transition-colors">
                      <Package size={18} className="text-[#9a7228]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-800 group-hover:text-[#9a7228] transition-colors">
                        {resumoItens}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {compradorNome} • {formatarDataCurta(pedido.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-sm font-bold font-titulo text-slate-900">
                        {formatarMoeda(pedido.total_amount / 100)}
                      </span>
                      {pedido.status === 'paid' ? (
                        estaEntregue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 size={10} /> Entregue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                            <Clock size={10} /> Pendente
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {pedido.status === 'pending_payment' ? 'Aguardando' : 'Cancelado'}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
              <p className="text-sm text-texto-terciario mb-3">Nenhum pedido na loja ainda</p>
              <Link href={resolverLink('/produtos')}>
                <Botao variante="contorno" tamanho="sm">
                  Cadastrar Produtos
                </Botao>
              </Link>
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}

