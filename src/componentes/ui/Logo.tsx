'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utilitarios';

interface LogoProps {
  href?: string;
  subtitulo?: string;
  tamanhoIcone?: 'sm' | 'md' | 'lg';
  tamanhoTexto?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  aoClicar?: () => void;
}

export default function Logo({
  href,
  subtitulo,
  tamanhoIcone = 'md',
  tamanhoTexto = 'lg',
  className,
  aoClicar,
}: LogoProps) {
  const dimensoes = {
    sm: { w: 32, h: 32, caixa: 'w-8 h-8 rounded-lg' },
    md: { w: 40, h: 40, caixa: 'w-8 h-8 sm:w-10 sm:h-10 rounded-xl' },
    lg: { w: 48, h: 48, caixa: 'w-12 h-12 rounded-2xl' },
  }[tamanhoIcone];

  const estilosTextoMarca = {
    sm: 'text-base font-black tracking-tight font-titulo leading-none',
    md: 'text-lg sm:text-xl font-black tracking-tight font-titulo leading-none',
    lg: 'text-xl sm:text-2xl font-black tracking-tight font-titulo leading-none',
    xl: 'text-2xl sm:text-3xl font-black tracking-tight font-titulo leading-none',
  }[tamanhoTexto];

  const conteudo = (
    <div className={cn('flex items-center gap-2.5 group shrink-0', className)}>
      <div
        className={cn(
          'relative bg-[#121826] border border-[#c59941]/40 p-0.5 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0 overflow-hidden',
          dimensoes.caixa
        )}
      >
        <Image
          src="/cinetica-logo.png"
          alt="Atlética Cinética Logo"
          width={dimensoes.w}
          height={dimensoes.h}
          className="w-full h-full object-contain"
          priority
        />
      </div>
      <div className="flex flex-col">
        <span className={cn('text-slate-900 flex items-center gap-1', estilosTextoMarca)}>
          Cinética
          <span className="text-[#c59941] text-[10px] font-black uppercase tracking-wider not-italic px-1.5 py-0.5 rounded bg-[#c59941]/10 border border-[#c59941]/25 ml-0.5">
            Fisio
          </span>
        </span>
        {subtitulo ? (
          <span className="block text-[10px] text-slate-500 font-sans not-italic font-normal tracking-normal mt-0.5">
            {subtitulo}
          </span>
        ) : (
          <span className="block text-[10px] text-slate-500 font-sans not-italic font-medium tracking-normal">
            A.A.A.F.A.
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={aoClicar} className="shrink-0">
        {conteudo}
      </Link>
    );
  }

  return conteudo;
}
