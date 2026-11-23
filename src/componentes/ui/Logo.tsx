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
    sm: { w: 40, h: 40, caixa: 'w-9 h-9' },
    md: { w: 48, h: 48, caixa: 'w-10 h-10 sm:w-12 sm:h-12' },
    lg: { w: 64, h: 64, caixa: 'w-14 h-14' },
  }[tamanhoIcone];

  const estilosTextoMarca = {
    sm: 'text-[15px]',
    md: 'text-[14px] min-[400px]:text-[16px] sm:text-lg',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
  }[tamanhoTexto];

  const conteudo = (
    <div className={cn('flex items-center gap-3 group shrink-0', className)}>
      <div
        className={cn(
          'relative rounded-full bg-azul-950 overflow-hidden shrink-0 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105',
          dimensoes.caixa
        )}
      >
        <Image
          src="/cinetica-logo.png"
          alt="Atlética Cinética"
          width={dimensoes.w}
          height={dimensoes.h}
          className="w-full h-full object-cover scale-[1.12]"
          priority
        />
      </div>
      <div className="flex flex-col justify-center leading-none">
        <span
          className={cn(
            'font-titulo font-extrabold uppercase tracking-[0.03em] sm:tracking-[0.06em] text-texto-principal whitespace-nowrap leading-none transition-colors group-hover:text-ouro',
            estilosTextoMarca
          )}
        >
          Atlética Cinética
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.22em] text-texto-terciario">
          <span className="w-3 h-px bg-ouro" aria-hidden="true" />
          {subtitulo || 'Afya · Fisioterapia'}
        </span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={aoClicar} className="shrink-0" aria-label="Cinética: página inicial">
        {conteudo}
      </Link>
    );
  }

  return conteudo;
}
