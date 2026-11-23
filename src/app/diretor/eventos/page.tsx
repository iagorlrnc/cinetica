'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Cartao from '@/componentes/ui/Cartao';
import Botao from '@/componentes/ui/Botao';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import Distintivo from '@/componentes/ui/Distintivo';
import Carregando from '@/componentes/ui/Carregando';
import Modal from '@/componentes/ui/Modal';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { useNotificacao } from '@/componentes/ui/Notificacao';
import { formatarDataCurta, formatarMoeda, gerarSlugUnico } from '@/lib/utilitarios';
import { obterIdAtleticaCinetica } from '@/lib/atleticaCinetica';
import { usarRotaPainel } from '@/lib/rotasPainel';
import { construirUrl } from '@/lib/dominios';
import { traduzirErroBanco } from '@/lib/errosBanco';
import { eventoJaPassou } from '@/lib/eventos';
import {
  CalendarPlus,
  BarChart3,
  Edit,
  Plus,
  Ticket,
  Trash2,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { Evento, LoteIngresso } from '@/tipos';

type EventoComLotes = Evento & { lotes_ingresso?: LoteIngresso[] };
type Filtro = 'todos' | 'publicado' | 'rascunho' | 'encerrado';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'publicado', rotulo: 'Publicados' },
  { id: 'rascunho', rotulo: 'Rascunhos' },
  { id: 'encerrado', rotulo: 'Encerrados' },
];

