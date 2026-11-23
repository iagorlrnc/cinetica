'use client';

import ImagemOtimizada from '@/componentes/ui/ImagemOtimizada';
import Link from 'next/link';
import { MapPin, ArrowUpRight, Ticket } from 'lucide-react';
import { cn, formatarHora, formatarMoeda } from '@/lib/utilitarios';
import {
  menorPrecoDisponivel,
  partesData,
  rotuloContagem,
  situacaoEvento,
  ROTULO_SITUACAO_EVENTO,
  type SituacaoEvento,
} from '@/lib/eventos';
import type { LoteIngresso } from '@/tipos';

export interface EventoParaCard {
  id: string;
  slug?: string | null;
  titulo: string;
  imagem_url: string | null;
  data_evento: string;
  local: string;
  cidade: string;
  status: string;
  atletica?: { nome: string } | null;
  lotes_ingresso?: Pick<LoteIngresso, 'preco' | 'quantidade_total' | 'quantidade_vendida' | 'ativo'>[] | null;
}

const ESTILO_SITUACAO: Record<SituacaoEvento, string> = {
  cancelado: 'bg-red-500 text-white',
  encerrado: 'bg-azul-700 text-texto-secundario',
  esgotado: 'bg-red-500 text-white',
  ultimos: 'bg-white text-azul-950',
  disponivel: 'bg-emerald-400 text-azul-950',
};

interface Props {
  evento: EventoParaCard;
  agora: number;
  /** Variante grande para destaque (usada no topo da página inicial). */
  destaque?: boolean;
  className?: string;
}

/**
 * Card de evento em formato "pôster": imagem vertical, selo de data colado
 * e informações sobre um degradê azul-marinho.
 */
export default function CardEvento({ evento, agora, destaque = false, className }: Props) {
  const data = partesData(evento.data_evento);
  const situacao = situacaoEvento(evento, agora);
  const preco = menorPrecoDisponivel(evento.lotes_ingresso);
  const contagem = situacao === 'disponivel' || situacao === 'ultimos' ? rotuloContagem(evento.data_evento, agora) : null;
  const inativo = situacao === 'encerrado' || situacao === 'cancelado';

  return (
    <Link
      href={`/eventos/${evento.slug || evento.id}`}
      className={cn(
        'group relative block overflow-hidden rounded-[1.75rem] bg-fundo-card border border-borda-sutil transition-all duration-300 hover:-translate-y-1.5 hover:border-ouro/60 hover:shadow-[0_28px_60px_-25px_rgba(242,193,78,0.45)]',
        destaque ? 'aspect-[4/5] sm:aspect-[16/10] lg:aspect-[4/5]' : 'aspect-[4/5]',
        className
      )}
    >
      {evento.imagem_url ? (
        <ImagemOtimizada
          src={evento.imagem_url}
          alt=""
          largura={384}
          altura={480}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]',
            inativo && 'grayscale opacity-60'
          )}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-azul-700 via-azul-850 to-azul-950 fundo-pontos flex items-center justify-center">
          <Ticket className="w-16 h-16 text-ouro/40 -rotate-12" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-azul-950 via-azul-950/60 to-transparent" />

      {/* Selo de data */}
      <div className="absolute top-4 left-4 flex flex-col items-center justify-center w-16 h-[4.5rem] rounded-2xl bg-ouro text-azul-950 shadow-[3px_3px_0_#070d22] -rotate-3 group-hover:rotate-0 transition-transform">
        <span className="text-[10px] font-black tracking-widest leading-none">{data.mes}</span>
        <span className="font-titulo font-extrabold text-3xl leading-none mt-0.5">{data.dia}</span>
        <span className="text-[9px] font-bold leading-none mt-0.5 opacity-70">{data.semana}</span>
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
        <span className={cn('selo', ESTILO_SITUACAO[situacao])}>{ROTULO_SITUACAO_EVENTO[situacao]}</span>
        {contagem && <span className="selo bg-azul-950/80 text-ouro border border-ouro/40 backdrop-blur">{contagem}</span>}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        {evento.atletica?.nome && (
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ouro mb-2 truncate">{evento.atletica.nome}</p>
        )}
        <h3
          className={cn(
            'font-titulo font-extrabold text-texto-principal leading-[0.95] tracking-tight line-clamp-3',
            destaque ? 'text-3xl sm:text-4xl' : 'text-2xl'
          )}
        >
          {evento.titulo}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-texto-secundario truncate">
          <MapPin size={14} className="text-ouro shrink-0" />
          <span className="truncate">
            {evento.local}
            {evento.cidade ? ` · ${evento.cidade}` : ''} · {formatarHora(evento.data_evento)}
          </span>
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-titulo font-extrabold text-lg text-texto-principal">
            {inativo || preco === null ? (
              <span className="text-texto-terciario text-base">{ROTULO_SITUACAO_EVENTO[situacao]}</span>
            ) : preco === 0 ? (
              'Grátis'
            ) : (
              <>
                <span className="text-xs font-bold text-texto-terciario mr-1">a partir de</span>
                {formatarMoeda(preco)}
              </>
            )}
          </span>
          <span className="w-11 h-11 rounded-full bg-ouro text-azul-950 flex items-center justify-center shrink-0 transition-transform group-hover:rotate-45">
            <ArrowUpRight size={20} strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}
