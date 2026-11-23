'use client';

import { useState, useEffect } from 'react';
import { usarCookies } from '@/contextos/ContextoCookies';
import Botao from '@/componentes/ui/Botao';
import { Cookie, Shield, Check, X, ChevronDown, ChevronUp, Info } from 'lucide-react';
import Link from 'next/link';

export default function BannerCookies() {
  const {
    bannerAberto,
    preferencias,
    fecharBanner,
    salvarPreferencias,
    aceitarTodos,
    aceitarApenasEssenciais,
  } = usarCookies();

  const [montado, setMontado] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [analiticos, setAnaliticos] = useState(preferencias.analiticos);
  const [marketing, setMarketing] = useState(preferencias.marketing);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    setAnaliticos(preferencias.analiticos);
    setMarketing(preferencias.marketing);
  }, [preferencias]);

  function aoAceitarTodos() {
    setAnaliticos(true);
    setMarketing(true);
    aceitarTodos();
  }

  function aoAceitarEssenciais() {
    setAnaliticos(false);
    setMarketing(false);
    aceitarApenasEssenciais();
  }

  if (!montado || !bannerAberto) return null;

  return (
    <div className="banner-cookies fixed bottom-0 left-0 right-0 z-50 p-2.5 sm:p-5 pt-0 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-fundo-card/98 border border-borda-sutil backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 text-texto-principal pointer-events-auto animar-entrar-baixo border-t-2 border-t-[#c59941] max-h-[85vh] overflow-y-auto sem-barra-rolagem pb-safe">
        
        {/* Main Banner Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
          
          {/* Header & Text */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ouro to-ouro-classico flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Cookie className="w-5 h-5 text-white" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-black font-titulo text-texto-principal">
                  Preferências de Privacidade & Cookies
                </h3>

                <button
                  type="button"
                  onClick={fecharBanner}
                  className="p-1.5 text-texto-terciario hover:text-texto-secundario rounded-lg hover:bg-fundo-elevado transition-colors md:hidden shrink-0 touch-manipulation"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-texto-secundario leading-relaxed pr-2 md:pr-0 pb-2.5 sm:pb-3">
                Usamos cookies essenciais para manter seu login, o carrinho da loja e compras seguras. Com sua permissão, também
                usamos cookies analíticos e de marketing para melhorar a loja e avisar sobre novos sorteios.{' '}
                <Link href="/termos-e-privacidade#cookies" className="text-ouro font-bold underline hover:text-destaque transition-colors inline-block">
                  Política de Cookies.
                </Link>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 justify-end pt-2 md:pt-0 pb-2.5 md:pb-0 border-t md:border-t-0 border-borda-sutil">
            <button
              type="button"
              onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
              className="px-3.5 py-2 rounded-xl border border-borda-sutil text-xs font-bold text-texto-secundario hover:text-texto-principal hover:bg-fundo-elevado transition-all flex items-center gap-1.5 min-h-[44px] touch-manipulation flex-1 sm:flex-none justify-center"
            >
              <span>Personalizar</span>
              {mostrarDetalhes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              type="button"
              onClick={aoAceitarEssenciais}
              className="px-3.5 py-2 rounded-xl border border-borda-sutil text-xs font-bold text-texto-secundario hover:text-texto-principal hover:bg-fundo-elevado transition-all flex items-center min-h-[44px] touch-manipulation flex-1 sm:flex-none justify-center"
            >
              Só essenciais
            </button>

            <Botao
              variante="festiva"
              tamanho="sm"
              onClick={aoAceitarTodos}
              className="text-xs font-black uppercase min-h-[44px] px-5 flex-1 sm:flex-none justify-center"
            >
              Aceitar Todos
            </Botao>
          </div>
        </div>

        {/* Detailed Options Drawer */}
        {mostrarDetalhes && (
          <div className="mt-4 pt-4 border-t border-borda-sutil space-y-4 animar-entrar-baixo pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-texto-principal flex items-center gap-1.5">
                <Info size={14} className="text-ouro" />
                Categorias de Consentimento
              </h4>
              <span className="text-[11px] text-texto-secundario">Configure suas opções</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Essenciais */}
              <div className="p-3.5 bg-fundo-elevado/60 rounded-xl border border-borda-sutil flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-texto-principal flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-400 shrink-0" />
                    Essenciais
                  </p>
                  <p className="text-[10px] text-texto-secundario mt-1 leading-tight">Login, carrinho e checkout</p>
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/15 px-2 py-1 rounded border border-emerald-500/30 shrink-0">
                  Obrigatório
                </span>
              </div>

              {/* Analíticos */}
              <label className="p-3.5 bg-fundo-elevado/60 rounded-xl border border-borda-sutil flex items-center justify-between gap-2 cursor-pointer hover:border-ouro/50 transition-colors touch-manipulation">
                <div>
                  <p className="text-xs font-bold text-texto-principal">Analíticos</p>
                  <p className="text-[10px] text-texto-secundario mt-1 leading-tight">Estatísticas de uso da loja e sorteios</p>
                </div>
                <input
                  type="checkbox"
                  checked={analiticos}
                  onChange={(e) => setAnaliticos(e.target.checked)}
                  className="w-5 h-5 accent-[#c59941] rounded cursor-pointer shrink-0"
                />
              </label>

              {/* Marketing */}
              <label className="p-3.5 bg-fundo-elevado/60 rounded-xl border border-borda-sutil flex items-center justify-between gap-2 cursor-pointer hover:border-ouro/50 transition-colors touch-manipulation">
                <div>
                  <p className="text-xs font-bold text-texto-principal">Marketing</p>
                  <p className="text-[10px] text-texto-secundario mt-1 leading-tight">Lançamentos, sorteios e eventos</p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="w-5 h-5 accent-[#c59941] rounded cursor-pointer shrink-0"
                />
              </label>
            </div>

            {/* Bottom Actions of Drawer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-2 border-t border-borda-sutil mt-2">
              <p className="text-[11px] text-texto-secundario text-center sm:text-left">
                Suas preferências podem ser alteradas a qualquer momento no rodapé do site.
              </p>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Botao
                  variante="secundario"
                  tamanho="md"
                  onClick={() =>
                    salvarPreferencias({
                      essenciais: true,
                      analiticos,
                      marketing,
                    })
                  }
                  icone={<Check size={16} />}
                  className="text-xs font-black uppercase w-full sm:w-auto min-h-[44px] px-6 shadow-xl"
                >
                  Salvar Preferências
                </Botao>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
