import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utilitarios';

interface Props {
  rotulo: string;
  titulo: React.ReactNode;
  descricao?: string;
  link?: { href: string; texto: string };
  className?: string;
  /** Use h1 para o título principal da página. */
  nivel?: 'h1' | 'h2';
}

/** Cabeçalho de seção: rótulo pequeno em dourado, título grande e link opcional. */
export default function TituloSecao({ rotulo, titulo, descricao, link, className, nivel = 'h2' }: Props) {
  const Titulo = nivel;
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10', className)}>
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-ouro mb-3">
          <span className="w-6 h-0.5 bg-ouro rounded-full" />
          {rotulo}
        </p>
        <Titulo className="titulo-display text-[2.6rem] sm:text-6xl text-texto-principal">{titulo}</Titulo>
        {descricao && <p className="mt-4 text-base text-texto-secundario leading-relaxed">{descricao}</p>}
      </div>
      {link && (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-2 self-start sm:self-auto shrink-0 px-5 py-3 rounded-full border border-borda-media text-sm font-bold text-texto-principal hover:border-ouro hover:text-ouro transition-colors"
        >
          {link.texto}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
