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

/**
 * Botões da identidade Cinética: formato pílula, dourado vivo com texto azul-marinho
 * e um "degrau" 3D no estilo festivo. Todos usam tokens, então funcionam tanto no
 * tema escuro público quanto no painel claro.
 */
const estilosVariante: Record<VarianteBotao, string> = {
  primario:
    'bg-ouro text-azul-950 hover:bg-ouro-vivo font-titulo font-extrabold shadow-[0_3px_0_#8a6a1f] hover:-translate-y-px active:translate-y-0.5 active:shadow-none',
  festiva:
    'bg-ouro text-azul-950 hover:bg-ouro-vivo font-titulo font-extrabold shadow-[0_5px_0_#8a6a1f] hover:-translate-y-0.5 hover:shadow-[0_7px_0_#8a6a1f] active:translate-y-1 active:shadow-[0_1px_0_#8a6a1f]',
  secundario:
    'bg-azul-800 text-ouro-claro hover:bg-azul-700 border border-ouro/30 font-titulo font-extrabold',
  fantasma:
    'bg-transparent text-texto-secundario hover:bg-fundo-hover hover:text-texto-principal font-bold',
  perigo:
    'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 font-bold',
  sucesso:
    'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold',
  contorno:
    'bg-transparent border-2 border-ouro text-destaque hover:bg-ouro hover:text-azul-950 font-titulo font-extrabold',
};

const estilosTamanho: Record<TamanhoBotao, string> = {
  sm: 'px-4 py-2 text-xs gap-1.5 min-h-[38px]',
  md: 'px-5 py-2.5 text-sm gap-2 min-h-[44px]',
  lg: 'px-7 py-3 text-base gap-2.5 min-h-[50px]',
  xl: 'px-9 py-4 text-lg gap-3 min-h-[58px]',
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
            'inline-flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer touch-manipulation select-none',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0',
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
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
