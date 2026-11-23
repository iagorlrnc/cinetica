'use client';

import ImagemOtimizada from '@/componentes/ui/ImagemOtimizada';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { cn, normalizarListaCidades } from '@/lib/utilitarios';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import Logo from '@/componentes/ui/Logo';
import {
  X,
  Search,
  MapPin,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { obterCidadesCache, obterOuBuscarCidades } from '@/lib/cacheEventos';

const LINKS = [
  { rotulo: 'Início', href: '/' },
  { rotulo: 'Loja', href: '/loja' },
  { rotulo: 'Sorteios', href: '/sorteios' },
  { rotulo: 'Eventos', href: '/eventos' },
];

function ConteudoCabecalhoCliente() {
  const { usuario, perfil, carregando } = usarAutenticacao();
  const { totalItens } = usarCarrinho();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '/';

  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState(searchParams.get('busca') || '');
  const [cidadeSelecionada, setCidadeSelecionada] = useState(searchParams.get('cidade') || '');
  const [cidades, setCidades] = useState<string[]>(() => normalizarListaCidades(obterCidadesCache() || []));
  const [rolou, setRolou] = useState(false);
  const campoBuscaRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(() => criarClienteNavegador());

  useEffect(() => {
    setTermoBusca(searchParams.get('busca') || '');
    setCidadeSelecionada(searchParams.get('cidade') || '');
  }, [searchParams]);

  useEffect(() => {
    let ativo = true;
    obterOuBuscarCidades(supabase).then((lista) => {
      if (ativo && lista && lista.length > 0) setCidades(normalizarListaCidades(lista));
    });
    return () => {
      ativo = false;
    };
  }, [supabase]);

  useEffect(() => {
    function aoRolar() {
      setRolou(window.scrollY > 12);
    }
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  useEffect(() => {
    if (buscaAberta) campoBuscaRef.current?.focus();
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setBuscaAberta(false);
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [buscaAberta]);

  // Fecha menus ao trocar de página
  useEffect(() => {
    setBuscaAberta(false);
  }, [pathname]);

  function navegarComFiltros(buscaVal: string, cidadeVal: string) {
    const params = new URLSearchParams();
    if (buscaVal.trim()) params.set('busca', buscaVal.trim());
    if (cidadeVal) params.set('cidade', cidadeVal);
    const queryString = params.toString();
    const rotaBase = pathname.includes('/sorteios') ? '/sorteios' : pathname.includes('/loja') ? '/loja' : '/eventos';
    router.push(`${rotaBase}${queryString ? `?${queryString}` : ''}`);
    setBuscaAberta(false);
  }

  const estaAtivo = (rota: string) =>
    rota === '/'
      ? pathname === '/' || pathname === '/cliente'
      : pathname.startsWith(rota) || pathname.startsWith(`/cliente${rota}`);

  const nomeUsuario =
    perfil?.nome || usuario?.user_metadata?.nome || usuario?.user_metadata?.full_name || usuario?.user_metadata?.name || '';
  const primeiroNome = String(nomeUsuario).split(' ')[0];

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 pt-safe">
        <div
          className={cn(
            'transition-all duration-300',
            rolou ? 'bg-azul-950/85 backdrop-blur-xl border-b border-borda-sutil' : 'bg-transparent border-b border-transparent'
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[72px] sm:h-20 flex items-center justify-between gap-3">
            <Logo href="/" tamanhoIcone="md" tamanhoTexto="md" />

            {/* Navegação desktop em pílula */}
            <nav
              aria-label="Seções"
              className="hidden lg:flex items-center gap-1 rounded-full bg-fundo-card/80 border border-borda-sutil p-1 backdrop-blur"
            >
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={estaAtivo(link.href) ? 'page' : undefined}
                  className={cn(
                    'px-5 py-2 rounded-full text-sm font-bold transition-all',
                    estaAtivo(link.href)
                      ? 'bg-ouro text-azul-950'
                      : 'text-texto-secundario hover:text-texto-principal hover:bg-fundo-hover'
                  )}
                >
                  {link.rotulo}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setBuscaAberta((v) => !v)}
                aria-label="Buscar"
                aria-expanded={buscaAberta}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-texto-principal bg-fundo-card/80 border border-borda-sutil hover:border-ouro/60 transition-colors cursor-pointer"
              >
                {buscaAberta ? <X size={19} /> : <Search size={19} />}
              </button>

              <Link
                href="/loja/carrinho"
                aria-label={`Carrinho${totalItens ? ` com ${totalItens} itens` : ''}`}
                className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-texto-principal bg-fundo-card/80 border border-borda-sutil hover:border-ouro/60 transition-colors"
              >
                <ShoppingCart size={19} />
                {totalItens > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-ouro text-azul-950 text-[10px] font-black flex items-center justify-center ring-2 ring-azul-950">
                    {totalItens}
                  </span>
                )}
              </Link>

              {!carregando &&
                (usuario ? (
                  // Sem menu suspenso: no celular a conta fica na barra inferior; no computador, link direto
                  <Link
                    href="/minha-conta"
                    aria-label="Minha conta"
                    className="hidden lg:flex items-center gap-2 h-11 pl-1 pr-4 rounded-full bg-fundo-card/80 border border-borda-sutil hover:border-ouro/60 transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-ouro-vivo to-ouro-classico flex items-center justify-center text-sm font-black text-azul-950 font-titulo">
                      {perfil?.avatar_url ? (
                        <ImagemOtimizada src={perfil.avatar_url} alt="" largura={48} comPlaceholder={false} className="w-full h-full object-cover" />
                      ) : (
                        primeiroNome?.[0]?.toUpperCase() || 'U'
                      )}
                    </span>
                    <span className="text-sm font-bold text-texto-principal max-w-[110px] truncate">{primeiroNome || 'Minha conta'}</span>
                  </Link>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5">
                    <Link
                      href="/autenticacao/entrar"
                      className="hidden sm:inline-flex h-11 items-center px-4 rounded-full text-sm font-bold text-texto-principal hover:text-ouro transition-colors"
                    >
                      Entrar
                    </Link>
                    <Link href="/autenticacao/cadastro" className="botao-pop h-11 px-5 text-sm">
                      Criar conta
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Painel de busca */}
        {buscaAberta && (
          <div className="border-b border-borda-sutil bg-azul-950/95 backdrop-blur-xl animar-entrar-baixo">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navegarComFiltros(termoBusca, cidadeSelecionada);
              }}
              className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-2"
              role="search"
            >
              <label className="campo-pop flex items-center gap-2 px-4 h-14 flex-1">
                <Search size={20} className="text-ouro shrink-0" />
                <span className="sr-only">Termo de busca</span>
                <input
                  ref={campoBuscaRef}
                  type="search"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder={
                    pathname.includes('/loja') ? 'Camisa, caneca, tirante...' : 'Busque festas, jogos, calouradas...'
                  }
                  maxLength={80}
                  className="w-full bg-transparent text-base text-texto-principal placeholder:text-texto-terciario outline-none"
                />
              </label>
              <div className="flex gap-2">
                <label className="campo-pop flex items-center gap-2 px-4 h-14 sm:w-52">
                  <MapPin size={18} className="text-ouro shrink-0" />
                  <span className="sr-only">Cidade</span>
                  <select
                    value={cidadeSelecionada}
                    onChange={(e) => setCidadeSelecionada(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-texto-principal outline-none cursor-pointer"
                  >
                    <option value="">Todas as cidades</option>
                    {cidades.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="botao-pop h-14 w-14 sm:w-auto sm:px-6 shrink-0" aria-label="Buscar">
                  <span className="hidden sm:inline">Buscar</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </form>
          </div>
        )}
      </header>
    </>
  );
}

export default function CabecalhoCliente() {
  return (
    <Suspense fallback={<div className="fixed top-0 inset-x-0 h-20 z-50" />}>
      <ConteudoCabecalhoCliente />
    </Suspense>
  );
}
