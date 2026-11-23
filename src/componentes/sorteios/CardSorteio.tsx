'use client';

import { Gift, Trophy, Clock, CalendarDays } from 'lucide-react';
import { cn, formatarDataHora, formatarMoeda } from '@/lib/utilitarios';
import {
  STATUS_SORTEIO_ROTULO,
  calcularProgressoCotas,
  cotasRestantes,
  sorteioAceitaParticipacao,
} from '@/lib/sorteios';
import type { Sorteio } from '@/tipos';

interface Props {
  sorteio: Sorteio;
  agora: number;
  aoParticipar?: (s: Sorteio) => void;
  aoVerRegulamento?: (s: Sorteio) => void;
  /** Versão resumida (página inicial): só prêmio, progresso e preço. */
  compacto?: boolean;
}

const ESTILO_STATUS: Record<string, string> = {
  ativo: 'bg-emerald-400 text-azul-950',
  em_breve: 'bg-azul-eletrico text-white',
  encerrado: 'bg-azul-700 text-texto-secundario',
};

/** Card de sorteio no formato de bilhete: corpo com prêmio e canhoto com o valor da cota. */
export default function CardSorteio({ sorteio: s, agora, aoParticipar, aoVerRegulamento, compacto = false }: Props) {
  const porcentagem = calcularProgressoCotas(s.cotas_vendidas, s.total_cotas);
  const aceita = sorteioAceitaParticipacao(s, new Date(agora));
  const restantes = cotasRestantes(s);
  const emDestaque = s.destaque && s.status === 'ativo';

  return (
    <article
      className={cn(
        'relative flex flex-col md:flex-row overflow-hidden rounded-[1.75rem] bg-fundo-card border transition-all duration-300',
        emDestaque ? 'border-ouro shadow-[0_24px_60px_-28px_rgba(242,193,78,0.55)]' : 'border-borda-sutil hover:border-borda-media'
      )}
    >
      {/* Corpo do bilhete */}
      <div className="relative flex-1 p-6 sm:p-7 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {emDestaque && <span className="adesivo text-[11px] !py-1">★ Destaque</span>}
          <span className={cn('selo', ESTILO_STATUS[s.status] || 'bg-fundo-elevado text-texto-secundario')}>
            {STATUS_SORTEIO_ROTULO[s.status]}
          </span>
          {s.atletica?.nome && (
            <span className="text-xs font-bold text-texto-terciario uppercase tracking-wider truncate">{s.atletica.nome}</span>
          )}
        </div>

        <div className="flex gap-4 sm:gap-5">
          {s.imagem_url ? (
            <img
              src={s.imagem_url}
              alt=""
              loading="lazy"
              className={cn('rounded-2xl object-cover border border-borda-sutil shrink-0', compacto ? 'w-20 h-20' : 'w-24 h-24 sm:w-32 sm:h-32')}
            />
          ) : (
            <div
              className={cn(
                'rounded-2xl bg-gradient-to-br from-ouro to-ouro-classico flex items-center justify-center shrink-0 rotate-[-4deg]',
                compacto ? 'w-20 h-20' : 'w-24 h-24 sm:w-32 sm:h-32'
              )}
            >
              <Gift className="w-10 h-10 text-azul-950" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className={cn('font-titulo font-extrabold text-texto-principal leading-[1.02] tracking-tight break-words', compacto ? 'text-xl' : 'text-2xl sm:text-3xl')}>
              {s.titulo}
            </h3>
            {s.subtitulo && <p className="text-sm font-bold text-ouro mt-1">{s.subtitulo}</p>}
            <p className="mt-2 text-sm text-texto-principal flex gap-1.5">
              <Trophy size={16} className="text-ouro shrink-0 mt-0.5" />
              <span className="font-semibold">{s.premio_principal}</span>
            </p>
          </div>
        </div>

        {!compacto && s.descricao && (
          <p className="mt-5 text-sm text-texto-secundario leading-relaxed whitespace-pre-line max-w-3xl">{s.descricao}</p>
        )}

        {!compacto && s.premios_secundarios.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {s.premios_secundarios.map((premio, idx) => (
              <li key={idx} className="selo bg-fundo-elevado border border-borda-sutil text-texto-secundario normal-case tracking-normal font-semibold">
                <span className="text-ouro font-black">{idx + 2}º</span> {premio}
              </li>
            ))}
          </ul>
        )}

        {s.status === 'encerrado' && s.ganhador_nome && (
          <div className="mt-5 p-4 rounded-2xl bg-ouro/10 border border-ouro/40 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-texto-principal flex items-center gap-2">
              <Trophy size={18} className="text-ouro" />
              <span>
                Ganhador(a): <strong>{s.ganhador_nome}</strong>
                {s.ganhador_cidade ? ` (${s.ganhador_cidade})` : ''}
              </span>
            </p>
            {s.ganhador_bilhete && (
              <span className="font-mono text-sm font-black text-ouro px-3 py-1 rounded-full border border-ouro/40">
                Nº {s.ganhador_bilhete}
              </span>
            )}
          </div>
        )}

        <p className="mt-5 text-xs font-semibold text-texto-terciario flex items-center gap-1.5">
          <CalendarDays size={14} className="text-ouro" />
          Apuração: {formatarDataHora(s.data_sorteio)}
        </p>
      </div>

      {/* Picote */}
      <div className="relative md:w-0 h-0 md:h-auto border-t-2 md:border-t-0 md:border-l-2 border-dashed border-borda-media mx-6 md:mx-0 md:my-6" aria-hidden="true">
        <span className="absolute -left-9 md:-left-3 -top-3 md:-top-9 w-6 h-6 rounded-full bg-fundo-principal" />
        <span className="absolute -right-9 md:-left-3 -top-3 md:top-auto md:-bottom-9 w-6 h-6 rounded-full bg-fundo-principal" />
      </div>

      {/* Canhoto */}
      <div className="md:w-72 p-6 sm:p-7 flex flex-col justify-between gap-5 bg-fundo-elevado/40">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-texto-terciario">Cota</p>
          <p className="font-titulo font-extrabold text-4xl text-ouro leading-none mt-1">
            {s.valor_cota > 0 ? formatarMoeda(s.valor_cota) : 'Grátis'}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-texto-secundario">{porcentagem}% vendido</span>
            <span className="text-texto-terciario">{restantes} restantes</span>
          </div>
          <div
            className="h-3 rounded-full bg-azul-950 border border-borda-sutil overflow-hidden"
            role="progressbar"
            aria-label="Cotas vendidas"
            aria-valuenow={porcentagem}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[repeating-linear-gradient(-45deg,#f2c14e_0_8px,#ffd25e_8px_16px)] transition-all duration-700"
              style={{ width: `${porcentagem}%` }}
            />
          </div>
        </div>

        {aoParticipar ? (
          <div className="space-y-2">
            {aceita ? (
              <button type="button" onClick={() => aoParticipar(s)} className="botao-pop w-full h-12 text-base">
                {s.valor_cota > 0 ? 'Quero participar' : 'Resgatar cota grátis'}
              </button>
            ) : (
              <span className="w-full h-12 rounded-full bg-fundo-hover text-texto-secundario text-sm font-bold flex items-center justify-center gap-2">
                {s.status === 'em_breve' ? (
                  <>
                    <Clock size={16} /> Abre em breve
                  </>
                ) : s.status === 'encerrado' ? (
                  'Sorteio finalizado'
                ) : (
                  'Cotas esgotadas'
                )}
              </span>
            )}
            {aoVerRegulamento && (aceita || s.regulamento) && (
              <button
                type="button"
                onClick={() => aoVerRegulamento(s)}
                className="w-full text-center text-xs font-semibold text-texto-secundario hover:text-ouro underline underline-offset-4 transition-colors cursor-pointer"
              >
                Ver regulamento
              </button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
