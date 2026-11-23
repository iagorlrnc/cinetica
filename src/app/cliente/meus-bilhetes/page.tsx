'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Gift, Trophy, CalendarDays, RotateCcw, LogIn, Ticket } from 'lucide-react';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import TituloSecao from '@/componentes/ui/TituloSecao';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import Botao from '@/componentes/ui/Botao';
import { cn, formatarDataHora } from '@/lib/utilitarios';
import {
  STATUS_SORTEIO_ROTULO,
  ehBilhetePremiado,
  ehErroTabelaSorteiosAusente,
  formatarNumeroBilhete,
} from '@/lib/sorteios';
import type { StatusSorteio } from '@/tipos';

interface SorteioDoBilhete {
  id: string;
  titulo: string;
  status: StatusSorteio;
  data_sorteio: string;
  total_cotas: number;
  premio_principal: string;
  imagem_url: string | null;
  ganhador_nome: string | null;
  ganhador_bilhete: string | null;
  atletica: { nome: string } | null;
}

interface LinhaBilhete {
  id: string;
  numero: number;
  criado_em: string;
  sorteio: SorteioDoBilhete | SorteioDoBilhete[] | null;
}

interface Grupo {
  sorteio: SorteioDoBilhete;
  bilhetes: { id: string; numero: number; criado_em: string }[];
}

const ESTILO_STATUS: Record<string, string> = {
  ativo: 'bg-emerald-400 text-azul-950',
  em_breve: 'bg-azul-eletrico text-white',
  encerrado: 'bg-azul-700 text-texto-secundario',
};

