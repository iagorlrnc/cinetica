'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Ticket,
  Calendar,
  Gift,
  HelpCircle,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Clock,
  Minus,
  Plus,
} from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import Modal from '@/componentes/ui/Modal';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import { SkeletonCard } from '@/componentes/ui/Carregando';
import BarraNavegacaoMobile from '@/componentes/layout/BarraNavegacaoMobile';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { formatarMoeda, formatarDataHora } from '@/lib/utilitarios';
import {
  STATUS_SORTEIO_PUBLICOS,
  STATUS_SORTEIO_ROTULO,
  calcularProgressoCotas,
  cotasRestantes,
  montarLinkWhatsapp,
  ordenarSorteios,
  sorteioAceitaParticipacao,
} from '@/lib/sorteios';
import type { Sorteio } from '@/tipos';

type Filtro = 'todos' | 'ativo' | 'em_breve' | 'encerrado';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativo', rotulo: 'Em andamento' },
  { id: 'em_breve', rotulo: 'Em breve' },
  { id: 'encerrado', rotulo: 'Encerrados' },
];

const OPCOES_COTAS = [1, 3, 5, 10];

export default function PaginaSorteios() {
  const supabase = criarClienteNavegador();
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selecionado, setSelecionado] = useState<Sorteio | null>(null);
  const [regulamento, setRegulamento] = useState<Sorteio | null>(null);
  const [qtdCotas, setQtdCotas] = useState(1);
  const [chaveCopiada, setChaveCopiada] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase
      .from('sorteios')
      .select(
        'id, atletica_id, titulo, subtitulo, descricao, premio_principal, premios_secundarios, valor_cota, total_cotas, cotas_vendidas, data_sorteio, status, destaque, imagem_url, regulamento, forma_apuracao, ganhador_nome, ganhador_bilhete, ganhador_cidade, apurado_em, criado_em, atualizado_em, atletica:atleticas(id, nome, chave_pix, whatsapp, instagram, logo_url)'
      )
      .in('status', STATUS_SORTEIO_PUBLICOS)
      .order('data_sorteio', { ascending: true })
      .limit(100);

    if (error) {
      setErro('Não foi possível carregar os sorteios agora.');
    } else {
      type LinhaSorteio = Omit<Sorteio, 'atletica'> & { atletica: Sorteio['atletica'] | NonNullable<Sorteio['atletica']>[] };
      const normalizados = ((data || []) as unknown as LinhaSorteio[]).map((s) => ({
        ...s,
        valor_cota: Number(s.valor_cota),
        premios_secundarios: Array.isArray(s.premios_secundarios) ? s.premios_secundarios : [],
        atletica: Array.isArray(s.atletica) ? s.atletica[0] ?? null : s.atletica,
      })) as Sorteio[];
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
    setQtdCotas(1);
    setChaveCopiada(false);
  }

  async function copiarChavePix(chave: string) {
    try {
      await navigator.clipboard.writeText(chave);
      setChaveCopiada(true);
      setTimeout(() => setChaveCopiada(false), 3000);
    } catch {
      setChaveCopiada(false);
    }
  }

  const maxCotasSelecionado = selecionado ? Math.min(100, cotasRestantes(selecionado)) : 1;

  return (
    <>
      <BarraNavegacaoMobile />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <h1 className="text-2xl sm:text-3xl font-black font-titulo mb-2 text-slate-900">
          Sorteios & <span className="gradiente-texto">Rifas</span>
        </h1>
        <p className="text-slate-600 mb-8">Participe das ações oficiais organizadas pelas atléticas</p>

        <div
          role="tablist"
          aria-label="Filtrar sorteios"
          className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-md flex items-center gap-1 sm:gap-2 mb-8 max-w-xl overflow-x-auto"
        >
          {FILTROS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex-1 whitespace-nowrap py-2 sm:py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center min-h-[38px] ${
                filtro === f.id
                  ? 'bg-gradient-to-r from-[#c59941] to-[#9a7228] text-[#0e1422] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {f.rotulo} ({contagem[f.id]})
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} className="h-[260px]" />
            ))}
          </div>
        ) : erro ? (
          <EstadoVazio
            titulo="Erro ao carregar"
            descricao={erro}
            icone={<AlertCircle className="w-7 h-7" />}
            acao={
              <Botao variante="contorno" icone={<RotateCcw size={16} />} onClick={carregar}>
                Tentar novamente
              </Botao>
            }
          />
        ) : filtrados.length === 0 ? (
          <EstadoVazio
            titulo={sorteios.length === 0 ? 'Nenhum sorteio publicado' : 'Nenhum sorteio nesta categoria'}
            descricao={
              sorteios.length === 0
                ? 'Quando a diretoria publicar uma nova ação, ela aparecerá aqui.'
                : 'Tente outro filtro para ver os demais sorteios.'
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
            {filtrados.map((s) => {
              const porcentagem = calcularProgressoCotas(s.cotas_vendidas, s.total_cotas);
              const aceita = sorteioAceitaParticipacao(s);
              const restantes = cotasRestantes(s);

              return (
                <article
                  key={s.id}
                  className={`bg-white rounded-3xl border transition-all duration-300 p-5 sm:p-8 shadow-sm hover:shadow-md ${
                    s.destaque && s.status === 'ativo' ? 'border-[#c59941] ring-2 ring-[#c59941]/20' : 'border-slate-200/90'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
                    <div className="space-y-4 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.destaque && s.status === 'ativo' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#c59941] text-[#0e1422]">
                            ★ Destaque
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            s.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : s.status === 'em_breve'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {STATUS_SORTEIO_ROTULO[s.status]}
                        </span>
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Calendar size={13} className="text-[#c59941]" />
                          Apuração: {formatarDataHora(s.data_sorteio)}
                        </span>
                        {s.atletica?.nome && (
                          <span className="text-xs text-slate-500 font-semibold">• {s.atletica.nome}</span>
                        )}
                      </div>

                      <div className="flex gap-4">
                        {s.imagem_url && (
                          <img
                            src={s.imagem_url}
                            alt=""
                            loading="lazy"
                            className="hidden sm:block w-24 h-24 rounded-2xl object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <h2 className="text-xl sm:text-2xl font-black font-titulo text-slate-900 break-words">{s.titulo}</h2>
                          {s.subtitulo && <p className="text-sm sm:text-base font-bold text-[#c59941] mt-0.5">{s.subtitulo}</p>}
                          {s.descricao && (
                            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed max-w-3xl whitespace-pre-line">
                              {s.descricao}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                          <Gift size={15} className="text-[#c59941]" />
                          <span>Premiação</span>
                        </div>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 flex gap-2">
                          <span className="text-emerald-600 shrink-0">🏆 1º:</span>
                          <span>{s.premio_principal}</span>
                        </p>
                        {s.premios_secundarios.map((premio, idx) => (
                          <p key={idx} className="text-xs text-slate-600 flex gap-2">
                            <span className="text-[#c59941] font-bold shrink-0">🎁 {idx + 2}º:</span>
                            <span>{premio}</span>
                          </p>
                        ))}
                      </div>

                      {s.status === 'encerrado' && s.ganhador_nome && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Trophy size={16} className="text-amber-600 shrink-0" />
                            <span className="text-amber-900">
                              Ganhador(a): <strong>{s.ganhador_nome}</strong>
                              {s.ganhador_cidade ? ` (${s.ganhador_cidade})` : ''}
                            </span>
                          </div>
                          {s.ganhador_bilhete && (
                            <span className="font-mono font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                              Bilhete: {s.ganhador_bilhete}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="lg:w-80 p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Valor por cota</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-[#c59941]">
                            {s.valor_cota > 0 ? formatarMoeda(s.valor_cota) : 'Gratuito'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600">Cotas</span>
                          <span className="text-slate-900 font-mono">{porcentagem}% vendido</span>
                        </div>
                        <div
                          className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={porcentagem}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-[#c59941] to-[#9a7228] transition-all duration-500 rounded-full"
                            style={{ width: `${porcentagem}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{s.cotas_vendidas} adquiridas</span>
                          <span>{restantes} restantes</span>
                        </div>
                      </div>

                      {aceita ? (
                        <div className="space-y-2">
                          <Botao variante="festiva" larguraTotal tamanho="lg" icone={<Ticket size={18} />} onClick={() => abrirParticipacao(s)}>
                            Participar
                          </Botao>
                          <button
                            onClick={() => setRegulamento(s)}
                            className="w-full text-center text-xs text-slate-500 hover:text-slate-900 underline transition-colors"
                          >
                            Ver regulamento
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            disabled
                            className="w-full py-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs uppercase cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {s.status === 'em_breve' ? (
                              <>
                                <Clock size={14} /> Em breve
                              </>
                            ) : s.status === 'encerrado' ? (
                              'Sorteio finalizado'
                            ) : (
                              'Cotas esgotadas'
                            )}
                          </button>
                          {s.regulamento && (
                            <button
                              onClick={() => setRegulamento(s)}
                              className="w-full text-center text-xs text-slate-500 hover:text-slate-900 underline transition-colors"
                            >
                              Ver regulamento
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-12 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c59941]/10 text-[#c59941] flex items-center justify-center shrink-0">
              <HelpCircle size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold font-titulo text-slate-900">Como participar</h3>
              <p className="text-xs sm:text-sm text-slate-500">A arrecadação é destinada aos projetos da atlética organizadora.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ['1', 'Escolha suas cotas', 'Defina quantas cotas deseja. Quanto mais cotas, mais chances.'],
              ['2', 'Pague via Pix', 'Use a chave Pix oficial da atlética exibida na participação.'],
              ['3', 'Envie o comprovante', 'Mande o comprovante para a diretoria e receba seus números.'],
            ].map(([n, t, d]) => (
              <div key={n} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#c59941] text-[#0e1422] text-[10px] font-black flex items-center justify-center">{n}</span>
                  {t}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal aberto={!!selecionado} aoFechar={() => setSelecionado(null)} tamanho="md">
        {selecionado && (
          <div className="space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#c59941]">
                {selecionado.atletica?.nome || 'Atlética'} • Ação oficial
              </span>
              <h3 className="text-lg sm:text-xl font-bold font-titulo text-slate-900 mt-0.5">{selecionado.titulo}</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">Quantidade de cotas</label>
              <div className="grid grid-cols-4 gap-2">
                {OPCOES_COTAS.filter((q) => q <= maxCotasSelecionado).map((qtd) => (
                  <button
                    key={qtd}
                    onClick={() => setQtdCotas(qtd)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      qtdCotas === qtd
                        ? 'bg-[#c59941] text-[#0e1422] border-[#c59941] font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {qtd}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  aria-label="Diminuir cotas"
                  onClick={() => setQtdCotas((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                >
                  <Minus size={14} />
                </button>
                <span className="font-mono font-black text-lg w-12 text-center">{qtdCotas}</span>
                <button
                  aria-label="Aumentar cotas"
                  onClick={() => setQtdCotas((q) => Math.min(maxCotasSelecionado, q + 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">Total a pagar</span>
                <p className="text-xl font-black text-[#c59941]">{formatarMoeda(selecionado.valor_cota * qtdCotas)}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                {qtdCotas} {qtdCotas === 1 ? 'cota' : 'cotas'}
              </span>
            </div>

            {selecionado.atletica?.chave_pix ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">Chave Pix oficial</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selecionado.atletica.chave_pix}
                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 select-all"
                  />
                  <Botao
                    variante={chaveCopiada ? 'sucesso' : 'primario'}
                    tamanho="sm"
                    onClick={() => copiarChavePix(selecionado.atletica!.chave_pix!)}
                    icone={chaveCopiada ? <Check size={14} /> : <Copy size={14} />}
                  >
                    {chaveCopiada ? 'Copiado!' : 'Copiar'}
                  </Botao>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                A atlética ainda não cadastrou a chave Pix. Entre em contato com a diretoria.
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle size={15} />
                Envio do comprovante
              </p>
              <p>Após a transferência, envie o comprovante para a diretoria para receber seus números da sorte.</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {(() => {
                const link = montarLinkWhatsapp(
                  selecionado.atletica?.whatsapp,
                  `Olá! Gostaria de garantir ${qtdCotas} cota(s) no sorteio "${selecionado.titulo}" (total ${formatarMoeda(selecionado.valor_cota * qtdCotas)}).`
                );
                return link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Botao variante="festiva" larguraTotal tamanho="lg" icone={<ExternalLink size={16} />}>
                      Enviar no WhatsApp
                    </Botao>
                  </a>
                ) : null;
              })()}
              <Botao variante="contorno" tamanho="lg" onClick={() => setSelecionado(null)}>
                Fechar
              </Botao>
            </div>
          </div>
        )}
      </Modal>

      <Modal aberto={!!regulamento} aoFechar={() => setRegulamento(null)} tamanho="md">
        {regulamento && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold font-titulo text-slate-900">Regulamento</h3>
              <p className="text-xs text-slate-500">{regulamento.titulo}</p>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-96 overflow-y-auto pr-1 whitespace-pre-line">
              {regulamento.forma_apuracao && (
                <p>
                  <strong>Forma de apuração:</strong> {regulamento.forma_apuracao}
                </p>
              )}
              <p>{regulamento.regulamento || 'A diretoria ainda não publicou o regulamento completo desta ação.'}</p>
            </div>
            <Botao variante="festiva" larguraTotal onClick={() => setRegulamento(null)}>
              Entendido
            </Botao>
          </div>
        )}
      </Modal>
    </>
  );
}
