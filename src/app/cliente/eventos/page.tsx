'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Botao from '@/componentes/ui/Botao';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { ordenarEventosPorPrioridade, matchFiltroCidade } from '@/lib/utilitarios';
import { eventoJaPassou } from '@/lib/eventos';
import CardEvento from '@/componentes/eventos/CardEvento';
import TituloSecao from '@/componentes/ui/TituloSecao';
import type { Evento, LoteIngresso, Atletica } from '@/tipos';
import { MapPin, SlidersHorizontal, Search, X, RotateCcw } from 'lucide-react';

import { salvarVariosEventosCache } from '@/lib/cacheEventos';

interface EventoComRelacoes extends Omit<Evento, 'atletica'> {
  atletica: Pick<Atletica, 'id' | 'nome'> | null;
  lotes_ingresso: LoteIngresso[];
}

// Cache em memória para carregamento instantâneo (0ms) ao alternar de aba
let cacheEventos: EventoComRelacoes[] | null = null;

const TAMANHO_PAGINA = 48;
type Periodo = 'proximos' | 'todos' | 'passados';

function ConteudoEventos() {
  const searchParams = useSearchParams();
  const buscaInicial = searchParams.get('busca') || searchParams.get('atletica') || '';
  const cidadeInicial = searchParams.get('cidade') || '';

  const [eventos, setEventos] = useState<EventoComRelacoes[]>(cacheEventos || []);
  const [carregando, setCarregando] = useState(!cacheEventos);
  const [erroCarga, setErroCarga] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [busca, setBusca] = useState(buscaInicial);
  const [cidade, setCidade] = useState(cidadeInicial);
  const [periodo, setPeriodo] = useState<Periodo>('proximos');
  const [supabase] = useState(() => criarClienteNavegador());

  useEffect(() => {
    const q = searchParams.get('busca') || searchParams.get('atletica') || '';
    const c = searchParams.get('cidade') || '';
    setBusca(q);
    setCidade(c);
  }, [searchParams]);

  async function buscarEventos(inicio = 0) {
    if (inicio === 0 && !cacheEventos) setCarregando(true);
    if (inicio > 0) setCarregandoMais(true);
    setErroCarga(false);

    const { data, error } = await supabase
      .from('eventos')
      .select('id, slug, titulo, imagem_url, data_evento, local, cidade, status, apagado_pelo_diretor, atletica:atleticas(id, nome), lotes_ingresso(id, preco, quantidade_total, quantidade_vendida, ativo)')
      .eq('apagado_pelo_diretor', false)
      .in('status', ['publicado', 'encerrado', 'cancelado'])
      .order('data_evento', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (error) {
      setErroCarga(true);
    } else if (data) {
      const novos = (data as unknown as (EventoComRelacoes & { apagado_pelo_diretor?: boolean })[]).filter(e => !e.apagado_pelo_diretor);
      const base = inicio === 0 ? [] : eventos;
      const mapa = new Map([...base, ...novos].map((e) => [e.id, e]));
      const ordenados = ordenarEventosPorPrioridade([...mapa.values()]);
      cacheEventos = ordenados;
      salvarVariosEventosCache(ordenados as unknown as import('@/lib/cacheEventos').EventoCompleto[]);
      setEventos(ordenados);
      setTemMais(data.length === TAMANHO_PAGINA);
    }
    setCarregando(false);
    setCarregandoMais(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { buscarEventos(0); }, []);

  const [agora] = useState(() => Date.now());
  const ehPassado = (e: EventoComRelacoes) => eventoJaPassou(e, agora);

  const cidadesDisponiveis = Array.from(
    new Set(eventos.map((e) => (e.cidade || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const termo = busca.trim().toLowerCase();
  const eventosFiltrados = eventos.filter(e => {
    const matchBusca = !termo ||
      e.titulo.toLowerCase().includes(termo) ||
      e.local?.toLowerCase().includes(termo) ||
      e.cidade?.toLowerCase().includes(termo) ||
      e.atletica?.nome.toLowerCase().includes(termo);
    const matchCidade = matchFiltroCidade(e.cidade, cidade);
    const matchPeriodo = periodo === 'todos' || (periodo === 'passados' ? ehPassado(e) : !ehPassado(e));
    return matchBusca && matchCidade && matchPeriodo;
  });

  return (
    <div className="relative">
      <section className="relative overflow-hidden fundo-granulado border-b border-borda-sutil">
        <div className="absolute inset-0 fundo-grade [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden="true" />
        <div className="brilho-ouro w-[420px] h-[420px] -top-48 right-0 opacity-60" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8">
          <TituloSecao
            nivel="h1"
            rotulo="Agenda Cinética"
            titulo={<>Todos os <span className="texto-ouro">rolês</span></>}
            descricao="Calouradas, festas, jogos e tudo que a fisio aprontar. Escolhe o seu."
            className="!mb-8"
          />

          <div className="flex flex-col lg:flex-row gap-3">
            <label className="campo-pop flex items-center gap-3 px-5 h-14 flex-1">
              <Search size={20} className="text-ouro shrink-0" />
              <span className="sr-only">Buscar eventos</span>
              <input
                type="search"
                placeholder="Busca por nome, local ou cidade..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                maxLength={80}
                className="w-full bg-transparent text-base text-texto-principal placeholder:text-texto-terciario outline-none"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  aria-label="Limpar busca"
                  className="text-texto-terciario hover:text-texto-principal p-1 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>
              )}
            </label>

            <div className="flex items-center gap-2 overflow-x-auto sem-barra-rolagem -mx-4 px-4 lg:mx-0 lg:px-0">
              {([
                ['proximos', 'Próximos'],
                ['todos', 'Todos'],
                ['passados', 'Já rolaram'],
              ] as [Periodo, string][]).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriodo(id)}
                  aria-pressed={periodo === id}
                  data-ativo={periodo === id}
                  className="chip h-14 px-5"
                >
                  {rotulo}
                </button>
              ))}

              {cidadesDisponiveis.length > 1 && (
                <label className="chip h-14 px-4 gap-2">
                  <MapPin size={16} className="text-ouro" />
                  <span className="sr-only">Filtrar por cidade</span>
                  <select
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="bg-transparent text-sm font-bold text-texto-principal outline-none cursor-pointer"
                  >
                    <option value="">Todas as cidades</option>
                    {cidadesDisponiveis.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        {!carregando && !erroCarga && (
          <p className="text-sm font-semibold text-texto-terciario mb-6">
            {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
          </p>
        )}

        {erroCarga && eventos.length === 0 ? (
          <EstadoVazio
            titulo="Não foi possível carregar os eventos"
            descricao="Verifique sua conexão e tente novamente."
            icone={<RotateCcw className="w-7 h-7" />}
            acao={<Botao variante="primario" onClick={() => buscarEventos(0)}>Tentar novamente</Botao>}
          />
        ) : carregando ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-[4/5] rounded-[1.75rem]" />)}
          </div>
        ) : eventosFiltrados.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {eventosFiltrados.map((evento) => (
              <CardEvento key={evento.id} evento={evento} agora={agora} />
            ))}
          </div>
        ) : (
          <EstadoVazio
            titulo={periodo === 'proximos' && !busca && !cidade ? 'Nenhum evento programado' : 'Nada por aqui'}
            descricao={
              busca
                ? `Não achamos eventos com "${busca}". Tenta outro termo.`
                : periodo === 'proximos'
                  ? 'Não tem evento com venda aberta agora. Volta logo que a diretoria tá preparando novidade!'
                  : 'Nenhum evento para esses filtros.'
            }
            icone={<SlidersHorizontal className="w-7 h-7" />}
            acao={
              busca || cidade || periodo !== 'todos' ? (
                <Botao variante="contorno" onClick={() => { setBusca(''); setCidade(''); setPeriodo('todos'); }}>
                  Ver todos os eventos
                </Botao>
              ) : undefined
            }
          />
        )}

        {!carregando && temMais && (
          <div className="flex justify-center mt-12">
            <Botao variante="contorno" tamanho="lg" carregando={carregandoMais} onClick={() => buscarEventos(eventos.length)}>
              Carregar mais eventos
            </Botao>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaginaEventos() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-12"><div className="skeleton h-40 rounded-[1.75rem]" /></div>}>
      <ConteudoEventos />
    </Suspense>
  );
}