export default function PaginaMeusBilhetes() {
  const { usuario, carregando: carregandoAuth } = usarAutenticacao();
  const [supabase] = useState(() => criarClienteNavegador());
  const [linhas, setLinhas] = useState<LinhaBilhete[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    (async () => {
      // RLS garante que só os bilhetes do próprio usuário voltam
      const { data, error } = await supabase
        .from('sorteio_bilhetes')
        .select(
          'id, numero, criado_em, sorteio:sorteios(id, titulo, status, data_sorteio, total_cotas, premio_principal, imagem_url, ganhador_nome, ganhador_bilhete, atletica:atleticas(nome))'
        )
        .eq('usuario_id', usuario.id)
        .order('criado_em', { ascending: false })
        .limit(1000);
      if (!ativo) return;
      if (error && !ehErroTabelaSorteiosAusente(error)) {
        setErro(true);
        setLinhas([]);
      } else {
        setErro(false);
        setLinhas((data || []) as unknown as LinhaBilhete[]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, usuario, tentativa]);

  const grupos = useMemo<Grupo[]>(() => {
    const mapa = new Map<string, Grupo>();
    for (const l of linhas || []) {
      const s = Array.isArray(l.sorteio) ? l.sorteio[0] : l.sorteio;
      if (!s) continue; // sorteio oculto (rascunho/cancelado) não aparece
      const atletica = Array.isArray(s.atletica) ? s.atletica[0] ?? null : s.atletica;
      const grupo: Grupo = mapa.get(s.id) ?? { sorteio: { ...s, atletica }, bilhetes: [] };
      grupo.bilhetes.push({ id: l.id, numero: l.numero, criado_em: l.criado_em });
      mapa.set(s.id, grupo);
    }
    const peso: Record<string, number> = { ativo: 0, em_breve: 1, encerrado: 2 };
    return [...mapa.values()]
      .map((g) => ({ ...g, bilhetes: g.bilhetes.sort((a, b) => a.numero - b.numero) }))
      .sort((a, b) => (peso[a.sorteio.status] ?? 9) - (peso[b.sorteio.status] ?? 9));
  }, [linhas]);

  const totalBilhetes = grupos.reduce((acc, g) => acc + g.bilhetes.length, 0);
  const carregando = carregandoAuth || (usuario && linhas === null);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-20">
      <TituloSecao
        nivel="h1"
        rotulo="Sua conta"
        titulo={<>Meus <span className="texto-ouro">bilhetes</span></>}
        descricao="Seus números da sorte ficam guardados aqui, só você tem acesso."
        link={{ href: '/sorteios', texto: 'Ver sorteios' }}
      />

      {!carregandoAuth && !usuario ? (
        <EstadoVazio
          titulo="Entre para ver seus bilhetes"
          descricao="Os bilhetes ficam ligados à sua conta."
          icone={<LogIn className="w-7 h-7" />}
          acao={
            <Link href="/autenticacao/entrar?redirecionar=/meus-bilhetes" className="botao-pop h-12 px-6">
              Entrar
            </Link>
          }
        />
      ) : carregando ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-[1.75rem]" />
          ))}
        </div>
      ) : erro ? (
        <EstadoVazio
          titulo="Não foi possível carregar"
          descricao="Verifique sua conexão e tente novamente."
          icone={<RotateCcw className="w-7 h-7" />}
          acao={<Botao onClick={() => setTentativa((t) => t + 1)}>Tentar novamente</Botao>}
        />
      ) : grupos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum bilhete ainda"
          descricao="Quando a diretoria confirmar seu Pix, seus números aparecem aqui."
          icone={<Ticket className="w-7 h-7" />}
          acao={
            <Link href="/sorteios" className="botao-pop h-12 px-6">
              Participar de um sorteio
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-texto-terciario mb-6">
            {totalBilhetes} {totalBilhetes === 1 ? 'bilhete' : 'bilhetes'} em {grupos.length}{' '}
            {grupos.length === 1 ? 'sorteio' : 'sorteios'}
          </p>
          <div className="space-y-5">
            {grupos.map(({ sorteio: s, bilhetes }) => {
              const premiado = s.status === 'encerrado' ? bilhetes.find((b) => ehBilhetePremiado(b.numero, s.ganhador_bilhete)) : undefined;
              return (
                <article
                  key={s.id}
                  className={cn(
                    'rounded-[1.75rem] bg-fundo-card border p-5 sm:p-6',
                    premiado ? 'border-ouro shadow-[0_24px_60px_-28px_rgba(242,193,78,0.6)]' : 'border-borda-sutil'
                  )}
                >
                  <div className="flex gap-4">
                    {s.imagem_url ? (
                      <img src={s.imagem_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-borda-sutil shrink-0" />
                    ) : (
                      <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-ouro text-azul-950 flex items-center justify-center shrink-0 -rotate-3">
                        <Gift className="w-8 h-8" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={cn('selo !py-0.5', ESTILO_STATUS[s.status] || 'bg-fundo-elevado text-texto-secundario')}>
                          {STATUS_SORTEIO_ROTULO[s.status]}
                        </span>
                        {s.atletica?.nome && <span className="text-xs font-bold text-texto-terciario uppercase tracking-wider truncate">{s.atletica.nome}</span>}
                      </div>
                      <h2 className="font-titulo font-extrabold text-xl text-texto-principal leading-tight">{s.titulo}</h2>
                      <p className="text-sm text-texto-secundario mt-1 flex items-center gap-1.5">
                        <Trophy size={14} className="text-ouro shrink-0" />
                        <span className="truncate">{s.premio_principal}</span>
                      </p>
                      <p className="text-xs text-texto-terciario mt-1 flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-ouro" /> Apuração: {formatarDataHora(s.data_sorteio)}
                      </p>
                    </div>
                  </div>

                  {premiado && (
                    <p className="mt-4 p-3 rounded-2xl bg-ouro text-azul-950 font-titulo font-extrabold text-center">
                      🎉 Seu bilhete {formatarNumeroBilhete(premiado.numero, s.total_cotas)} foi o premiado!
                    </p>
                  )}

                  <div className="mt-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-texto-terciario mb-2">
                      Seus números ({bilhetes.length})
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {bilhetes.map((b) => {
                        const ehPremiado = premiado?.id === b.id;
                        return (
                          <li
                            key={b.id}
                            title={`Registrado em ${formatarDataHora(b.criado_em)}`}
                            className={cn(
                              'relative px-4 py-2 rounded-xl border-2 border-dashed font-mono font-black text-lg tracking-wider',
                              ehPremiado ? 'bg-ouro border-azul-950 text-azul-950' : 'bg-ouro/10 border-ouro/50 text-ouro'
                            )}
                          >
                            {formatarNumeroBilhete(b.numero, s.total_cotas)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {s.status === 'encerrado' && s.ganhador_nome && !premiado && (
                    <p className="mt-4 text-xs text-texto-secundario">
                      Resultado: {s.ganhador_nome}
                      {s.ganhador_bilhete ? ` · bilhete ${s.ganhador_bilhete}` : ''}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