/** Verdadeiro quando a data/hora já passou (usado ao publicar). */
function dataJaPassou(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default function PaginaEventosDiretor() {
  const { perfil, carregando: carregandoAuth } = usarAutenticacao();
  const { sucesso, erro: notificarErro } = useNotificacao();
  const rota = usarRotaPainel();
  const [supabase] = useState(() => criarClienteNavegador());
  const [agora] = useState(() => Date.now());

  const [eventos, setEventos] = useState<EventoComLotes[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [eventoParaApagar, setEventoParaApagar] = useState<EventoComLotes | null>(null);
  const [processandoApagar, setProcessandoApagar] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!perfil) {
      setCarregando(false);
      return;
    }
    try {
      const idAtletica = await obterIdAtleticaCinetica(supabase);

      let query = supabase.from('eventos').select('*, lotes_ingresso(*)').eq('apagado_pelo_diretor', false);
      if (idAtletica) query = query.eq('atletica_id', idAtletica);

      const { data, error } = await query.order('data_evento', { ascending: false });
      if (error) {
        notificarErro('Erro ao carregar eventos', traduzirErroBanco(error, 'carregar os eventos'));
      }
      setEventos((data || []) as EventoComLotes[]);
    } catch (err) {
      notificarErro('Erro ao carregar eventos', traduzirErroBanco(err, 'carregar os eventos'));
    } finally {
      setCarregando(false);
    }
  }, [perfil, supabase, notificarErro]);

  useEffect(() => {
    if (!carregandoAuth) void buscar();
  }, [carregandoAuth, buscar]);

  const situacao = useCallback(
    (e: EventoComLotes): Filtro => {
      if (e.status === 'rascunho') return 'rascunho';
      if (e.status === 'publicado' && !eventoJaPassou(e, agora)) return 'publicado';
      return 'encerrado';
    },
    [agora]
  );

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: eventos.length, publicado: 0, rascunho: 0, encerrado: 0 };
    for (const e of eventos) c[situacao(e)]++;
    return c;
  }, [eventos, situacao]);

  const totais = useMemo(() => {
    let vendidos = 0;
    let receita = 0;
    for (const e of eventos) {
      for (const l of e.lotes_ingresso || []) {
        vendidos += l.quantidade_vendida;
        receita += l.quantidade_vendida * Number(l.preco);
      }
    }
    return { vendidos, receita };
  }, [eventos]);

  const termo = busca.trim().toLowerCase();
  const filtrados = eventos.filter(
    (e) =>
      (filtro === 'todos' || situacao(e) === filtro) &&
      (!termo || e.titulo.toLowerCase().includes(termo) || (e.local || '').toLowerCase().includes(termo))
  );

  async function alternarPublicacao(e: EventoComLotes) {
    const publicar = e.status !== 'publicado';
    if (publicar && (!e.lotes_ingresso || e.lotes_ingresso.filter((l) => l.ativo).length === 0)) {
      notificarErro('Evento sem lotes', 'Crie pelo menos um lote ativo antes de publicar, senão ninguém consegue comprar.');
      return;
    }
    if (publicar && dataJaPassou(e.data_evento)) {
      notificarErro('Data já passou', 'Atualize a data do evento antes de publicar.');
      return;
    }
    setProcessandoId(e.id);
    const novoStatus = publicar ? 'publicado' : 'rascunho';
    const { error } = await supabase
      .from('eventos')
      .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
      .eq('id', e.id);
    setProcessandoId(null);
    if (error) {
      notificarErro(publicar ? 'Erro ao publicar' : 'Erro ao despublicar', traduzirErroBanco(error, publicar ? 'publicar o evento' : 'despublicar o evento'));
      return;
    }
    setEventos((lista) => lista.map((x) => (x.id === e.id ? { ...x, status: novoStatus } : x)));
    sucesso(publicar ? 'Evento publicado!' : 'Evento voltou para rascunho', publicar ? 'Já está visível no site.' : 'Ele não aparece mais no site.');
  }

  async function duplicar(e: EventoComLotes) {
    setProcessandoId(e.id);
    try {
      const titulo = `${e.titulo} (cópia)`.slice(0, 200);
      const slug = await gerarSlugUnico(supabase, titulo);
      const { data: novo, error } = await supabase
        .from('eventos')
        .insert({
          atletica_id: e.atletica_id,
          titulo,
          slug,
          descricao: e.descricao,
          imagem_url: e.imagem_url,
          data_evento: e.data_evento,
          local: e.local,
          cidade: e.cidade,
          latitude: e.latitude ?? null,
          longitude: e.longitude ?? null,
          local_definido: e.local_definido ?? true,
          status: 'rascunho',
        })
        .select('id, slug')
        .single();
      if (error || !novo) throw error;

      const lotes = (e.lotes_ingresso || [])
        .sort((a, b) => a.ordem - b.ordem)
        .map((l) => ({
          evento_id: novo.id,
          nome_lote: l.nome_lote,
          preco: l.preco,
          quantidade_total: l.quantidade_total,
          quantidade_vendida: 0,
          ordem: l.ordem,
          ativo: l.ativo,
        }));
      if (lotes.length > 0) {
        const { error: erroLotes } = await supabase.from('lotes_ingresso').insert(lotes);
        if (erroLotes) throw erroLotes;
      }

      sucesso('Evento duplicado', 'A cópia foi criada como rascunho. Ajuste a data antes de publicar.');
      await buscar();
    } catch (err) {
      notificarErro('Erro ao duplicar', traduzirErroBanco(err, 'duplicar o evento'));
    } finally {
      setProcessandoId(null);
    }
  }

  async function aoConfirmarApagar() {
    if (!eventoParaApagar) return;
    setProcessandoApagar(true);
    try {
      const { error } = await supabase.from('eventos').update({ apagado_pelo_diretor: true }).eq('id', eventoParaApagar.id);
      if (error) throw error;
      setEventos((prev) => prev.filter((ev) => ev.id !== eventoParaApagar.id));
      sucesso('Evento apagado', `"${eventoParaApagar.titulo}" foi removido do painel.`);
    } catch (err: unknown) {
      notificarErro('Erro ao apagar evento', traduzirErroBanco(err, 'apagar o evento'));
    } finally {
      setProcessandoApagar(false);
      setEventoParaApagar(null);
    }
  }

  if (carregandoAuth || carregando) {
    return (
      <div className="py-20 text-center">
        <Carregando tamanho="lg" texto="Carregando eventos..." />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-titulo">
            Meus <span className="gradiente-texto">Eventos</span>
          </h1>
          <p className="text-texto-secundario mt-1">
            {eventos.length} evento(s) · {totais.vendidos} ingresso(s) vendido(s) · {formatarMoeda(totais.receita)} em vendas
          </p>
        </div>
        <Link href={rota('/eventos/novo')}>
          <Botao icone={<CalendarPlus size={16} />}>Novo evento</Botao>
        </Link>
      </div>

      {eventos.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <div className="flex gap-1.5 overflow-x-auto p-1 rounded-2xl bg-white border border-slate-200">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                aria-pressed={filtro === f.id}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  filtro === f.id ? 'bg-[#c59941] text-[#0e1422]' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.rotulo} ({contagem[f.id]})
              </button>
            ))}
          </div>
          <label className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Buscar evento</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou local"
              className="w-full h-full min-h-[44px] pl-10 pr-4 rounded-2xl bg-white border border-slate-200 text-sm outline-none focus:border-[#c59941]"
            />
          </label>
        </div>
      )}

      {eventos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum evento ainda"
          descricao="Crie o primeiro evento da Cinética. Ele fica como rascunho até você publicar."
          icone={<CalendarPlus className="w-7 h-7" />}
          acao={
            <Link href={rota('/eventos/novo')}>
              <Botao icone={<Plus size={16} />}>Criar evento</Botao>
            </Link>
          }
        />
      ) : filtrados.length === 0 ? (
        <EstadoVazio titulo="Nada encontrado" descricao="Nenhum evento corresponde ao filtro ou à busca." icone={<Search className="w-7 h-7" />} />
      ) : (
        <div className="space-y-4">
          {filtrados.map((e) => {
            const lotes = e.lotes_ingresso || [];
            const vendidos = lotes.reduce((a, l) => a + l.quantidade_vendida, 0);
            const capacidade = lotes.reduce((a, l) => a + l.quantidade_total, 0);
            const receita = lotes.reduce((a, l) => a + l.quantidade_vendida * Number(l.preco), 0);
            const ocupacao = capacidade > 0 ? Math.round((vendidos / capacidade) * 100) : 0;
            const ehPublicado = e.status === 'publicado';
            const passou = eventoJaPassou(e, agora);
            const ocupado = processandoId === e.id;

            return (
              <Cartao key={e.id} variante="vidro" className="flex flex-col xl:flex-row xl:items-center gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {e.imagem_url ? (
                    <img src={e.imagem_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-borda-sutil shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-primaria-500/10 text-primaria-400 flex items-center justify-center shrink-0 border border-primaria-500/20">
                      <Ticket size={24} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold texto-limitado-1">{e.titulo}</h3>
                      <Distintivo status={passou && ehPublicado ? 'encerrado' : e.status} />
                      {lotes.length === 0 && (
                        <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Sem lotes
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-texto-secundario">
                      {formatarDataCurta(e.data_evento)} · {e.local}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-terciario">
                      <span>
                        {vendidos}/{capacidade} vendidos ({ocupacao}%)
                      </span>
                      <span>Receita: {formatarMoeda(receita)}</span>
                    </div>
                    {capacidade > 0 && (
                      <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-[#c59941]" style={{ width: `${ocupacao}%` }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  {!passou && (
                    <Botao
                      tamanho="sm"
                      variante={ehPublicado ? 'fantasma' : 'primario'}
                      icone={ehPublicado ? <EyeOff size={14} /> : <Eye size={14} />}
                      onClick={() => alternarPublicacao(e)}
                      disabled={ocupado}
                    >
                      {ehPublicado ? 'Despublicar' : 'Publicar'}
                    </Botao>
                  )}
                  <Link href={rota(`/eventos/${e.slug || e.id}/vendas`)}>
                    <Botao variante="contorno" tamanho="sm" icone={<BarChart3 size={14} />}>Vendas</Botao>
                  </Link>
                  <Link href={rota(`/eventos/${e.slug || e.id}/lotes`)}>
                    <Botao variante="contorno" tamanho="sm" icone={<Ticket size={14} />}>Lotes</Botao>
                  </Link>
                  <Link href={rota(`/eventos/${e.slug || e.id}/editar`)}>
                    <Botao variante="fantasma" tamanho="sm" icone={<Edit size={14} />}>Editar</Botao>
                  </Link>
                  <Botao variante="fantasma" tamanho="sm" icone={<Copy size={14} />} onClick={() => duplicar(e)} disabled={ocupado} title="Criar uma cópia em rascunho">
                    Duplicar
                  </Botao>
                  {ehPublicado && (
                    <a
                      href={construirUrl('cliente', `/eventos/${e.slug || e.id}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      title="Ver no site"
                      aria-label="Ver no site"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setEventoParaApagar(e)}
                    disabled={ehPublicado && !passou}
                    title={ehPublicado && !passou ? 'Despublique antes de apagar' : 'Apagar evento'}
                    aria-label="Apagar evento"
                    className={`p-2 rounded-xl border transition-colors ${
                      ehPublicado && !passou
                        ? 'opacity-40 cursor-not-allowed bg-fundo-elevado border-borda-sutil text-texto-terciario'
                        : 'bg-erro/10 border-erro/20 text-erro hover:bg-erro hover:text-white cursor-pointer'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}

      <Modal aberto={!!eventoParaApagar} aoFechar={() => setEventoParaApagar(null)} titulo="Apagar evento" tamanho="sm">
        {eventoParaApagar && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Apagar <strong>&quot;{eventoParaApagar.titulo}&quot;</strong> do painel? O histórico de vendas continua guardado para auditoria.
            </p>
            {(eventoParaApagar.lotes_ingresso || []).some((l) => l.quantidade_vendida > 0) && (
              <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                Este evento já tem ingressos vendidos. Eles continuam válidos.
              </p>
            )}
            <div className="flex gap-3">
              <Botao variante="contorno" onClick={() => setEventoParaApagar(null)} className="flex-1">
                Cancelar
              </Botao>
              <Botao variante="perigo" carregando={processandoApagar} onClick={aoConfirmarApagar} className="flex-1" icone={<Trash2 size={16} />}>
                Apagar
              </Botao>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
