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
import { eventoJaPassou, partesData, rotuloContagem } from '@/lib/eventos';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  Minus,
  Plus,
  Clock,
  Info,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Share2,
  Check,
  ExternalLink,
  MapPinOff,
  QrCode,
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
  const [bannerCancelamento, setBannerCancelamento] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [supabase] = useState(() => criarClienteNavegador());

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
    const titulo = `${evento.titulo} | Cinética`;
    const texto = `Confira ${evento.titulo} na Cinética e garanta seu ingresso!`;

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
      <div className="min-h-[70vh] flex items-center justify-center">
        <Carregando tamanho="lg" texto="Carregando o evento..." />
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <span className="w-20 h-20 rounded-3xl bg-ouro text-azul-950 flex items-center justify-center mx-auto mb-6 -rotate-6">
            <Ticket className="w-10 h-10" />
          </span>
          <h1 className="titulo-display text-5xl text-texto-principal mb-3">Evento não encontrado</h1>
          <p className="text-texto-secundario mb-8">Esse evento não está disponível ou o link está errado.</p>
          <Link href="/eventos" className="botao-pop h-14 px-8 text-base">
            Ver eventos
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
  const ehEncerrado = statusEvento === 'encerrado' || (evento ? eventoJaPassou(evento) : false);
  const podeComprar = ehPublicado && !ehCancelado && !ehEncerrado;

  const data = partesData(evento.data_evento);
  const contagem = podeComprar ? rotuloContagem(evento.data_evento) : null;

  const blocoCompra = disponiveis.length > 0 && podeComprar ? (
    <>
      <div className="space-y-2.5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-texto-terciario">Escolhe o lote</p>
        {disponiveis.map((l) => {
          const restantes = l.quantidade_total - l.quantidade_vendida;
          const selecionado = loteSelecionado === l.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={selecionado}
              onClick={() => {
                setLoteSelecionado(l.id);
                setQuantidade(1);
              }}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                selecionado ? 'border-ouro bg-ouro/10' : 'border-borda-sutil bg-fundo-elevado/50 hover:border-borda-media'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selecionado ? 'border-ouro bg-ouro' : 'border-borda-media'
                    }`}
                  >
                    {selecionado && <Check size={12} strokeWidth={4} className="text-azul-950" />}
                  </span>
                  <span className="font-bold text-texto-principal truncate">{l.nome_lote}</span>
                </span>
                <span className="font-titulo font-extrabold text-xl text-ouro shrink-0">
                  {l.preco > 0 ? formatarMoeda(l.preco) : 'Grátis'}
                </span>
              </div>
              <p className="mt-1.5 pl-7 text-xs text-texto-secundario">
                {restantes <= 15 ? <span className="text-red-400 font-bold">Só {restantes} restantes!</span> : `${restantes} disponíveis`}
              </p>
            </button>
          );
        })}
      </div>

      {lote && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-fundo-elevado/50 border border-borda-sutil">
          <div>
            <span className="text-sm font-bold text-texto-principal block">Quantidade</span>
            {lote.preco === 0 && <span className="text-[11px] text-emerald-400 font-bold">Limite de 1 por pessoa</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              disabled={quantidade <= 1 || lote.preco === 0}
              onClick={() => lote.preco > 0 && setQuantidade(Math.max(1, quantidade - 1))}
              className="w-10 h-10 rounded-full border border-borda-media flex items-center justify-center text-texto-principal hover:border-ouro transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Minus size={16} />
            </button>
            <span className="font-titulo font-extrabold text-2xl text-texto-principal w-7 text-center" aria-live="polite">
              {lote.preco === 0 ? 1 : quantidade}
            </span>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              disabled={lote.preco === 0 || quantidade >= Math.min(5, lote.quantidade_total - lote.quantidade_vendida)}
              onClick={() => {
                if (lote.preco === 0) return;
                const max = lote.quantidade_total - lote.quantidade_vendida;
                setQuantidade(Math.min(5, max, quantidade + 1));
              }}
              className="w-10 h-10 rounded-full border border-borda-media flex items-center justify-center text-texto-principal hover:border-ouro transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {lote && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-texto-secundario">
            <span>Subtotal ({quantidade}x)</span>
            <span className="text-texto-principal font-semibold">{formatarMoeda(subtotal)}</span>
          </div>
          {taxaServico > 0 && (
            <div className="flex items-center justify-between text-texto-secundario">
              <span>Taxa da plataforma ({TAXA_SERVICO_LABEL})</span>
              <span className="text-texto-principal font-semibold">+{formatarMoeda(taxaServico)}</span>
            </div>
          )}
          <div className="pt-3 border-t border-dashed border-borda-media flex items-end justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-texto-terciario">Total</span>
            <span className="font-titulo font-extrabold text-3xl text-texto-principal leading-none">{formatarMoeda(totalFinal)}</span>
          </div>
        </div>
      )}

      <Botao larguraTotal tamanho="xl" onClick={aoComprar} disabled={!loteSelecionado} variante="festiva" icone={<Ticket size={20} />}>
        {usuario ? 'Garantir ingresso' : 'Entrar para comprar'}
      </Botao>

      <p className="flex items-center justify-center gap-2 text-xs font-semibold text-texto-secundario">
        <ShieldCheck size={15} className="text-emerald-400" />
        Pix ou cartão · QR Code na hora
      </p>
    </>
  ) : (
    <div className="text-center py-6 space-y-3">
      <span className="w-16 h-16 rounded-2xl bg-fundo-elevado border border-borda-media flex items-center justify-center mx-auto -rotate-6">
        {ehCancelado ? <XCircle className="w-8 h-8 text-red-400" /> : <Clock className="w-8 h-8 text-texto-terciario" />}
      </span>
      <p className="font-titulo font-extrabold text-2xl text-texto-principal">
        {ehCancelado ? 'Evento cancelado' : ehEncerrado ? 'Esse já rolou' : !ehPublicado ? 'Vendas fechadas' : 'Esgotou!'}
      </p>
      <p className="text-sm text-texto-secundario">
        {ehCancelado
          ? 'A organização cancelou este evento.'
          : ehEncerrado
            ? 'As vendas deste evento foram encerradas.'
            : !ehPublicado
              ? 'Este evento não está com vendas abertas.'
              : 'Fica de olho que pode abrir lote novo.'}
      </p>
      <Link href="/eventos" className="botao-vazado h-12 px-6 text-sm mt-2">
        Ver outros eventos
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen pb-40 lg:pb-0">
      {bannerCancelamento && (
        <div className="bg-red-500/10 border-b border-red-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-300">Pagamento não concluído</p>
                <p className="text-xs text-red-400">Seu ingresso não foi gerado. Você pode tentar de novo abaixo.</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => {
                setBannerCancelamento(false);
                window.history.replaceState({}, '', `/eventos/${params.id}`);
              }}
              className="text-red-400 hover:text-red-300 transition-colors p-1 shrink-0 cursor-pointer"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden fundo-granulado">
        <div className="absolute inset-0 -z-0" aria-hidden="true">
          {evento.imagem_url ? (
            <img src={evento.imagem_url} alt="" className="w-full h-full object-cover blur-2xl scale-125 opacity-40" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-azul-700 to-azul-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-fundo-principal/40 via-fundo-principal/70 to-fundo-principal" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-12 sm:pb-16">
          <nav aria-label="Trilha" className="flex items-center gap-2 text-xs font-semibold text-texto-secundario mb-8">
            <Link href="/eventos" className="inline-flex items-center gap-1.5 hover:text-ouro transition-colors">
              <ArrowLeft size={15} /> Eventos
            </Link>
          </nav>

          <div className="grid md:grid-cols-[minmax(0,360px)_1fr] gap-8 lg:gap-14 items-end">
            <div className="relative max-w-sm md:max-w-none">
              <div className="aspect-[4/5] rounded-[1.75rem] overflow-hidden border border-borda-media shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] rotate-[-2deg] bg-fundo-elevado">
                {evento.imagem_url ? (
                  <img src={evento.imagem_url} alt={evento.titulo} fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full fundo-pontos flex items-center justify-center">
                    <Ticket className="w-20 h-20 text-ouro/40 -rotate-12" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-5 -right-3 sm:-right-6 flex flex-col items-center justify-center w-24 h-28 rounded-3xl bg-ouro text-azul-950 shadow-[4px_4px_0_#070d22] rotate-6">
                <span className="text-xs font-black tracking-widest">{data.mes}</span>
                <span className="font-titulo font-extrabold text-5xl leading-none">{data.dia}</span>
                <span className="text-[11px] font-bold opacity-70">{data.semana}</span>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {evento.atletica?.nome && (
                  <span className="selo bg-ouro/15 text-ouro border border-ouro/40">{evento.atletica.nome}</span>
                )}
                {ehCancelado ? (
                  <span className="selo bg-red-500 text-white">Cancelado</span>
                ) : ehEncerrado ? (
                  <span className="selo bg-azul-700 text-texto-secundario">Encerrado</span>
                ) : disponiveis.length === 0 ? (
                  <span className="selo bg-red-500 text-white">Esgotado</span>
                ) : (
                  <span className="selo bg-emerald-400 text-azul-950">Vendas abertas</span>
                )}
                {contagem && <span className="selo bg-texto-principal text-azul-950">{contagem}</span>}
              </div>

              <h1 className="titulo-display text-5xl sm:text-6xl lg:text-7xl text-texto-principal break-words">{evento.titulo}</h1>

              <div className="mt-7 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-fundo-card/80 border border-borda-sutil backdrop-blur text-sm font-semibold text-texto-principal">
                  <Calendar size={18} className="text-ouro" />
                  {formatarDataHora(evento.data_evento)}
                </span>
                <span className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-fundo-card/80 border border-borda-sutil backdrop-blur text-sm font-semibold text-texto-principal">
                  <MapPin size={18} className="text-ouro" />
                  {evento.local}
                  {evento.cidade ? ` · ${evento.cidade}` : ''}
                </span>
                <button
                  type="button"
                  onClick={aoCompartilhar}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-borda-media text-sm font-bold text-texto-principal hover:border-ouro hover:text-ouro transition-colors cursor-pointer"
                >
                  {copiado ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
                  {copiado ? 'Link copiado!' : 'Chamar a galera'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CONTEÚDO ============ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 items-start">
        <div className="space-y-12 min-w-0">
          <section>
            <h2 className="titulo-display text-3xl sm:text-4xl text-texto-principal mb-5">Sobre o rolê</h2>
            <p className="text-base sm:text-lg text-texto-secundario leading-relaxed whitespace-pre-line">
              {evento.descricao?.trim() || 'A organização ainda não publicou a descrição deste evento.'}
            </p>
          </section>

          <section>
            <h2 className="titulo-display text-3xl sm:text-4xl text-texto-principal mb-5">Lotes e preços</h2>
            {evento.lotes_ingresso.length === 0 ? (
              <p className="text-texto-secundario">Nenhum lote cadastrado ainda.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-3">
                {[...evento.lotes_ingresso]
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((l) => {
                    const restante = l.quantidade_total - l.quantidade_vendida;
                    const status = !l.ativo
                      ? { texto: 'Fechado', cor: 'text-texto-terciario' }
                      : !podeComprar
                        ? { texto: 'Indisponível', cor: 'text-texto-terciario' }
                        : restante > 0
                          ? { texto: 'Disponível', cor: 'text-emerald-400' }
                          : { texto: 'Esgotado', cor: 'text-red-400' };
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-3 p-5 rounded-3xl bg-fundo-card border border-borda-sutil">
                        <div className="min-w-0">
                          <p className="font-bold text-texto-principal truncate">{l.nome_lote}</p>
                          <p className={`text-xs font-black uppercase tracking-wider mt-1 ${status.cor}`}>{status.texto}</p>
                        </div>
                        <p className={`font-titulo font-extrabold text-2xl shrink-0 ${restante > 0 && l.ativo ? 'text-ouro' : 'text-texto-terciario line-through'}`}>
                          {l.preco > 0 ? formatarMoeda(l.preco) : 'Grátis'}
                        </p>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <h2 className="titulo-display text-3xl sm:text-4xl text-texto-principal">Onde é</h2>
              {evento.local_definido !== false && evento.latitude != null && evento.longitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${evento.latitude},${evento.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-borda-media text-sm font-bold text-texto-principal hover:border-ouro hover:text-ouro transition-colors"
                >
                  <ExternalLink size={15} /> Abrir no Maps
                </a>
              )}
            </div>
            {evento.local_definido !== false && evento.latitude != null && evento.longitude != null ? (
              <div className="rounded-[1.75rem] overflow-hidden border border-borda-sutil">
                <MapView lat={evento.latitude} lng={evento.longitude} tituloEvento={evento.titulo} localEvento={evento.local} className="h-80 sm:h-96" />
                <p className="px-5 py-4 bg-fundo-card text-sm text-texto-secundario">
                  <strong className="text-texto-principal">{evento.local}</strong>
                  {evento.cidade ? ` · ${evento.cidade}` : ''}
                </p>
              </div>
            ) : (
              <div className="py-12 px-6 rounded-[1.75rem] border border-dashed border-borda-media text-center">
                <MapPinOff size={36} className="text-texto-terciario mx-auto mb-3" />
                <p className="font-bold text-texto-principal">Local ainda não definido</p>
                <p className="text-sm text-texto-secundario mt-1">
                  {evento.local ? `Informado: ${evento.local}` : 'Acompanhe as atualizações da organização.'}
                </p>
              </div>
            )}
          </section>

          <section>
            <h2 className="titulo-display text-3xl sm:text-4xl text-texto-principal mb-5">Antes de ir</h2>
            <ul className="grid sm:grid-cols-3 gap-3">
              {[
                { icone: QrCode, titulo: 'QR Code na conta', texto: 'O ingresso aparece em "Meus ingressos" assim que o pagamento é aprovado.' },
                { icone: CheckCircle, titulo: 'Uso único', texto: 'Cada QR Code é validado uma vez só na portaria. Não compartilhe.' },
                { icone: Info, titulo: 'Leve documento', texto: 'Tenha um documento oficial com foto para conferência na entrada.' },
              ].map(({ icone: Icone, titulo, texto }) => (
                <li key={titulo} className="p-5 rounded-3xl bg-fundo-card border border-borda-sutil">
                  <Icone size={22} className="text-ouro mb-4" />
                  <p className="font-bold text-texto-principal">{titulo}</p>
                  <p className="text-sm text-texto-secundario mt-1 leading-relaxed">{texto}</p>
                </li>
              ))}
            </ul>
          </section>

          {evento.atletica?.nome && (
            <section className="flex items-center gap-4 p-5 rounded-3xl bg-fundo-card border border-borda-sutil">
              {evento.atletica.logo_url ? (
                <img src={evento.atletica.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover border border-borda-sutil" />
              ) : (
                <span className="w-14 h-14 rounded-2xl bg-ouro text-azul-950 flex items-center justify-center font-titulo font-extrabold text-2xl">
                  {evento.atletica.nome[0]}
                </span>
              )}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-texto-terciario">Organização</p>
                <p className="font-titulo font-extrabold text-xl text-texto-principal">{evento.atletica.nome}</p>
                {evento.atletica.faculdade && <p className="text-sm text-texto-secundario">{evento.atletica.faculdade}</p>}
              </div>
            </section>
          )}
        </div>

        {/* Card de compra */}
        <aside id="comprar" className="lg:sticky lg:top-28 scroll-mt-28">
          <div className="relative rounded-[1.75rem] bg-fundo-card border border-borda-media p-6 space-y-5 shadow-[0_30px_70px_-35px_rgba(242,193,78,0.35)]">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 rounded-xl bg-ouro text-azul-950 flex items-center justify-center -rotate-6">
                <Ticket size={20} />
              </span>
              <h2 className="font-titulo font-extrabold text-2xl text-texto-principal">Ingressos</h2>
            </div>
            {blocoCompra}
          </div>
        </aside>
      </div>

      {/* Barra de compra no celular (acima da navegação inferior) */}
      {podeComprar && disponiveis.length > 0 && (
        <div className="lg:hidden fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-40">
          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] bg-fundo-card/95 backdrop-blur-xl border border-borda-media p-3 pl-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-texto-terciario block">
                {lote ? `${quantidade}x ${lote.nome_lote}` : 'Selecione um lote'}
              </span>
              <span className="font-titulo font-extrabold text-xl text-ouro">{lote ? formatarMoeda(totalFinal) : '—'}</span>
            </div>
            <button type="button" onClick={aoComprar} disabled={!loteSelecionado} className="botao-pop h-12 px-6 text-base shrink-0">
              {usuario ? 'Comprar' : 'Entrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConteudoDetalheEvento({ eventoInicial }: ConteudoDetalheEventoProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Carregando tamanho="lg" texto="Carregando o evento..." />
        </div>
      }
    >
      <ComponenteDetalheEvento eventoInicial={eventoInicial} />
    </Suspense>
  );
}
