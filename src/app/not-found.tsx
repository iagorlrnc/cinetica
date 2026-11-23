'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft, Ticket, CalendarDays } from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import Logo from '@/componentes/ui/Logo';

export default function PaginaNaoEncontrada() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-fundo-principal text-texto-principal flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-ouro selection:text-azul-900 relative overflow-hidden">
      {/* Background Subtle Decorative Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-ouro/10 via-ouro-claro/10 to-azul-900/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Bar Centered */}
      <header className="mb-6 relative z-10 text-center">
        <Logo href="/" tamanhoIcone="md" tamanhoTexto="lg" className="mx-auto" />
      </header>

      {/* Central 404 Hero Section */}
      <main className="w-full max-w-xl relative z-10">
        <div className="w-full text-center space-y-8 bg-fundo-card border border-borda-sutil rounded-3xl p-8 sm:p-12 shadow-xl shadow-black/30 relative overflow-hidden">
          
          {/* Cinética Gold Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ouro via-ouro-claro to-ouro-classico" />

          {/* 404 Animated Badge */}
          <div className="relative inline-flex items-center justify-center mx-auto">
            <div className="absolute -inset-3 bg-gradient-to-r from-ouro to-ouro-claro rounded-3xl opacity-25 blur-xl animate-pulse" />
            <div className="relative bg-azul-900 border border-ouro/40 px-8 py-3 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-6xl sm:text-7xl font-black tracking-normal text-ouro inline-block px-3 py-1 leading-none select-none text-center">
                404
              </span>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <h1 className="titulo-display text-5xl sm:text-6xl text-texto-principal">
              Página Não Encontrada
            </h1>
            <p className="text-texto-secundario text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              Ops! Parece que o ingresso para essa página não existe ou o endereço foi alterado.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="w-full sm:w-auto">
              <Botao variante="festiva" tamanho="lg" icone={<Home size={18} />} larguraTotal>
                Voltar para o Início
              </Botao>
            </Link>

            <button
              onClick={() => router.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-borda-sutil bg-fundo-elevado/60 hover:bg-fundo-elevado text-texto-secundario hover:text-texto-principal font-bold text-sm transition-all min-h-[48px] touch-manipulation cursor-pointer shadow-sm"
            >
              <ArrowLeft size={18} />
              <span>Voltar Página</span>
            </button>
          </div>

          {/* Secondary Quick Links */}
          <div className="pt-6 border-t border-borda-sutil flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-texto-secundario">
            <span className="text-texto-terciario">Links Úteis:</span>
            <Link href="/eventos" className="hover:text-ouro transition-colors flex items-center gap-1.5">
              <CalendarDays size={14} className="text-ouro" />
              <span>Explorar Eventos</span>
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/meus-ingressos" className="hover:text-ouro transition-colors flex items-center gap-1.5">
              <Ticket size={14} className="text-ouro" />
              <span>Meus Ingressos</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="mt-6 text-center text-xs text-texto-secundario relative z-10">
        <p>© {new Date().getFullYear()} <strong className="text-texto-secundario">Atlética Cinética</strong></p>
      </footer>
    </div>
  );
}
