'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Botao from '@/componentes/ui/Botao';
import Cartao from '@/componentes/ui/Cartao';
import { SkeletonCard } from '@/componentes/ui/Carregando';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { formatarData, formatarDataHora, formatarMoeda, ordenarEventosPorPrioridade, matchFiltroCidade } from '@/lib/utilitarios';
import type { Evento, LoteIngresso, Atletica, ProdutoLoja } from '@/tipos';
import BarraNavegacaoMobile from '@/componentes/layout/BarraNavegacaoMobile';
import CardProduto from '@/componentes/loja/CardProduto';
import {
  MapPin,
  Calendar,
  Ticket,
  Users,
  ChevronRight,
  ChevronLeft,
  Flame,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';

import { obterCidadesCache, obterOuBuscarCidades, salvarVariosEventosCache } from '@/lib/cacheEventos';

const PRODUTOS_LOJA_PADRAO: ProdutoLoja[] = [
  {
    id: 'camisa-oficial-cinetica',
    atletica_id: 'cinetica',
    name: 'Camisa Oficial Cinética 2026',
    description: 'Manto oficial da Atlética Cinética (A.A.A.F.A. Fisioterapia). Tecido dry fit premium com alta respirabilidade e detalhes dourados.',
    price: 6990,
    category: 'camisa',
    images: ['https://waxynnorevdbqybxmjyb.supabase.co/storage/v1/object/public/imagens/produtos/produto_1787328590584_xetm4s.jpg'],
    sizes: ['P', 'M', 'G', 'GG'],
    stock_quantity: 45,
    is_active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tirante-copo-cinetica',
    atletica_id: 'cinetica',
    name: 'Tirante Premium + Copo Gravado',
    description: 'Copo oficial da Cinética com gravação a laser e tirante acetinado com mosquetão reforçado para as calouradas e jogos.',
    price: 4500,
    category: 'tirante',
    images: ['https://waxynnorevdbqybxmjyb.supabase.co/storage/v1/object/public/imagens/produtos/produto_1787337442302_ctg939.png'],
    sizes: ['Único'],
    stock_quantity: 60,
    is_active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'caneca-aluminio-cinetica',
    atletica_id: 'cinetica',
    name: 'Caneca de Alumínio 850ml Cinética',
    description: 'Caneca oficial da Fisioterapia em alumínio resistente com pintura térmica e estampa oficial da Atlética Cinética.',
    price: 3500,
    category: 'caneca',
    images: ['https://waxynnorevdbqybxmjyb.supabase.co/storage/v1/object/public/imagens/produtos/produto_1787337545378_5g9f91.jpg'],
    sizes: ['850ml'],
    stock_quantity: 80,
    is_active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];



interface EventoComLote extends Omit<Evento, 'atletica'> {
  lotes_ingresso: LoteIngresso[];
  atletica: Pick<Atletica, 'id' | 'nome' | 'logo_url'> | null;
}

function ConteudoPaginaInicial() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [eventos, setEventos] = useState<EventoComLote[]>([]);
  const [produtosLoja, setProdutosLoja] = useState<ProdutoLoja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState(searchParams.get('busca') || '');
  const [cidade, setCidade] = useState(searchParams.get('cidade') || '');
  const [cidades, setCidades] = useState<string[]>(obterCidadesCache() || []);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [indiceDestaque, setIndiceDestaque] = useState(0);
  const [faseTransicao, setFaseTransicao] = useState<'repouso' | 'amassando' | 'desamassando'>('repouso');
  const timeoutTrocaRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutFimRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = criarClienteNavegador();

  useEffect(() => {
    setBusca(searchParams.get('busca') || '');
    setCidade(searchParams.get('cidade') || '');
  }, [searchParams]);

  useEffect(() => {
    async function carregarCidades() {
      const lista = await obterOuBuscarCidades(supabase);
      setCidades(lista);
    }
    carregarCidades();
  }, [supabase]);

  async function buscarEventos() {
    setCarregando(true);
    const { data } = await supabase
      .from('eventos')
      .select(`
        id, slug, titulo, descricao, imagem_url, data_evento, local, cidade, status, apagado_pelo_diretor,
        atletica:atleticas(id, nome, logo_url),
        lotes_ingresso(id, evento_id, nome_lote, preco, quantidade_total, quantidade_vendida, ordem, ativo)
      `)
      .eq('apagado_pelo_diretor', false)
      .in('status', ['publicado', 'encerrado', 'cancelado'])
      .order('data_evento', { ascending: true })
      .range(0, 49);

    if (data) {
      const validos = (data as unknown as (EventoComLote & { apagado_pelo_diretor?: boolean })[]).filter(e => !e.apagado_pelo_diretor);
      const ordenados = ordenarEventosPorPrioridade(validos);
      salvarVariosEventosCache(ordenados as unknown as import('@/lib/cacheEventos').EventoCompleto[]);
      setEventos(ordenados);
    }
    setCarregando(false);
  }

  async function buscarProdutosLoja() {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select(`
          id,
          atletica_id,
          name,
          description,
          price,
          category,
          images,
          sizes,
          stock_quantity,
          is_active,
          created_by,
          created_at,
          updated_at,
          atletica:atleticas(id, nome, logo_url, cor_primaria, cor_secundaria)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setProdutosLoja(data as ProdutoLoja[]);
      } else {
        setProdutosLoja(PRODUTOS_LOJA_PADRAO);
      }
    } catch {
      setProdutosLoja(PRODUTOS_LOJA_PADRAO);
    }
  }

  useEffect(() => {
    buscarEventos();
    buscarProdutosLoja();
  }, []);

  const produtosCarrossel = produtosLoja.length > 0 ? produtosLoja : PRODUTOS_LOJA_PADRAO;
  const produtoDestaque = produtosCarrossel[indiceDestaque % produtosCarrossel.length];

  // Função centralizada para executar a transição com animação da mão fechando e abrindo
  const executarTransicaoPara = useCallback(
    (novoIndice: number) => {
      if (faseTransicao !== 'repouso') return;

      // 1. Fase "fechando": a mão fecha em punho e os textos saem de forma rápida
      setFaseTransicao('amassando');

      // 2. Quando o punho fecha (280ms):
      // Troca os dados do produto e a nova descrição/título aparecem imediatamente
      timeoutTrocaRef.current = setTimeout(() => {
        setIndiceDestaque(novoIndice);
        setFaseTransicao('desamassando');

        // 3. Após a mão abrir (300ms), estabiliza em repouso
        timeoutFimRef.current = setTimeout(() => {
          setFaseTransicao('repouso');
        }, 300);
      }, 280);
    },
    [faseTransicao]
  );

  // Efeito para alternar os produtos em destaque automaticamente com o efeito de amassar
  useEffect(() => {
    if (produtosCarrossel.length <= 1) return;

    if (faseTransicao === 'repouso') {
      const timer = setTimeout(() => {
        const proximo = (indiceDestaque + 1) % produtosCarrossel.length;
        executarTransicaoPara(proximo);
      }, 5500);

      return () => clearTimeout(timer);
    }
  }, [faseTransicao, indiceDestaque, produtosCarrossel.length, executarTransicaoPara]);

  // Limpeza de timers ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutTrocaRef.current) clearTimeout(timeoutTrocaRef.current);
      if (timeoutFimRef.current) clearTimeout(timeoutFimRef.current);
    };
  }, []);

  function proximoDestaque() {
    if (produtosCarrossel.length <= 1 || faseTransicao !== 'repouso') return;
    const proximo = (indiceDestaque + 1) % produtosCarrossel.length;
    executarTransicaoPara(proximo);
  }

  function destaqueAnterior() {
    if (produtosCarrossel.length <= 1 || faseTransicao !== 'repouso') return;
    const anterior = (indiceDestaque - 1 + produtosCarrossel.length) % produtosCarrossel.length;
    executarTransicaoPara(anterior);
  }

  function irParaDestaque(idx: number) {
    if (produtosCarrossel.length <= 1 || idx === indiceDestaque || faseTransicao !== 'repouso') return;
    executarTransicaoPara(idx);
  }

  function obterMenorPreco(lotes?: LoteIngresso[]): number | null {
    if (!lotes || lotes.length === 0) return null;
    const ativos = lotes.filter((l) => l.ativo && l.quantidade_vendida < l.quantidade_total);
    if (ativos.length === 0) return null;
    return Math.min(...ativos.map((l) => l.preco));
  }

  function obterTotalDisponivel(lotes?: LoteIngresso[]): number {
    if (!lotes || lotes.length === 0) return 0;
    const ativos = lotes.filter((l) => l.ativo && l.quantidade_vendida < l.quantidade_total);
    return ativos.reduce((acc, l) => acc + (l.quantidade_total - l.quantidade_vendida), 0);
  }

  function extrairDataTicketmaster(dataIso: string) {
    const d = new Date(dataIso);
    const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const dia = d.getDate().toString().padStart(2, '0');
    return { mes, dia };
  }

  const eventosFiltrados = eventos.filter((e) => {
    const matchBusca =
      !busca ||
      e.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      e.cidade?.toLowerCase().includes(busca.toLowerCase()) ||
      e.atletica?.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCidade = matchFiltroCidade(e.cidade, cidade);
    return matchBusca && matchCidade;
  });

  const produtosFiltrados = (produtosLoja.length > 0 ? produtosLoja : PRODUTOS_LOJA_PADRAO).filter((p) => {
    if (!busca) return true;
    const termo = busca.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(termo) ||
      p.description?.toLowerCase().includes(termo) ||
      p.category?.toLowerCase().includes(termo) ||
      p.atletica?.nome?.toLowerCase().includes(termo)
    );
  });



  return (
    <div className="relative min-h-screen bg-[#fafafa] text-slate-900">
      <style>{`
        @keyframes heroLoopBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
      {/* Hero Store Products Carousel Stage (Ocupa tela cheia no topo, responsivo sem cortar) */}
      <section className="relative overflow-hidden border-b border-[#c59941]/30 bg-[#0e1422] group/hero text-white min-h-[100dvh] flex flex-col justify-end">
        {/* Barra Visual de Progresso do Loop */}
        {produtosCarrossel.length > 1 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-40 overflow-hidden">
            <div
              key={`${indiceDestaque}-${faseTransicao}`}
              className="h-full bg-gradient-to-r from-[#c59941] via-[#dc2626] to-[#f4d68a]"
              style={{
                animation: faseTransicao === 'repouso' ? 'heroLoopBar 5500ms linear forwards' : 'none',
              }}
            />
          </div>
        )}

        {/* Tag e Título na parte superior do banner */}
        <div className="absolute top-4 sm:top-6 md:top-8 left-0 right-0 z-30 flex flex-col items-center justify-center text-center px-4 pointer-events-none select-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full bg-[#0e1422]/80 border border-[#c59941]/40 backdrop-blur-md shadow-md mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#f4d68a]">
              Atlética Cinética
            </span>
          </div>
          <h2 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black font-titulo uppercase tracking-[0.15em] sm:tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-amber-100 drop-shadow-md">
            Produtos em Destaque
          </h2>
        </div>

        {/* Seta Anterior (Desktop & Mobile) */}
        {produtosCarrossel.length > 1 && (
          <button
            onClick={destaqueAnterior}
            aria-label="Produto anterior"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full bg-[#0e1422]/80 border border-white/20 text-white hover:text-[#f4d68a] hover:border-[#c59941] hover:bg-[#0e1422] backdrop-blur-md transition-all shadow-lg cursor-pointer"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Seta Próximo (Desktop & Mobile) */}
        {produtosCarrossel.length > 1 && (
          <button
            onClick={proximoDestaque}
            aria-label="Próximo produto"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full bg-[#0e1422]/80 border border-white/20 text-white hover:text-[#f4d68a] hover:border-[#c59941] hover:bg-[#0e1422] backdrop-blur-md transition-all shadow-lg cursor-pointer"
          >
            <ChevronRight size={22} />
          </button>
        )}

        {produtoDestaque && (
          <div className="relative w-full flex-1 flex flex-col justify-end lg:items-end pt-16 sm:pt-20 lg:pt-24 pb-0 overflow-hidden">
            {/* Background Image Layer com a Imagem de Capa do Produto (Igual ao dos Eventos) */}
            <div className="absolute inset-0 z-0 overflow-hidden bg-[#0e1422]">
              <div
                className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
                  faseTransicao === 'amassando' ? 'opacity-30' : 'opacity-100'
                }`}
              >
                {produtoDestaque.images?.[0] ? (
                  <img
                    src={produtoDestaque.images[0]}
                    alt={produtoDestaque.name}
                    className="w-full h-full object-cover object-center filter brightness-70 scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-[#c59941] to-[#9a7228]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e1422] via-[#0e1422]/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0e1422] via-[#0e1422]/60 to-transparent" />
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-20 w-full h-full flex flex-col justify-end items-start gap-2.5 sm:gap-4 lg:gap-0 lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-12 lg:items-end">
              <div
                className={`w-full lg:col-span-7 space-y-2 sm:space-y-3.5 lg:space-y-5 lg:pb-14 flex flex-col items-start text-left transition-all duration-200 ease-out ${
                  faseTransicao === 'amassando'
                    ? 'opacity-0 -translate-y-1'
                    : 'opacity-100 translate-y-0'
                }`}
              >
                <div className="flex flex-wrap items-center justify-start gap-1.5 sm:gap-2">
                  {produtoDestaque.stock_quantity > 0 ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Pronta Entrega
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] sm:text-xs font-bold">
                      Esgotado
                    </span>
                  )}
                </div>

                {/* Product Title */}
                <h1 className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-black font-titulo uppercase tracking-tight leading-tight sm:leading-none text-white drop-shadow-md max-w-xl">
                  {produtoDestaque.name}
                </h1>

                {/* Price */}
                <div className="flex flex-wrap items-baseline justify-start gap-2 sm:gap-3">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold">
                    A partir de
                  </div>
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f4d68a] via-[#c59941] to-amber-200">
                    {formatarMoeda(produtoDestaque.price / 100)}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-base text-slate-300 line-clamp-2 max-w-xl leading-relaxed">
                  {produtoDestaque.description ||
                    'Garanta os produtos oficiais da Atlética Cinética com matéria-prima de alta qualidade e entrega garantida para a Fisioterapia.'}
                </p>

                {/* CTA Buttons */}
                <div className="pt-0.5 sm:pt-1.5 flex flex-wrap items-center justify-start gap-2 sm:gap-4">
                  <Link href={`/loja/produto/${produtoDestaque.id}`}>
                    <Botao variante="festiva" tamanho="lg" className="text-xs sm:text-base py-2.5 px-4 sm:py-3 sm:px-6" icone={<ShoppingCart size={16} />}>
                      COMPRAR AGORA
                      <ChevronRight size={16} className="ml-1" />
                    </Botao>
                  </Link>
                </div>
              </div>

              {/* Hand holding Product Image: Mão firme sem tremer */}
              <div className="w-full lg:col-span-5 flex justify-center lg:justify-end items-end self-end">
                <div className="group/hero-hand relative w-full max-w-[360px] xs:max-w-[400px] sm:max-w-[440px] md:max-w-[470px] lg:max-w-[480px] xl:max-w-[540px] 2xl:max-w-[600px] aspect-square flex items-end justify-center select-none">
                  {/* Imagem do Produto Segurada (Bordas quadradas e nítidas, sem efeito de amassado ou pulsar) */}
                  <Link
                    href={`/loja/produto/${produtoDestaque.id}`}
                    style={{
                      top: '24.1%',
                      left: '22.7%',
                      width: '56.3%',
                      height: '41.5%',
                      transformOrigin: '50% 50%',
                    }}
                    className={`absolute z-0 block cursor-pointer transition-opacity duration-300 ease-in-out ${
                      faseTransicao === 'amassando'
                        ? 'opacity-0 pointer-events-none'
                        : 'opacity-100 hover:brightness-105'
                    }`}
                    title={produtoDestaque.name}
                  >
                    <div className="relative w-full h-full rounded-none border-2 sm:border-4 border-white shadow-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
                      {produtoDestaque.images?.[0] ? (
                        <img
                          src={produtoDestaque.images[0]}
                          alt={produtoDestaque.name}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-2">
                          <ShoppingBag size={28} className="text-[#c59941]" />
                          <span className="text-[9px] uppercase font-bold text-slate-400 text-center">Produto Oficial</span>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Mão da Cinética ABERTA (Firme e estática, sem tremer) */}
                  <img
                    src="/MAO-INICIO.png"
                    alt="Mão da Cinética segurando o produto"
                    className={`absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none z-10 drop-shadow-[0_20px_35px_rgba(0,0,0,0.7)] transition-opacity duration-300 ease-in-out ${
                      faseTransicao === 'amassando' ? 'opacity-0' : 'opacity-100'
                    }`}
                    draggable={false}
                  />

                  {/* Mão da Cinética FECHADA (Firme e estática, sem tremer) */}
                  <img
                    src="/MAO-FECHADA.png"
                    alt="Mão da Cinética fechada"
                    className={`absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none z-20 drop-shadow-[0_20px_35px_rgba(0,0,0,0.85)] transition-opacity duration-300 ease-in-out ${
                      faseTransicao === 'amassando' ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable={false}
                  />
                </div>
              </div>
            </div>

            {/* Indicadores do carrossel (dots) */}
            {produtosCarrossel.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0e1422]/80 border border-white/10 backdrop-blur-md">
                {produtosCarrossel.map((prod, idx) => (
                  <button
                    key={prod.id}
                    onClick={() => irParaDestaque(idx)}
                    aria-label={`Ir para produto ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === indiceDestaque
                        ? 'w-8 bg-gradient-to-r from-[#c59941] to-[#f4d68a]'
                        : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sub-Navbar Móbile Adaptado (Abaixo do Hero) */}
      <BarraNavegacaoMobile />

      {/* Seção de Produtos Disponíveis (Abaixo do Banner) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c59941]/10 text-[#9a7228] border border-[#c59941]/30 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} /> Loja Oficial
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-titulo uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-[#c59941]" />
              Produtos Disponíveis
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Garanta os mantos, copos, canecas e acessórios oficiais da Atlética Cinética para pronta entrega.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-black uppercase text-[#9a7228] bg-[#c59941]/10 px-3 py-1.5 rounded-lg border border-[#c59941]/25">
              {produtosFiltrados.length} produto(s) disponível(is)
            </span>
            <Link href="/loja">
              <Botao variante="contorno" tamanho="sm" icone={<ShoppingCart size={15} />}>
                Ver Loja Completa
              </Botao>
            </Link>
          </div>
        </div>

        {carregando ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} className="h-[280px] sm:h-[360px]" />
            ))}
          </div>
        ) : produtosFiltrados.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {produtosFiltrados.map((produto) => (
              <CardProduto key={produto.id} produto={produto} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <ShoppingBag className="w-14 h-14 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold uppercase tracking-wider text-slate-900">
              Nenhum produto encontrado
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {busca ? `Nenhum produto corresponde aos termos de pesquisa "${busca}".` : 'Em breve novos produtos oficiais estarão disponíveis no catálogo!'}
            </p>
            {busca && (
              <div className="mt-4">
                <Botao variante="fantasma" tamanho="sm" onClick={() => setBusca('')}>
                  Limpar busca
                </Botao>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function PaginaInicial() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] text-slate-800 py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#c59941]" />
      </div>
    }>
      <ConteudoPaginaInicial />
    </Suspense>
  );
}
