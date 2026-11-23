'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, ShoppingCart, ArrowRight } from 'lucide-react';
import { cn, formatarMoeda } from '@/lib/utilitarios';
import type { ProdutoLoja } from '@/tipos';

const INTERVALO_MS = 5500;
const DISTANCIA_MINIMA_SWIPE = 45;
type Fase = 'repouso' | 'amassando' | 'desamassando';

interface Props {
  produtos: ProdutoLoja[];
  carregando: boolean;
}

const doisDigitos = (n: number) => n.toString().padStart(2, '0');

/**
 * Etiqueta de preço (tag de loja): corpo amarelo com borda tracejada e furo,
 * presa por um fio cujo ponto inicial (canto superior esquerdo do SVG) fica
 * colado no canto da foto do produto. Balança a partir desse ponto.
 */
function EtiquetaPreco({
  valor,
  visivel,
  style,
}: {
  valor: number;
  visivel: boolean;
  style: CSSProperties;
}) {
  const gratis = valor <= 0;
  const [reais, centavos] = formatarMoeda(valor).replace(/^R\$\s?/, '').split(',');
  return (
    <div
      aria-hidden="true"
      style={{ ...style, transformOrigin: '7px 4px' }}
      className={cn(
        'absolute z-30 w-[64px] sm:w-[84px] lg:w-[92px] aspect-[100/190] pointer-events-none transition-opacity duration-300',
        visivel ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="w-full h-full animar-balancar-etiqueta" style={{ transformOrigin: '7px 4px' }}>
        <svg viewBox="0 0 100 190" className="absolute inset-0 w-full h-full overflow-visible drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]">
          {/* Fio */}
          <path
            d="M 8 4 C 30 -10, 62 6, 56 30 C 52 46, 40 52, 52 66"
            fill="none"
            stroke="#6b4a1b"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Corpo da etiqueta */}
          <path
            d="M 50 50 L 82 76 Q 86 79 86 84 L 86 178 Q 86 188 76 188 L 24 188 Q 14 188 14 178 L 14 84 Q 14 79 18 76 Z"
            fill="#f6b916"
          />
          {/* Borda tracejada interna */}
          <path
            d="M 50 58 L 78 81 L 78 176 Q 78 180 74 180 L 26 180 Q 22 180 22 176 L 22 81 Z"
            fill="none"
            stroke="#e08a00"
            strokeWidth="2.6"
            strokeDasharray="7 5"
            strokeLinejoin="round"
          />
          {/* Furo com ilhós */}
          <circle cx="50" cy="70" r="6.5" fill="#fff3c4" />
          <circle cx="50" cy="70" r="4" fill="#070d22" />
          {/* Ponta do fio passando pelo furo */}
          <path d="M 52 66 C 54 68, 53 72, 50 72" fill="none" stroke="#6b4a1b" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {/* Preço */}
        <div className="absolute inset-x-[16%] top-[47%] bottom-[8%] flex flex-col items-center justify-center text-azul-950 leading-none text-center">
          {gratis ? (
            <>
              <span className="font-titulo font-extrabold text-[8px] sm:text-[10px] uppercase tracking-wider opacity-75">Brinde</span>
              <span className="font-titulo font-extrabold text-[10px] sm:text-[13px] lg:text-[14px] uppercase tracking-tight mt-1">
                Grátis
              </span>
            </>
          ) : (
            <>
              <span className="font-titulo font-extrabold text-[9px] sm:text-[11px] tracking-wider">R$</span>
              <span className="font-titulo font-extrabold text-[19px] sm:text-[25px] lg:text-[27px] tracking-tight mt-0.5">{reais}</span>
              {centavos && centavos !== '00' && (
                <span className="font-titulo font-extrabold text-[10px] sm:text-[12px] mt-0.5">,{centavos}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hero da página inicial: carrossel dos produtos da loja (vindos do banco) segurados
 * pela mão da Cinética, que fecha e abre a cada troca de produto.
 *
 * A troca automática é guiada pela animação do segmento ativo (CSS): ao terminar,
 * passa para o próximo. Assim, pausar (mouse em cima, foco, aba oculta) é só pausar a animação.
 * A troca segue mesmo com "reduzir movimento", como no hero original.
 */
export default function HeroProdutos({ produtos, carregando }: Props) {
  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<Fase>('repouso');
  const [abaOculta, setAbaOculta] = useState(false);
  const timeoutTrocaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutFimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toqueInicioX = useRef<number | null>(null);

  const total = produtos.length;
  const produto = total > 0 ? produtos[indice % total] : null;

  const irPara = useCallback(
    (novo: number) => {
      if (fase !== 'repouso' || novo === indice) return;
      // 1. A mão fecha e os textos saem
      setFase('amassando');
      // 2. Com o punho fechado, troca o produto
      timeoutTrocaRef.current = setTimeout(() => {
        setIndice(novo);
        setFase('desamassando');
        // 3. A mão abre de novo
        timeoutFimRef.current = setTimeout(() => setFase('repouso'), 300);
      }, 280);
    },
    [fase, indice]
  );

  const proximo = useCallback(() => total > 1 && irPara((indice + 1) % total), [total, indice, irPara]);
  const anterior = useCallback(() => total > 1 && irPara((indice - 1 + total) % total), [total, indice, irPara]);

  // Troca automática de produto
  useEffect(() => {
    if (total <= 1 || fase !== 'repouso' || abaOculta) return;
    const timer = setTimeout(proximo, INTERVALO_MS);
    return () => clearTimeout(timer);
  }, [total, fase, abaOculta, proximo]);

  // Pausa com a aba em segundo plano
  useEffect(() => {
    const atualizarVisibilidade = () => setAbaOculta(document.visibilityState === 'hidden');
    atualizarVisibilidade();
    document.addEventListener('visibilitychange', atualizarVisibilidade);
    return () => document.removeEventListener('visibilitychange', atualizarVisibilidade);
  }, []);

  // Pré-carrega as fotos para a troca não piscar
  useEffect(() => {
    for (const p of produtos) {
      const url = p.images?.[0];
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    }
  }, [produtos]);

  useEffect(
    () => () => {
      if (timeoutTrocaRef.current) clearTimeout(timeoutTrocaRef.current);
      if (timeoutFimRef.current) clearTimeout(timeoutFimRef.current);
    },
    []
  );

  const fechando = fase === 'amassando';
  const tamanhos = (produto?.sizes || []).filter(Boolean);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Produtos em destaque"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') proximo();
        if (e.key === 'ArrowLeft') anterior();
      }}
      onTouchStart={(e) => {
        toqueInicioX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (toqueInicioX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? toqueInicioX.current) - toqueInicioX.current;
        toqueInicioX.current = null;
        if (Math.abs(dx) < DISTANCIA_MINIMA_SWIPE) return;
        if (dx < 0) proximo();
        else anterior();
      }}
      className="relative -mt-[72px] sm:-mt-20 overflow-hidden bg-azul-900 text-white min-h-[100dvh] flex flex-col justify-end outline-none"
    >
      <style>{`@keyframes heroTimerRing { from { stroke-dashoffset: 44; } to { stroke-dashoffset: 0; } }`}</style>
      {carregando ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-4 border-ouro/20 border-t-ouro animar-girar" aria-label="Carregando" />
        </div>
      ) : produto ? (
        <div className="relative w-full flex-1 flex flex-col justify-end pt-28 sm:pt-32 overflow-hidden">
          {/* Fundo: foto do produto desfocada + vinhetas + brilho dourado */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-azul-900" aria-hidden="true">
            <div className={cn('absolute inset-0 transition-opacity duration-300', fechando ? 'opacity-20' : 'opacity-100')}>
              {produto.images?.[0] ? (
                <img src={produto.images[0]} alt="" className="w-full h-full object-cover brightness-75 scale-110 blur-[2px]" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-ouro-classico to-azul-800" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-azul-900 via-azul-900/85 to-azul-900/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-azul-900 via-azul-900/70 to-transparent" />
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-azul-900 to-transparent" />
            </div>
            <div className="brilho-ouro w-[520px] h-[520px] right-[-6%] bottom-[-12%] opacity-60" />
            <div className="brilho-azul w-[600px] h-[600px] -left-60 -top-40 opacity-50" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-20 w-full flex flex-col justify-end items-start gap-4 lg:grid lg:grid-cols-12 lg:gap-10 lg:items-end">
            {/* Textos */}
            <div className="w-full lg:col-span-7 lg:pb-20 flex flex-col items-start">
              <p className="flex items-center gap-2.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-ouro mb-3">
                <span className="w-6 h-0.5 bg-ouro rounded-full" />
                Loja oficial · destaque
                {total > 1 && (
                  <button
                    type="button"
                    onClick={proximo}
                    aria-label="Próximo produto em destaque"
                    className="inline-flex items-center gap-1.5 font-mono tracking-normal text-texto-secundario hover:text-white transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 -rotate-90 shrink-0" viewBox="0 0 18 18" aria-hidden="true">
                      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                      <circle
                        key={`${indice}-${fase}`}
                        cx="9"
                        cy="9"
                        r="7"
                        fill="none"
                        stroke="#f2c14e"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="44"
                        style={{
                          animation:
                            fase === 'repouso' && !abaOculta
                              ? `heroTimerRing ${INTERVALO_MS}ms linear forwards`
                              : 'none',
                        }}
                      />
                    </svg>
                  </button>
                )}
              </p>

              {/* Cada linha tem altura fixa: trocar de produto não muda a altura do hero */}
              <div
                aria-live="polite"
                className={cn(
                  'w-full transition-all duration-200',
                  fechando ? 'opacity-0 -translate-y-1.5 blur-[2px]' : 'opacity-100 translate-y-0 blur-0'
                )}
              >
                <div className="h-7 flex items-center gap-2 overflow-hidden">
                  {produto.stock_quantity > 0 ? (
                    <span className="selo !text-[10px] !py-1 bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {produto.stock_quantity <= 5 ? `Só ${produto.stock_quantity} em estoque` : 'Pronta entrega'}
                    </span>
                  ) : (
                    <span className="selo !text-[10px] !py-1 bg-red-500/15 text-red-300 border border-red-500/30">Esgotado</span>
                  )}
                  {produto.category && (
                    <span className="selo !text-[10px] !py-1 bg-white/5 text-texto-secundario border border-white/10">{produto.category}</span>
                  )}
                </div>

                <div className="mt-3 h-[2em] flex items-end text-[1.75rem] sm:text-4xl lg:text-[2.75rem] leading-none">
                  <h1
                    title={produto.name}
                    className="font-titulo font-extrabold tracking-tight leading-none text-white drop-shadow-md max-w-xl uppercase line-clamp-2 break-words"
                  >
                    {produto.name}
                  </h1>
                </div>

                <p className="mt-2 h-5 text-sm text-texto-secundario line-clamp-1 max-w-lg">
                  {produto.description && produto.description.trim().toLowerCase() !== produto.name.trim().toLowerCase()
                    ? produto.description
                    : ' '}
                </p>

                <div className="mt-3 h-12 flex items-end gap-x-5">
                  <div className="shrink-0">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-texto-terciario font-bold mb-1">
                      {produto.price === 0 ? 'Brinde' : 'Por'}
                    </span>
                    <span className="font-titulo font-extrabold text-2xl sm:text-3xl texto-ouro leading-none">
                      {produto.price === 0 ? 'Grátis' : formatarMoeda(produto.price / 100)}
                    </span>
                  </div>
                  {tamanhos.length > 0 && (
                    <ul className="flex gap-1 overflow-hidden" aria-label="Tamanhos disponíveis">
                      {tamanhos.slice(0, 5).map((t) => (
                        <li
                          key={t}
                          className="min-w-7 h-7 px-1.5 rounded-lg border border-white/15 bg-white/5 text-[11px] font-bold text-white flex items-center justify-center shrink-0"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pt-5 flex flex-wrap items-center gap-2.5">
                <Link href={`/loja/produto/${produto.id}`} className="botao-pop h-11 px-5 text-sm sm:text-base">
                  <ShoppingCart size={16} /> Comprar agora
                </Link>
                <Link href="/loja" className="botao-vazado h-11 px-5 text-sm sm:text-base">
                  Ver loja <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            {/* Mão segurando o produto */}
            <div className="w-full lg:col-span-5 flex justify-center lg:justify-end items-end self-end -translate-y-4 sm:-translate-y-6 lg:-translate-y-8">
              <div
                className={cn(
                  'relative w-full max-w-[340px] sm:max-w-[440px] md:max-w-[470px] lg:max-w-[480px] xl:max-w-[540px] 2xl:max-w-[600px] aspect-square select-none transition-transform duration-300 ease-out origin-bottom',
                  fechando ? 'scale-[0.97]' : 'scale-100'
                )}
              >
                <Link
                  href={`/loja/produto/${produto.id}`}
                  title={produto.name}
                  aria-label={`Ver ${produto.name}`}
                  style={{ top: '24.1%', left: '22.7%', width: '56.3%', height: '41.5%' }}
                  className={cn(
                    'absolute z-0 block transition-opacity duration-300',
                    fechando ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:brightness-110'
                  )}
                >
                  <div className="w-full h-full border-2 sm:border-4 border-white shadow-2xl overflow-hidden bg-azul-950 flex items-center justify-center">
                    {produto.images?.[0] ? (
                      <img src={produto.images[0]} alt={produto.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag size={28} className="text-ouro" />
                    )}
                  </div>
                </Link>

                {/* Mão aberta */}
                <img
                  src="/MAO-INICIO.png"
                  alt="Mão da Cinética segurando o produto"
                  draggable={false}
                  className={cn(
                    'absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none z-10 drop-shadow-[0_20px_35px_rgba(0,0,0,0.7)] transition-opacity duration-300',
                    fechando ? 'opacity-0' : 'opacity-100'
                  )}
                />
                {/* Mão fechada */}
                <img
                  src="/MAO-FECHADA.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className={cn(
                    'absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none z-20 drop-shadow-[0_20px_35px_rgba(0,0,0,0.85)] transition-opacity duration-300',
                    fechando ? 'opacity-100' : 'opacity-0'
                  )}
                />

                {/* Etiqueta de preço pendurada no canto da foto do produto */}
                <EtiquetaPreco
                  valor={produto.price / 100}
                  visivel={!fechando}
                  style={{ left: 'calc(79% - 7px)', top: 'calc(24.1% - 4px)' }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Sem produtos cadastrados: mantém a identidade com a logo
        <div className="flex-1 flex flex-col items-center justify-center gap-6 pt-40 pb-20 px-4 text-center">
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden ring-4 ring-ouro shadow-[0_0_80px_-10px_rgba(242,193,78,0.5)] animar-flutuar">
            <Image src="/cinetica-logo.png" alt="Atlética Cinética" fill sizes="256px" className="object-cover" priority />
          </div>
          <Link href="/eventos" className="botao-pop h-14 px-8 text-lg">
            Ver eventos
          </Link>
        </div>
      )}
    </section>
  );
}
