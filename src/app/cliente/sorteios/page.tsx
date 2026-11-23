'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Copy, AlertCircle, RotateCcw, Ticket, Clover, UserRound } from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import Modal from '@/componentes/ui/Modal';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import TituloSecao from '@/componentes/ui/TituloSecao';
import CardSorteio from '@/componentes/sorteios/CardSorteio';
import CheckoutPixSorteio from '@/componentes/sorteios/CheckoutPixSorteio';
import Link from 'next/link';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import {
  COLUNAS_SORTEIO_PUBLICO,
  STATUS_SORTEIO_PUBLICOS,
  ehErroTabelaSorteiosAusente,
  normalizarSorteio,
  ordenarSorteios,
} from '@/lib/sorteios';
import type { Sorteio } from '@/tipos';

type Filtro = 'todos' | 'ativo' | 'em_breve' | 'encerrado';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativo', rotulo: 'Rolando agora' },
  { id: 'em_breve', rotulo: 'Em breve' },
  { id: 'encerrado', rotulo: 'Resultados' },
];

export default function PaginaSorteios() {
  const [supabase] = useState(() => criarClienteNavegador());
  const { usuario } = usarAutenticacao();
  const [agora] = useState(() => Date.now());
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selecionado, setSelecionado] = useState<Sorteio | null>(null);
  const [regulamento, setRegulamento] = useState<Sorteio | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase
      .from('sorteios')
      .select(COLUNAS_SORTEIO_PUBLICO)
      .in('status', STATUS_SORTEIO_PUBLICOS)
      .order('data_sorteio', { ascending: true })
      .limit(100);

    if (error && ehErroTabelaSorteiosAusente(error)) {
      // Módulo de sorteios ainda não instalado no banco: para o público, simplesmente não há sorteios.
      console.warn('Tabela "sorteios" ausente: aplique supabase/migracoes/033_hardening_seguranca_e_sorteios.sql');
      setSorteios([]);
    } else if (error) {
      setErro('Não foi possível carregar os sorteios agora.');
    } else {
      const normalizados = ((data || []) as unknown as Parameters<typeof normalizarSorteio>[0][]).map(normalizarSorteio);
      setSorteios(ordenarSorteios(normalizados));
    }
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: sorteios.length, ativo: 0, em_breve: 0, encerrado: 0 };
    for (const s of sorteios) {
      if (s.status in c) c[s.status as Filtro]++;
    }
    return c;
  }, [sorteios]);

  const filtrados = filtro === 'todos' ? sorteios : sorteios.filter((s) => s.status === filtro);

  function abrirParticipacao(s: Sorteio) {
    setSelecionado(s);
  }

  return (
    <>
      <section className="relative overflow-hidden fundo-granulado border-b border-borda-sutil">
        <div className="absolute inset-0 fundo-pontos opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden="true" />
        <div className="brilho-azul w-[520px] h-[520px] -top-56 -left-40" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8">
          <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
            <TituloSecao
              nivel="h1"
              rotulo="Sorteios e rifas"
              titulo={
                <>
                  Tenta a <span className="texto-ouro">sorte,</span>
                  <br className="hidden sm:block" /> ajuda a atlética.
                </>
              }
              descricao="Toda cota vendida vira projeto, festa e campeonato pra fisio."
              className="!mb-0"
            />
            <div className="hidden lg:flex items-center justify-center w-40 h-40 rounded-full bg-ouro text-azul-950 rotate-12 shadow-[6px_6px_0_#070d22] animar-balancar">
              <div className="text-center leading-none">
                <Clover className="mx-auto mb-1" />
                <span className="font-titulo font-extrabold text-4xl block">{contagem.ativo}</span>
                <span className="text-xs font-black uppercase tracking-wider">rolando</span>
              </div>
            </div>
          </div>

          {usuario && (
            <Link
              href="/meus-bilhetes"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ouro/40 bg-ouro/10 text-sm font-bold text-ouro hover:bg-ouro hover:text-azul-950 transition-colors"
            >
              <Ticket size={16} /> Ver meus bilhetes
            </Link>
          )}

          <div role="tablist" aria-label="Filtrar sorteios" className="mt-8 flex gap-2 overflow-x-auto sem-barra-rolagem -mx-4 px-4 sm:mx-0 sm:px-0">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filtro === f.id}
                data-ativo={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className="chip h-12 px-5"
              >
                {f.rotulo}
                <span className="ml-1 px-2 py-0.5 rounded-full bg-azul-950/20 text-[11px] font-black">{contagem[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        {carregando ? (
          <div className="space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-72 rounded-[1.75rem]" />
            ))}
          </div>
        ) : erro ? (
          <EstadoVazio
            titulo="Erro ao carregar"
            descricao={erro}
            icone={<AlertCircle className="w-7 h-7" />}
            acao={
              <Botao variante="primario" icone={<RotateCcw size={16} />} onClick={carregar}>
                Tentar novamente
              </Botao>
            }
          />
        ) : filtrados.length === 0 ? (
          <EstadoVazio
            titulo={sorteios.length === 0 ? 'Nenhum sorteio no ar' : 'Nada nessa categoria'}
            descricao={
              sorteios.length === 0
                ? 'Quando a diretoria lançar uma ação nova, ela aparece aqui.'
                : 'Dá uma olhada nos outros filtros.'
            }
            icone={<Gift className="w-7 h-7" />}
            acao={
              filtro !== 'todos' ? (
                <Botao variante="contorno" onClick={() => setFiltro('todos')}>
                  Ver todos
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-6">
            {filtrados.map((s) => (
              <CardSorteio
                key={s.id}
                sorteio={s}
                agora={agora}
                aoParticipar={abrirParticipacao}
                aoVerRegulamento={setRegulamento}
              />
            ))}
          </div>
        )}

        <section className="mt-20">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ouro mb-3">Passo a passo</p>
          <h2 className="titulo-display text-4xl sm:text-5xl text-texto-principal mb-8">Como participar</h2>
          <ol className="grid md:grid-cols-3 gap-4">
            {[
              { icone: Ticket, titulo: 'Escolhe as cotas', texto: 'Quanto mais cotas, mais chances de levar.' },
              { icone: Copy, titulo: 'Paga no Pix', texto: 'Usa a chave Pix oficial que aparece na participação.' },
              { icone: UserRound, titulo: 'Bilhete na sua conta', texto: 'Seu bilhete fica guardado na sua conta individual, só você tem acesso.' },
            ].map(({ icone: Icone, titulo, texto }, i) => (
              <li key={titulo} className="cartao-pop p-6">
                <div className="flex items-center justify-between mb-8">
                  <span className="w-12 h-12 rounded-2xl bg-ouro text-azul-950 flex items-center justify-center -rotate-6">
                    <Icone size={22} strokeWidth={2.4} />
                  </span>
                  <span className="font-titulo font-extrabold text-6xl text-texto-principal/10 leading-none">{i + 1}</span>
                </div>
                <h3 className="font-titulo font-extrabold text-xl text-texto-principal">{titulo}</h3>
                <p className="text-sm text-texto-secundario mt-1.5">{texto}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Modal aberto={!!selecionado} aoFechar={() => setSelecionado(null)} tamanho="md">
        {selecionado && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ouro">
                {selecionado.atletica?.nome || 'Atlética Cinética'} · Ação oficial
              </p>
              <h3 className="font-titulo font-extrabold text-2xl sm:text-3xl text-texto-principal leading-tight mt-1">
                {selecionado.titulo}
              </h3>
            </div>

            {usuario ? (
              <CheckoutPixSorteio sorteio={selecionado} aoConcluir={carregar} />
            ) : (
              <div className="p-5 rounded-3xl bg-fundo-elevado border border-borda-media text-center space-y-3">
                <p className="font-titulo font-extrabold text-xl text-texto-principal">Entre na sua conta para participar</p>
                <p className="text-sm text-texto-secundario">Seus bilhetes ficam guardados na sua conta, só você tem acesso.</p>
                <Link href="/autenticacao/entrar?redirecionar=/sorteios" className="botao-pop h-12 px-6 text-base">
                  Entrar ou criar conta
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal aberto={!!regulamento} aoFechar={() => setRegulamento(null)} titulo="Regulamento" descricao={regulamento?.titulo} tamanho="md">
        {regulamento && (
          <div className="space-y-5">
            <div className="space-y-3 text-sm text-texto-secundario leading-relaxed max-h-96 overflow-y-auto pr-1 whitespace-pre-line">
              {regulamento.forma_apuracao && (
                <p>
                  <strong className="text-texto-principal">Forma de apuração:</strong> {regulamento.forma_apuracao}
                </p>
              )}
              <p>{regulamento.regulamento || 'A diretoria ainda não publicou o regulamento completo desta ação.'}</p>
            </div>
            <Botao variante="festiva" larguraTotal onClick={() => setRegulamento(null)}>
              Entendi
            </Botao>
          </div>
        )}
      </Modal>
    </>
  );
}
