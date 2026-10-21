'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import Botao from '@/componentes/ui/Botao';
import { cn, normalizarListaCidades } from '@/lib/utilitarios';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import Logo from '@/componentes/ui/Logo';
import {
  Menu,
  X,
  Ticket,
  LogOut,
  LogIn,
  Search,
  MapPin,
  Home,
  Calendar,
  LayoutDashboard,
  ShoppingCart,
} from 'lucide-react';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';


import { obterCidadesCache, obterOuBuscarCidades } from '@/lib/cacheEventos';

function ConteudoCabecalhoCliente() {
  const { usuario, perfil, sair, carregando } = usarAutenticacao();
  const { totalItens } = usarCarrinho();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState(searchParams.get('busca') || '');
  const [cidadeSelecionada, setCidadeSelecionada] = useState(searchParams.get('cidade') || '');
  const [cidades, setCidades] = useState<string[]>(() => normalizarListaCidades(obterCidadesCache() || []));
  const supabase = criarClienteNavegador();

  useEffect(() => {
    setTermoBusca(searchParams.get('busca') || '');
    setCidadeSelecionada(searchParams.get('cidade') || '');
  }, [searchParams]);

  useEffect(() => {
    async function carregarCidades() {
      const lista = await obterOuBuscarCidades(supabase);
      if (lista && lista.length > 0) {
        setCidades(normalizarListaCidades(lista));
      }
    }
    carregarCidades();
    const interval = setInterval(() => {
      const c = obterCidadesCache();
      if (c && c.length > 0) setCidades(normalizarListaCidades(c));
    }, 2000);
    return () => clearInterval(interval);
  }, [supabase]);

  function navegarComFiltros(buscaVal: string, cidadeVal: string) {
    const params = new URLSearchParams();
    if (buscaVal.trim()) params.set('busca', buscaVal.trim());
    if (cidadeVal) params.set('cidade', cidadeVal);
    const queryString = params.toString();
    const rotaBase = pathname.includes('/sorteios')
      ? '/sorteios'
      : pathname.includes('/loja')
      ? '/loja'
      : '/eventos';
    router.push(`${rotaBase}${queryString ? `?${queryString}` : ''}`);
  }

  const [rolouPagina, setRolouPagina] = useState(false);

  useEffect(() => {
    function aoRolar() {
      if (typeof window !== 'undefined') {
        setRolouPagina(window.scrollY > 40);
      }
    }
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  const ehInicio = pathname === '/' || pathname === '/cliente';
  const ehEventos = pathname.startsWith('/eventos') || pathname.startsWith('/cliente/eventos');
  const ehSorteios = pathname.startsWith('/sorteios') || pathname.startsWith('/cliente/sorteios');
  const ehLoja = pathname.startsWith('/loja') || pathname.startsWith('/cliente/loja');
  const ehMeusIngressos = pathname.startsWith('/meus-ingressos') || pathname.startsWith('/cliente/meus-ingressos');
  const ehDiretoriaOuAdmin = perfil?.role === 'diretor' || perfil?.role === 'admin';

  const ocultarCabecalho = ehInicio && !rolouPagina && !menuAberto;

  const nomeUsuario = perfil?.nome || usuario?.user_metadata?.nome || usuario?.user_metadata?.full_name || usuario?.user_metadata?.name || '';
  const emailUsuario = perfil?.email || usuario?.email || '';

  return (
    <>
      {/* Drawer Overlay Backdrop */}
      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs pt-safe transition-all duration-300 ease-in-out",
          ocultarCabecalho
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100 shadow-md"
        )}
      >
        {/* Cinética Brand Gradient Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#c59941] via-[#dc2626] to-[#f4d68a]" />

        {/* Top Header Bar */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-20 gap-2 sm:gap-3">
            <Logo href="/" tamanhoIcone="md" tamanhoTexto="lg" />

            {/* Central Search Bar (Desktop) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navegarComFiltros(termoBusca, cidadeSelecionada);
              }}
              className="hidden lg:flex flex-1 max-w-xl items-center bg-slate-100/90 border border-slate-200 rounded-lg focus-within:border-[#c59941] focus-within:ring-2 focus-within:ring-[#c59941]/20 transition-all overflow-hidden"
            >
              <div className="flex items-center pl-3 text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Buscar eventos, ingressos ou cidades..."
                value={termoBusca}
                onChange={(e) => {
                  const val = e.target.value;
                  setTermoBusca(val);
                  if (pathname.includes('/eventos') || pathname.includes('/sorteios')) {
                    navegarComFiltros(val, cidadeSelecionada);
                  }
                }}
                style={{ outline: 'none', boxShadow: 'none' }}
                className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none shadow-none"
              />
              <div className="flex items-center border-l border-slate-200 px-3 py-2 text-xs font-bold uppercase text-[#9a7228] gap-1 bg-slate-200/50 shrink-0">
                <MapPin size={14} className="text-[#c59941] shrink-0" />
                <select
                  value={cidadeSelecionada}
                  onChange={(e) => {
                    const novaCidade = e.target.value;
                    setCidadeSelecionada(novaCidade);
                    navegarComFiltros(termoBusca, novaCidade);
                  }}
                  style={{ outline: 'none', boxShadow: 'none' }}
                  className="bg-transparent text-xs font-bold uppercase text-slate-800 cursor-pointer pr-1 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none border-none shadow-none"
                >
                  <option value="" className="bg-white text-slate-800">Todas as Cidades</option>
                  {cidades.map((c) => (
                    <option key={c} value={c} className="bg-white text-slate-800">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            {/* Right Action Menu */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Link
                href="/eventos"
                className="p-2 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center lg:hidden"
                aria-label="Buscar Eventos"
              >
                <Search size={20} />
              </Link>

              {/* Botão / Badge do Carrinho da Loja */}
              <Link
                href="/loja/carrinho"
                className="relative p-2 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200/80 hover:border-[#c59941]"
                aria-label="Carrinho de Compras"
              >
                <ShoppingCart size={20} className={totalItens > 0 ? "text-[#c59941]" : ""} />
                {totalItens > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#dc2626] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                    {totalItens}
                  </span>
                )}
              </Link>

              {!carregando && (
                <>
                  {usuario ? (
                    <div className="relative">
                      <button
                        onClick={() => setPerfilAberto(!perfilAberto)}
                        className="flex items-center gap-2 p-1.5 sm:pr-3 rounded-lg bg-slate-100 border border-slate-200 hover:border-[#c59941] transition-all min-h-[40px]"
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-[#c59941] to-[#9a7228] flex items-center justify-center text-xs font-black text-white shrink-0">
                          {nomeUsuario?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider hidden sm:block max-w-[150px] truncate">
                          {nomeUsuario || 'Minha Conta'}
                        </span>
                      </button>

                      {perfilAberto && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setPerfilAberto(false)}
                          />
                          <div className="absolute right-0 top-12 w-64 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 bg-slate-50">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {nomeUsuario || 'Usuário'}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {emailUsuario}
                              </p>
                            </div>
                            <div className="p-2 space-y-1">
                              {ehDiretoriaOuAdmin && (
                                <Link
                                  href="/diretor"
                                  onClick={() => setPerfilAberto(false)}
                                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-[#9a7228] bg-[#c59941]/15 hover:bg-[#c59941]/25 rounded-md transition-all border border-[#c59941]/30"
                                >
                                  <LayoutDashboard size={16} className="text-[#c59941]" />
                                  <span>Painel Cinética ({perfil?.role === 'admin' ? 'Admin' : 'Diretoria'})</span>
                                </Link>
                              )}
                              <Link
                                href="/meus-ingressos"
                                onClick={() => setPerfilAberto(false)}
                                className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-[#c59941]/10 hover:text-[#9a7228] rounded-md transition-all"
                              >
                                <Ticket size={16} className="text-[#c59941]" />
                                Meus Ingressos
                              </Link>
                              <Link
                                href="/loja/meus-pedidos"
                                onClick={() => setPerfilAberto(false)}
                                className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-[#c59941]/10 hover:text-[#9a7228] rounded-md transition-all"
                              >
                                <ShoppingCart size={16} className="text-[#c59941]" />
                                Pedidos da Loja
                              </Link>
                              <Link
                                href="/loja/carrinho"
                                onClick={() => setPerfilAberto(false)}
                                className="flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 rounded-md transition-all"
                              >
                                <span className="flex items-center gap-2.5">
                                  <ShoppingCart size={16} />
                                  Meu Carrinho
                                </span>
                                {totalItens > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#c59941] text-white text-[10px] font-black">
                                    {totalItens}
                                  </span>
                                )}
                              </Link>
                              <button
                                onClick={sair}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 rounded-md transition-all"
                              >
                                <LogOut size={16} />
                                Sair da Conta
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Link href="/autenticacao/entrar">
                        <Botao variante="fantasma" tamanho="sm" className="px-2.5 sm:px-3.5">
                          <LogIn size={15} className="mr-1" />
                          <span className="text-xs font-bold uppercase tracking-wider">Entrar</span>
                        </Botao>
                      </Link>
                      <Link href="/autenticacao/cadastro" className="hidden sm:inline-flex">
                        <Botao variante="festiva" tamanho="sm">
                          <span className="text-xs font-black uppercase tracking-wider">Criar Conta</span>
                        </Botao>
                      </Link>
                    </div>
                  )}
                </>
              )}

              {/* Mobile Hamburger */}
              <button
                onClick={() => setMenuAberto(!menuAberto)}
                className="p-1.5 text-slate-700 hover:text-slate-950 rounded-md hover:bg-slate-100 transition-all md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation"
                aria-label={menuAberto ? "Fechar Menu" : "Abrir Menu"}
              >
                {menuAberto ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Cinética Sub-Header Navigation Strip (Desktop) */}
        <div className="hidden md:block bg-slate-50 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-8 h-10 overflow-x-auto text-xs font-extrabold uppercase tracking-wider">
              <Link
                href="/"
                className={cn(
                  'py-2.5 transition-colors whitespace-nowrap flex items-center gap-1.5',
                  ehInicio
                    ? 'text-[#c59941] border-b-2 border-[#c59941]'
                    : 'text-slate-600 hover:text-slate-950'
                )}
              >
                <Home size={14} />
                Início
              </Link>

              <Link
                href="/eventos"
                className={cn(
                  'py-2.5 transition-colors whitespace-nowrap flex items-center gap-1.5',
                  ehEventos
                    ? 'text-[#c59941] border-b-2 border-[#c59941]'
                    : 'text-slate-600 hover:text-slate-950'
                )}
              >
                <Calendar size={14} />
                Todos os Eventos
              </Link>

              <Link
                href="/sorteios"
                className={cn(
                  'py-2.5 transition-colors whitespace-nowrap flex items-center gap-1.5',
                  ehSorteios
                    ? 'text-[#c59941] border-b-2 border-[#c59941]'
                    : 'text-slate-600 hover:text-slate-950'
                )}
              >
                <Ticket size={14} />
                Sorteios
              </Link>

              <Link
                href="/loja"
                className={cn(
                  'py-2.5 transition-colors whitespace-nowrap flex items-center gap-1.5',
                  ehLoja
                    ? 'text-[#c59941] border-b-2 border-[#c59941]'
                    : 'text-slate-600 hover:text-slate-950'
                )}
              >
                <ShoppingCart size={14} className="text-[#c59941]" />
                Loja Oficial
              </Link>

              {usuario && (
                <Link
                  href="/meus-ingressos"
                  className={cn(
                    'py-2.5 transition-colors whitespace-nowrap ml-auto flex items-center gap-1.5 font-black',
                    ehMeusIngressos
                      ? 'text-[#c59941] border-b-2 border-[#c59941]'
                      : 'text-[#9a7228] hover:text-[#c59941]'
                  )}
                >
                  <Ticket size={14} />
                  ★ Meus Ingressos
                </Link>
              )}

              {ehDiretoriaOuAdmin && (
                <Link
                  href="/diretor"
                  className={cn(
                    'py-1 px-3 my-auto rounded-md bg-[#0e1422] text-[#f4d68a] hover:bg-black hover:text-[#c59941] transition-all flex items-center gap-1.5 text-xs font-black shadow-xs border border-[#c59941]/40',
                    !usuario && 'ml-auto'
                  )}
                >
                  <LayoutDashboard size={13} className="text-[#c59941]" />
                  Painel Cinética
                </Link>
              )}
            </nav>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        <div
          className={cn(
            'md:hidden overflow-hidden transition-all duration-300 border-t border-slate-200 bg-white relative z-50',
            menuAberto ? 'max-h-[46rem]' : 'max-h-0 border-t-0'
          )}
        >
          <nav className="px-4 py-4 space-y-2">
            <Link
              href="/"
              onClick={() => setMenuAberto(false)}
              className={cn(
                'block px-3 py-2.5 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 min-h-[44px]',
                ehInicio
                  ? 'bg-[#c59941] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <Home size={16} />
              Início
            </Link>

            <Link
              href="/eventos"
              onClick={() => setMenuAberto(false)}
              className={cn(
                'block px-3 py-2.5 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 min-h-[44px]',
                ehEventos
                  ? 'bg-[#c59941] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <Calendar size={16} />
              Todos os Eventos
            </Link>

            <Link
              href="/sorteios"
              onClick={() => setMenuAberto(false)}
              className={cn(
                'block px-3 py-2.5 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 min-h-[44px]',
                ehSorteios
                  ? 'bg-[#c59941] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <Ticket size={16} />
              Sorteios & Rifas
            </Link>

            <Link
              href="/loja"
              onClick={() => setMenuAberto(false)}
              className={cn(
                'block px-3 py-2.5 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 min-h-[44px]',
                ehLoja
                  ? 'bg-[#c59941] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <ShoppingCart size={16} />
              Loja Oficial
            </Link>

            {ehDiretoriaOuAdmin && (
              <Link
                href="/diretor"
                onClick={() => setMenuAberto(false)}
                className="block px-3 py-2.5 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 bg-[#0e1422] text-[#f4d68a] border border-[#c59941]/40 min-h-[44px] shadow-sm"
              >
                <LayoutDashboard size={16} className="text-[#c59941]" />
                Painel Cinética ({perfil?.role === 'admin' ? 'Admin' : 'Diretoria'})
              </Link>
            )}

            {usuario ? (
              <>
                <Link
                  href="/meus-ingressos"
                  onClick={() => setMenuAberto(false)}
                  className={cn(
                    'block px-3 py-2.5 text-xs font-black uppercase tracking-wider rounded-md transition-all flex items-center gap-2 border border-[#c59941]/30 min-h-[44px]',
                    ehMeusIngressos
                      ? 'bg-[#c59941] text-white'
                      : 'text-[#9a7228] hover:bg-[#c59941]/10'
                  )}
                >
                  <Ticket size={16} />
                  ★ Meus Ingressos
                </Link>

                <div className="pt-2 border-t border-slate-200 mt-2 space-y-2">
                  <div className="px-3 py-2 bg-slate-100 rounded-md">
                    <p className="text-xs font-bold text-slate-900 truncate">{nomeUsuario || 'Usuário'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{emailUsuario}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuAberto(false);
                      sair();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 rounded-md min-h-[44px]"
                  >
                    <LogOut size={16} />
                    Sair da Conta
                  </button>
                </div>
              </>
            ) : (
              <div className="pt-3.5 border-t border-slate-200 mt-3 flex flex-col gap-3.5">
                <Link href="/autenticacao/entrar" onClick={() => setMenuAberto(false)} className="w-full">
                  <Botao variante="primario" larguraTotal tamanho="md">
                    <LogIn size={16} className="mr-1.5" />
                    Entrar na Conta
                  </Botao>
                </Link>
                <Link href="/autenticacao/cadastro" onClick={() => setMenuAberto(false)} className="w-full">
                  <Botao variante="festiva" larguraTotal tamanho="md">
                    Criar Conta Grátis
                  </Botao>
                </Link>
              </div>
            )}
          </nav>
        </div>

      </header>
    </>
  );
}

export default function CabecalhoCliente() {
  return (
    <Suspense fallback={null}>
      <ConteudoCabecalhoCliente />
    </Suspense>
  );
}

