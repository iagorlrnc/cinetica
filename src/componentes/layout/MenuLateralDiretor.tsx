'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utilitarios';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import {
  LayoutDashboard,
  Trophy,
  CalendarDays,
  ScanLine,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
  X,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import Logo from '@/componentes/ui/Logo';
import { VERSAO_SISTEMA } from '@/lib/constantes';

const itensMenu = [
  { href: '/', icone: LayoutDashboard, rotulo: 'Dashboard' },
  { href: '/atletica', icone: Trophy, rotulo: 'Atlética Cinética' },
  { href: '/eventos', icone: CalendarDays, rotulo: 'Meus Eventos' },
  { href: '/produtos', icone: ShoppingCart, rotulo: 'Produtos' },
  { href: '/metricas-loja', icone: BarChart3, rotulo: 'Métricas da Loja' },
  { href: '/validar-entrada', icone: ScanLine, rotulo: 'Validar Entrada' },
];


export default function MenuLateralDiretor() {
  const pathname = usePathname();
  const { perfil, sair } = usarAutenticacao();
  const [recolhido, setRecolhido] = useState(false);
  const [mobileAberto, setMobileAberto] = useState(false);

  const rotaBase = pathname.startsWith('/diretor') ? '/diretor' : '';

  function resolverHref(href: string) {
    if (href === '/') return rotaBase || '/';
    return `${rotaBase}${href}`;
  }

  return (
    <>
      {/* Top Mobile Navigation Bar (< md) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 pt-safe bg-white/95 backdrop-blur-md border-b border-slate-200 z-40 px-4 flex items-center justify-between">
        <Logo href={rotaBase || '/'} subtitulo="Painel Cinética" tamanhoIcone="sm" tamanhoTexto="sm" />

        <button
          onClick={() => setMobileAberto(!mobileAberto)}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
          aria-label="Abrir Menu"
        >
          {mobileAberto ? <X size={20} /> : <MenuIcon size={20} />}
        </button>
      </div>

      {/* Mobile Menu Drawer & Overlay (< md) */}
      {mobileAberto && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileAberto(false)}
          />

          <aside className="relative z-10 w-72 bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <Logo href={rotaBase || '/'} subtitulo="Painel Cinética" tamanhoIcone="sm" tamanhoTexto="sm" aoClicar={() => setMobileAberto(false)} />
              <button
                onClick={() => setMobileAberto(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto">
              {itensMenu.map((item) => {
                const destino = resolverHref(item.href);
                const ativo =
                  pathname === destino ||
                  (item.href !== '/' && pathname.startsWith(destino));

                return (
                  <Link
                    key={item.href}
                    href={destino}
                    onClick={() => setMobileAberto(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                      ativo
                        ? 'bg-[#c59941]/15 text-[#9a7228] border border-[#c59941]/30 font-bold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    )}
                  >
                    <item.icone size={20} className="flex-shrink-0" />
                    <span>{item.rotulo}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <Link
                href="/"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <ExternalLink size={18} className="flex-shrink-0" />
                <span>Voltar ao Site</span>
              </Link>
              <button
                onClick={sair}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut size={18} className="flex-shrink-0" />
                <span>Sair</span>
              </button>

              {perfil && (
                <div className="mt-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {perfil.nome}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{perfil.email}</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-center gap-2">
                <strong className="text-xs text-slate-900">Cinética <span className="text-[#c59941]">Fisio</span></strong>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200">
                  {VERSAO_SISTEMA}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Fixed Sidebar (>= md) */}
      <aside
        className={cn(
          'hidden md:flex fixed left-0 top-0 h-screen z-30 flex-col bg-white border-r border-slate-200 shadow-sm transition-all duration-300',
          recolhido ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          {!recolhido && (
            <Logo href={rotaBase || '/'} subtitulo="Painel Cinética" tamanhoIcone="sm" tamanhoTexto="sm" />
          )}
          <button
            onClick={() => setRecolhido(!recolhido)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            {recolhido ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {itensMenu.map((item) => {
            const destino = resolverHref(item.href);
            const ativo =
              pathname === destino ||
              (item.href !== '/' && pathname.startsWith(destino));

            return (
              <Link
                key={item.href}
                href={destino}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  ativo
                    ? 'bg-[#c59941]/15 text-[#9a7228] border border-[#c59941]/30 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
                title={recolhido ? item.rotulo : undefined}
              >
                <item.icone size={20} className="flex-shrink-0" />
                {!recolhido && <span>{item.rotulo}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            title={recolhido ? 'Voltar ao Site' : undefined}
          >
            <ExternalLink size={18} className="flex-shrink-0" />
            {!recolhido && <span>Voltar ao Site</span>}
          </Link>
          <button
            onClick={sair}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
            title={recolhido ? 'Sair' : undefined}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!recolhido && <span>Sair</span>}
          </button>

          {!recolhido && perfil && (
            <div className="mt-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {perfil.nome}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{perfil.email}</p>
            </div>
          )}

          <div className="pt-3 mt-1 border-t border-slate-200 flex items-center justify-center">
            {!recolhido ? (
              <div className="flex items-center gap-2">
                <strong className="text-xs text-slate-900">Cinética <span className="text-[#c59941]">Fisio</span></strong>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200">
                  {VERSAO_SISTEMA}
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200" title={`MeuIngrss ${VERSAO_SISTEMA}`}>
                {VERSAO_SISTEMA}
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
