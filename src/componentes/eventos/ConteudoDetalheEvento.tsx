'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Botao from '@/componentes/ui/Botao';
import Carregando from '@/componentes/ui/Carregando';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { formatarDataHora, formatarMoeda } from '@/lib/utilitarios';
import { TAXA_SERVICO_PERCENTUAL, TAXA_SERVICO_LABEL } from '@/lib/constantes';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { obterEventoCache, salvarEventoCache, type EventoCompleto } from '@/lib/cacheEventos';
import type { LoteIngresso } from '@/tipos';
import {
  Calendar,
  MapPin,
  Ticket,
  Users,
  ShoppingCart,
  Minus,
  Plus,
  Clock,
  Info,
  ShieldCheck,
  Map,
  CheckCircle,
  AlertTriangle,
  Flame,
  XCircle,
  Share2,
  Check,
  ExternalLink,
  MapPinOff,
} from 'lucide-react';
import MapView from '@/componentes/mapa/MapView';

interface ConteudoDetalheEventoProps {
  eventoInicial?: EventoCompleto | null;
}

function ComponenteDetalheEvento({ eventoInicial }: ConteudoDetalheEventoProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario } = usarAutenticacao();
  const eventoId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const cacheInicial = eventoInicial || (eventoId ? obterEventoCache(eventoId) : null);

  const [evento, setEvento] = useState<EventoCompleto | null>(cacheInicial || null);
  const [carregando, setCarregando] = useState(!cacheInicial);
  const [loteSelecionado, setLoteSelecionado] = useState<string | null>(() => {
    if (cacheInicial) {
      const lotes = cacheInicial.lotes_ingresso
        .filter(l => l.ativo && l.quantidade_vendida < l.quantidade_total)
        .sort((a, b) => a.ordem - b.ordem);
      return lotes.length > 0 ? lotes[0].id : null;
    }
    return null;
  });
  const [quantidade, setQuantidade] = useState(1);
  const [abaAtiva, setAbaAtiva] = useState<'sobre' | 'lotes' | 'mapa' | 'regras'>('sobre');
  const [bannerCancelamento, setBannerCancelamento] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const supabase = criarClienteNavegador();

  async function buscarEvento() {
    if (!eventoId) return;
    if (!obterEventoCache(eventoId) && !eventoInicial) {
      setCarregando(true);
    }

    const ehUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventoId);
    
    let query = supabase
      .from('eventos')
      .select(`
        *,
        atletica:atleticas(*),
        lotes_ingresso(*)
      `);

    if (ehUUID) {
      query = query.eq('id', eventoId);
    } else {
      query = query.eq('slug', eventoId);
    }

    query = query.eq('apagado_pelo_diretor', false);

    const { data } = await query.single();

    if (data) {
      const eventoFormatado = data as unknown as EventoCompleto;
      salvarEventoCache(eventoFormatado);
      setEvento(eventoFormatado);
      
      const lotes = eventoFormatado.lotes_ingresso
        .filter(l => l.ativo && l.quantidade_vendida < l.quantidade_total)
        .sort((a, b) => a.ordem - b.ordem);
      if (lotes.length > 0 && !loteSelecionado) {
        setLoteSelecionado(lotes[0].id);
      }
    }
    setCarregando(false);
  }

  useEffect(() => {
    if (eventoInicial) {
      salvarEventoCache(eventoInicial);
      setEvento(eventoInicial);
      setCarregando(false);
      const lotes = eventoInicial.lotes_ingresso
        .filter(l => l.ativo && l.quantidade_vendida < l.quantidade_total)
        .sort((a, b) => a.ordem - b.ordem);
      if (lotes.length > 0 && !loteSelecionado) {
        setLoteSelecionado(lotes[0].id);
      }
    } else if (eventoId) {
      const cache = obterEventoCache(eventoId);
      if (cache) {
        setEvento(cache);
        setCarregando(false);
        const lotes = cache.lotes_ingresso
          .filter(l => l.ativo && l.quantidade_vendida < l.quantidade_total)
          .sort((a, b) => a.ordem - b.ordem);
        if (lotes.length > 0 && !loteSelecionado) {
          setLoteSelecionado(lotes[0].id);
        }
      }
    }
    buscarEvento();
    if (searchParams.get('pagamento_cancelado') === 'true') {
      setBannerCancelamento(true);
    }
  }, [eventoId, searchParams, eventoInicial]);

  async function aoCompartilhar() {
    if (!evento) return;
    const url = window.location.href;
    const titulo = `${evento.titulo} | meuingrss`;
    const texto = `Confira ${evento.titulo} no meuingrss e garanta seu ingresso!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: titulo,
          text: texto,
          url: url,
        });
        return;
      } catch {
        /* Ignorar se o usuário cancelou o menu de compartilhamento */
      }
    }

    // Fallback para cópia para área de transferência
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      /* Fallback em navegadores sem suporte */
    }
  }

  function obterLoteSelecionado(): LoteIngresso | undefined {
    return evento?.lotes_ingresso.find(l => l.id === loteSelecionado);
  }

  function lotesDisponiveis(): LoteIngresso[] {
    return evento?.lotes_ingresso
      .filter(l => l.ativo && l.quantidade_vendida < l.quantidade_total)
      .sort((a, b) => a.ordem - b.ordem) || [];
  }

  function aoComprar() {
    if (!podeComprar) return;
    if (!usuario) {
      router.push(`/autenticacao/entrar?redirecionar=/eventos/${params.id}`);
      return;
    }
    if (loteSelecionado) {
      router.push(`/eventos/${params.id}/checkout?lote=${loteSelecionado}&qtd=${quantidade}`);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center pt-20">
        <Carregando tamanho="lg" texto="Carregando detalhes do evento..." />
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center pt-20 text-slate-900">
        <div className="text-center max-w-md p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Ticket className="w-16 h-16 text-[#c59941] mx-auto mb-4" />
          <h2 className="text-2xl font-black font-titulo uppercase mb-2">Evento não encontrado</h2>
          <p className="text-xs text-slate-500 mb-6">O evento solicitado não está disponível ou foi encerrado.</p>
          <Link href="/eventos">
            <Botao variante="festiva">Voltar aos Eventos</Botao>
          </Link>
        </div>
      </div>
    );
  }

  const lote = obterLoteSelecionado();
  const disponiveis = lotesDisponiveis();
  const subtotal = lote ? lote.preco * quantidade : 0;
  const taxaServico = (lote && lote.preco > 0) ? Math.round(subtotal * TAXA_SERVICO_PERCENTUAL * 100) / 100 : 0;
  const totalFinal = subtotal + taxaServico;

  const statusEvento = evento?.status;
  const ehPublicado = statusEvento === 'publicado';
  const ehCancelado = statusEvento === 'cancelado';
  const ehEncerrado = statusEvento === 'encerrado' || (evento?.data_evento ? new Date(evento.data_evento) < new Date() : false);
  const podeComprar = ehPublicado && !ehCancelado && !ehEncerrado;

  const textoBotaoDesktop = ehCancelado
    ? 'CANCELADO'
    : ehEncerrado
    ? 'ENCERRADO'
    : !ehPublicado
    ? (statusEvento ? statusEvento.toUpperCase() : 'NÃO PUBLICADO')
    : usuario
    ? 'COMPRAR INGRESSO'
    : 'ENTRAR PARA COMPRAR';

  const textoBotaoMobile = ehCancelado
    ? 'CANCELADO'
    : ehEncerrado
    ? 'ENCERRADO'
    : !ehPublicado
    ? (statusEvento ? statusEvento.toUpperCase() : 'NÃO PUBLICADO')
    : usuario
    ? 'COMPRAR'
    : 'ENTRAR';

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900">
      {bannerCancelamento && (
        <div className="bg-red-500/10 border-b border-red-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">
                  Pagamento não foi concluído
                </p>
                <p className="text-xs text-red-600/80">
                  O pagamento foi cancelado ou não foi finalizado. Seu ingresso não foi gerado. Você pode tentar novamente abaixo.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setBannerCancelamento(false);
                window.history.replaceState({}, '', `/eventos/${params.id}`);
              }}
              className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-100 border-b border-slate-200 py-2.5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <Link href="/" className="hover:text-slate-900 transition-colors">Início</Link>
            <span>/</span>
            <Link href="/eventos" className="hover:text-[#c59941] transition-colors">Eventos</Link>
            <span>/</span>
            <span className="text-slate-900 font-bold truncate max-w-xs">{evento.titulo}</span>
          </div>

          <button
            onClick={aoCompartilhar}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-200/60 text-slate-700 hover:text-slate-950 text-xs font-medium transition-all border border-slate-200 shadow-xs shrink-0"
          >
            {copiado ? (
              <>
                <Check size={13} className="text-emerald-600" />
                <span className="text-emerald-600 font-bold">Link Copiado</span>
              </>
            ) : (
              <>
                <Share2 size={13} className="text-[#c59941]" />
                <span>Compartilhar</span>
              </>
            )}
          </button>
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#0e1422] border-b border-slate-200 text-white">
        <div className="relative min-h-[420px] sm:min-h-[500px] flex items-end pb-8 sm:pb-12 pt-8 sm:pt-12">
          <div className="absolute inset-0 z-0">
            {evento.imagem_url ? (
              <img
                src={evento.imagem_url}
                alt={evento.titulo}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover filter brightness-40 blur-md scale-110"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `linear-gradient(135deg, ${evento.atletica?.cor_primaria || '#c59941'}, #9a7228, #0e1422)`,
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e1422] via-[#0e1422]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0e1422] via-[#0e1422]/40 to-transparent" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 sm:gap-8">
              {evento.imagem_url ? (
                <div className="w-full md:w-80 sm:max-w-xs shrink-0 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#162036] aspect-[4/3] sm:aspect-[16/10] md:aspect-[4/3] relative group">
                  <img
                    src={evento.imagem_url}
                    alt={evento.titulo}
                    fetchPriority="high"
                    decoding="async"
                    width={400}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ) : (
                <div className="w-full md:w-80 sm:max-w-xs shrink-0 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gradient-to-br from-[#c59941] via-[#9a7228] to-[#0e1422] aspect-[4/3] sm:aspect-[16/10] md:aspect-[4/3] flex items-center justify-center">
                  <Ticket className="w-20 h-20 text-white/40" />
                </div>
              )}

              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-sm bg-gradient-to-r from-[#c59941] to-[#9a7228] text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                      <Flame size={14} />
                      VENDA OFICIAL
                    </span>
                    {evento.atletica?.nome && (
                      <span className="px-2.5 py-1 rounded-sm bg-[#0e1422]/90 text-[#f4d68a] text-xs font-black uppercase tracking-wider border border-[#c59941]/30 backdrop-blur-sm">
                        {evento.atletica.nome}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={aoCompartilhar}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#162036] text-white hover:text-[#f4d68a] text-xs font-bold transition-all border border-white/20 hover:border-[#c59941]/50 backdrop-blur-md shadow-md active:scale-95"
                  >
                    {copiado ? (
                      <>
                        <Check size={15} className="text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={15} className="text-[#f4d68a]" />
                        <span>Compartilhar Evento</span>
                      </>
                    )}
                  </button>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-titulo tracking-tight uppercase text-white drop-shadow-lg leading-tight">
                  {evento.titulo}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold text-slate-200">
                  <div className="flex items-center gap-1.5 bg-[#0e1422]/80 px-3.5 py-2 rounded-md border border-white/10 text-[#f4d68a]">
                    <Calendar size={16} className="text-[#c59941]" />
                    <span>{formatarDataHora(evento.data_evento)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0e1422]/80 px-3.5 py-2 rounded-md border border-white/10 text-slate-200">
                    <MapPin size={16} className="text-[#c59941]" />
                    <span>{evento.local}{evento.cidade ? `, ${evento.cidade}` : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-slate-200 sticky top-[64px] sm:top-[80px] z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto text-xs font-black uppercase tracking-wider sem-barra-rolagem touch-pan-x py-0.5">
            <button
              onClick={() => setAbaAtiva('sobre')}
              className={`py-3.5 border-b-2 transition-colors whitespace-nowrap min-h-[44px] touch-manipulation ${
                abaAtiva === 'sobre'
                  ? 'border-[#c59941] text-[#c59941]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Sobre o Evento
            </button>
            <button
              onClick={() => setAbaAtiva('lotes')}
              className={`py-3.5 border-b-2 transition-colors whitespace-nowrap min-h-[44px] touch-manipulation ${
                abaAtiva === 'lotes'
                  ? 'border-[#c59941] text-[#c59941]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Ingressos & Setores
            </button>
            <button
              onClick={() => setAbaAtiva('mapa')}
              className={`py-3.5 border-b-2 transition-colors whitespace-nowrap min-h-[44px] touch-manipulation ${
                abaAtiva === 'mapa'
                  ? 'border-[#c59941] text-[#c59941]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Mapa do Local
            </button>
            <button
              onClick={() => setAbaAtiva('regras')}
              className={`py-3.5 border-b-2 transition-colors whitespace-nowrap min-h-[44px] touch-manipulation ${
                abaAtiva === 'regras'
                  ? 'border-[#c59941] text-[#c59941]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Informações Importantes
            </button>
          </nav>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {abaAtiva === 'sobre' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                  <h3 className="text-base font-black uppercase tracking-wider text-slate-900 mb-4 pb-3 border-b border-slate-200 flex items-center gap-2">
                    <Info size={18} className="text-[#c59941]" />
                    Sobre o Evento
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {evento.descricao ||
                      'Prepare-se para viver uma experiência inesquecível! Este evento conta com estrutura completa, segurança especializada e as melhores atrações.'}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                    Organização Oficial
                  </h3>
                  <div className="flex items-center gap-4">
                    {evento.atletica?.logo_url ? (
                      <img
                        src={evento.atletica.logo_url}
                        alt={evento.atletica.nome}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c59941] to-[#9a7228] flex items-center justify-center text-white font-black text-lg">
                        {evento.atletica?.nome?.[0] || 'C'}
                      </div>
                    )}
                    <div>
                      <p className="text-base font-bold text-slate-900">{evento.atletica?.nome || 'Atlética Organizadora'}</p>
                      <p className="text-xs text-slate-500">{evento.atletica?.faculdade || 'Atlética Cinética'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {abaAtiva === 'lotes' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                <h3 className="text-base font-black uppercase tracking-wider text-slate-900 mb-4 pb-3 border-b border-slate-200 flex items-center gap-2">
                  <Ticket size={18} className="text-[#c59941]" />
                  Tabela de Preços e Setores
                </h3>
                <div className="space-y-3">
                  {evento.lotes_ingresso.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          {l.nome_lote}
                        </p>
                        <p className="text-xs text-slate-500">Entrada individual com QR Code</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-[#c59941]">
                          {l.preco > 0 ? formatarMoeda(l.preco) : 'Grátis'}
                        </p>
                        {!l.ativo ? (
                          <span className="text-[10px] font-black uppercase text-slate-400">Inativo</span>
                        ) : !podeComprar ? (
                          <span className="text-[10px] font-black uppercase text-red-500">Indisponível</span>
                        ) : l.quantidade_total - l.quantidade_vendida > 0 ? (
                          <span className="text-[10px] font-black uppercase text-emerald-600">Disponível</span>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-red-500">Esgotado</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {abaAtiva === 'mapa' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 flex-wrap gap-2">
                  <h3 className="text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Map size={18} className="text-[#c59941]" />
                    Mapa de Setores e Local
                  </h3>
                  {evento.local_definido !== false && evento.latitude != null && evento.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${evento.latitude},${evento.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#9a7228] border border-slate-200 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Abrir no Maps</span>
                    </a>
                  )}
                </div>

                {evento.local_definido !== false && evento.latitude != null && evento.longitude != null ? (
                  <div className="space-y-3">
                    <MapView
                      lat={evento.latitude}
                      lng={evento.longitude}
                      tituloEvento={evento.titulo}
                      localEvento={evento.local}
                      className="h-88 sm:h-96"
                    />
                    <p className="text-xs text-slate-500">
                      Localização: <strong className="text-slate-900">{evento.local}</strong>{evento.cidade ? ` (${evento.cidade})` : ''}
                    </p>
                  </div>
                ) : (
                  <div className="py-12 px-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                    <MapPinOff size={40} className="text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">
                      O local deste evento ainda não foi definido.
                    </p>
                    <p className="text-xs text-slate-500">
                      {evento.local ? `Endereço informado: ${evento.local}` : 'Acompanhe as atualizações da organização.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'regras' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
                <h3 className="text-base font-black uppercase tracking-wider text-slate-900 mb-4 pb-3 border-b border-slate-200 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-[#d97706]" />
                  Informações de Entrada & Regras
                </h3>
                <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-[#c59941] shrink-0 mt-0.5" />
                    <span><strong>Classificação Etária:</strong> Evento destinado para maiores de 18 anos. Apresentação obrigatória de documento oficial com foto.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-[#c59941] shrink-0 mt-0.5" />
                    <span><strong>QR Code de Acesso:</strong> O ingresso será disponibilizado digitalmente em sua conta imediatamente após a confirmação do pagamento via PIX ou Cartão.</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sticky top-[140px] shadow-xl space-y-5">
              <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#9a7228]">
                    INGRESSO OFICIAL
                  </span>
                  <h3 className="text-xl font-black uppercase font-titulo text-slate-900 flex items-center gap-2 mt-0.5">
                    <ShoppingCart size={20} className="text-[#c59941]" />
                    Comprar Ingresso
                  </h3>
                </div>
                <button
                  onClick={aoCompartilhar}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-[#c59941]/20 text-slate-600 hover:text-[#9a7228] border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold shrink-0"
                  title="Compartilhar evento"
                >
                  {copiado ? (
                    <>
                      <Check size={16} className="text-emerald-600" />
                      <span className="text-emerald-600 text-[11px]">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={16} className="text-[#c59941]" />
                    </>
                  )}
                </button>
              </div>

              {disponiveis.length > 0 ? (
                <>
                  <div className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                      Selecione o Lote / Setor:
                    </label>
                    {disponiveis.map((l) => {
                      const restantes = l.quantidade_total - l.quantidade_vendida;
                      const selecionado = loteSelecionado === l.id;

                      return (
                        <button
                          key={l.id}
                          disabled={!podeComprar}
                          onClick={() => {
                            if (!podeComprar) return;
                            setLoteSelecionado(l.id);
                            setQuantidade(1);
                          }}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                            !podeComprar
                              ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                              : selecionado
                              ? 'border-[#c59941] bg-[#c59941]/10 shadow-md cursor-pointer'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">{l.nome_lote}</span>
                            <span className="text-base font-black text-[#c59941]">
                              {l.preco > 0 ? formatarMoeda(l.preco) : 'Grátis'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <Users size={12} />
                            <span>
                              {podeComprar ? `${restantes} ingressos restantes` : 'Indisponível'}
                            </span>
                            {podeComprar && restantes <= 15 && (
                              <span className="text-red-500 font-bold">• Poucas vagas</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {lote && (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-xs font-black uppercase text-slate-700 block">Quantidade</span>
                        {lote.preco === 0 && (
                          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                            Limite: 1 por usuário
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          disabled={!podeComprar || quantidade <= 1 || lote.preco === 0}
                          onClick={() => podeComprar && lote.preco > 0 && setQuantidade(Math.max(1, quantidade - 1))}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-[#c59941] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-base font-black text-slate-900 w-6 text-center">
                          {lote.preco === 0 ? 1 : quantidade}
                        </span>
                        <button
                          disabled={!podeComprar || lote.preco === 0 || (lote && quantidade >= Math.min(5, lote.quantidade_total - lote.quantidade_vendida))}
                          onClick={() => {
                            if (!podeComprar || !lote || lote.preco === 0) return;
                            const max = lote.quantidade_total - lote.quantidade_vendida;
                            setQuantidade(Math.min(5, max, quantidade + 1));
                          }}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-[#c59941] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {lote && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Subtotal ({quantidade}x)</span>
                        <span className="font-medium text-slate-800">{formatarMoeda(subtotal)}</span>
                      </div>

                      {taxaServico > 0 && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            Taxa da plataforma ({TAXA_SERVICO_LABEL})
                          </span>
                          <span className="font-semibold text-[#9a7228]">+{formatarMoeda(taxaServico)}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black uppercase text-slate-500 block">Valor Total</span>
                          {taxaServico > 0 && (
                            <span className="text-[10px] text-slate-400">Taxas inclusas</span>
                          )}
                        </div>
                        <span className="text-2xl font-black text-slate-900">
                          {formatarMoeda(totalFinal)}
                        </span>
                      </div>
                    </div>
                  )}

                  <Botao
                    larguraTotal
                    tamanho="xl"
                    onClick={aoComprar}
                    disabled={!podeComprar || !loteSelecionado}
                    variante={podeComprar ? 'festiva' : 'fantasma'}
                  >
                    {textoBotaoDesktop}
                  </Botao>

                  <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-bold text-slate-500 pt-1">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Pagamento Seguro via Pix ou Cartão</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold uppercase text-slate-800">
                    {ehCancelado ? 'Evento Cancelado' : ehEncerrado ? 'Evento Encerrado' : 'Ingressos Esgotados'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {ehCancelado
                      ? 'Este evento foi cancelado pela organização.'
                      : ehEncerrado
                      ? 'As vendas para este evento foram encerradas.'
                      : 'Acompanhe as atualizações de novos lotes.'}
                  </p>
                  {!podeComprar && (
                    <Botao
                      larguraTotal
                      tamanho="xl"
                      disabled={true}
                      variante="fantasma"
                    >
                      {textoBotaoDesktop}
                    </Botao>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {(disponiveis.length > 0 || !podeComprar) && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-slate-200 shadow-2xl flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              {podeComprar ? `Total com taxa (${quantidade}x)` : 'Status'}
            </span>
            <span className="text-lg font-black text-[#c59941]">
              {podeComprar
                ? lote ? formatarMoeda(totalFinal) : 'Selecione'
                : ehCancelado ? 'Cancelado' : ehEncerrado ? 'Encerrado' : 'Indisponível'}
            </span>
            {podeComprar && taxaServico > 0 && (
              <span className="text-[10px] text-slate-500 block -mt-0.5">
                Taxa de {formatarMoeda(taxaServico)} inclusa
              </span>
            )}
          </div>

          <Botao
            tamanho="md"
            onClick={aoComprar}
            disabled={!podeComprar || !loteSelecionado}
            variante={podeComprar ? 'festiva' : 'fantasma'}
            className="flex-1 max-w-[200px]"
          >
            {textoBotaoMobile}
          </Botao>
        </div>
      )}
    </div>
  );
}

export default function ConteudoDetalheEvento({ eventoInicial }: ConteudoDetalheEventoProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center pt-20">
        <Carregando tamanho="lg" texto="Carregando detalhes do evento..." />
      </div>
    }>
      <ComponenteDetalheEvento eventoInicial={eventoInicial} />
    </Suspense>
  );
}
