'use client';

import { ButtonHTMLAttributes, forwardRef, memo } from 'react';
import { cn } from '@/lib/utilitarios';

type VarianteBotao = 'primario' | 'festiva' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso' | 'contorno';
type TamanhoBotao = 'sm' | 'md' | 'lg' | 'xl';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  carregando?: boolean;
  icone?: React.ReactNode;
  larguraTotal?: boolean;
}

const estilosVariante: Record<VarianteBotao, string> = {
  primario:
    'bg-[#c59941] hover:bg-[#b08535] text-white font-extrabold uppercase tracking-wider shadow-sm hover:shadow-md active:scale-[0.98]',
  festiva:
    'bg-gradient-to-r from-[#c59941] via-[#d4af37] to-[#9a7228] hover:brightness-105 text-white font-black uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.98]',
  secundario:
    'bg-[#121826] text-[#f4d68a] hover:bg-[#1a2337] border border-[#c59941]/30 font-black uppercase tracking-wider active:scale-[0.98]',
  fantasma:
    'bg-transparent text-slate-700 hover:bg-slate-200/70 hover:text-slate-950 font-bold',
  perigo:
    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-[0.98]',
  sucesso:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98]',
  contorno:
    'bg-transparent border border-[#c59941] text-[#9a7228] hover:bg-[#c59941]/10 active:scale-[0.98] font-bold uppercase tracking-wide',
};

const estilosTamanho: Record<TamanhoBotao, string> = {
  sm: 'px-3.5 py-2 text-xs gap-1.5 rounded-lg font-bold min-h-[38px]',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl font-bold min-h-[44px]',
  lg: 'px-6 py-3 text-sm font-black gap-2.5 rounded-xl uppercase tracking-wider min-h-[48px]',
  xl: 'px-8 py-3.5 text-base font-black gap-3 rounded-2xl uppercase tracking-wider min-h-[52px]',
};

const Botao = memo(
  forwardRef<HTMLButtonElement, BotaoProps>(
    (
      {
        variante = 'primario',
        tamanho = 'md',
        carregando = false,
        icone,
        larguraTotal = false,
        className,
        children,
        disabled,
        ...props
      },
      ref
    ) => {
      return (
        <button
          ref={ref}
          disabled={disabled || carregando}
          className={cn(
            'inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer touch-manipulation select-none active:scale-[0.98]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            estilosVariante[variante],
            estilosTamanho[tamanho],
            larguraTotal && 'w-full',
            className
          )}
          {...props}
        >
          {carregando ? (
            <>
              <svg
                className="animar-girar h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Carregando...</span>
            </>
          ) : (
            <>
              {icone && <span className="flex-shrink-0">{icone}</span>}
              {children}
            </>
          )}
        </button>
      );
    }
  )
);

Botao.displayName = 'Botao';

export default Botao;
