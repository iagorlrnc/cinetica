'use client';

import ImagemOtimizada from '@/componentes/ui/ImagemOtimizada';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import CardProduto from '@/componentes/loja/CardProduto';
import Botao from '@/componentes/ui/Botao';
import type { ProdutoLoja, Atletica } from '@/tipos';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import TituloSecao from '@/componentes/ui/TituloSecao';
import { ShoppingBag, Search, SlidersHorizontal, X, RotateCcw, Check } from 'lucide-react';

const ROTULOS_CATEGORIA: { id: string; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todos os Produtos' },
  { id: 'caneca', rotulo: 'Canecas' },
  { id: 'copo', rotulo: 'Copos' },
  { id: 'tirante', rotulo: 'Tirantes' },
  { id: 'camisa', rotulo: 'Camisas' },
  { id: 'shorts', rotulo: 'Shorts' },
  { id: 'acessorio', rotulo: 'Acessórios' },
  { id: 'outros', rotulo: 'Outros' },
];

function ConteudoLoja() {
  const searchParams = useSearchParams();
  const [produtos, setProdutos] = useState<ProdutoLoja[]>([]);
  const [atleticas, setAtleticas] = useState<Atletica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);

  const [busca, setBusca] = useState(searchParams.get('busca') || '');
  const [categoriaAtiva, setCategoriaAtiva] = useState(searchParams.get('categoria') || 'todas');
  const [atleticaSelecionada, setAtleticaSelecionada] = useState(searchParams.get('atletica') || '');
  const [ordenacao, setOrdenacao] = useState<'novos' | 'menor_preco' | 'maior_preco'>('novos');
  const [drawerFiltrosAberto, setDrawerFiltrosAberto] = useState(false);

  const [supabase] = useState(() => criarClienteNavegador());

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      setErroCarga(false);
      try {
        // 1. Busca produtos ativos com dados da atlética
        const { data: prods, error: errProds } = await supabase
          .from('store_products')
          .select(`
            *,
            atletica:atleticas(id, nome, logo_url, cor_primaria, cor_secundaria, faculdade, cidade)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (errProds) {
          setErroCarga(true);
        } else if (prods) {
          setProdutos(prods as ProdutoLoja[]);
        }

        // 2. Busca lista de atléticas
        const { data: atls } = await supabase
          .from('atleticas')
          .select('id, nome, faculdade, cidade, logo_url, capa_url, cor_primaria, cor_secundaria')
          .eq('status', 'ativa')
          .order('nome', { ascending: true });

        if (atls) {
          setAtleticas(atls as Atletica[]);
        }
      } catch (err) {
        console.error('Erro ao carregar loja:', err);
        setErroCarga(true);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [supabase, tentativa]);

  // Categorias exibidas = categorias que realmente existem nos produtos do banco
  const contagemCategorias = produtos.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});
  const CATEGORIAS = [
    { id: 'todas', rotulo: `Tudo (${produtos.length})` },
    ...Object.keys(contagemCategorias)
      .map((id) => ({
        id,
        rotulo: `${ROTULOS_CATEGORIA.find((c) => c.id === id)?.rotulo || id} (${contagemCategorias[id]})`,
      }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
  ];

  // Contagem de filtros ativos (exceto busca direta)
  const totalFiltrosAtivos =
    (categoriaAtiva !== 'todas' ? 1 : 0) +
    (atleticaSelecionada ? 1 : 0) +
    (ordenacao !== 'novos' ? 1 : 0) +
    (somenteDisponiveis ? 1 : 0);

  function limparTodosFiltros() {
    setBusca('');
    setCategoriaAtiva('todas');
    setAtleticaSelecionada('');
    setOrdenacao('novos');
    setSomenteDisponiveis(false);
  }

  // Filtragem e Ordenação dos Produtos
  const produtosFiltrados = produtos
    .filter((p) => {
      // Filtro de busca
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const nomeMatch = p.name.toLowerCase().includes(termo);
        const descMatch = p.description?.toLowerCase().includes(termo) ?? false;
        const atlMatch = p.atletica?.nome.toLowerCase().includes(termo) ?? false;
        if (!nomeMatch && !descMatch && !atlMatch) return false;
      }

      // Filtro de categoria
      if (categoriaAtiva !== 'todas') {
        if (p.category !== categoriaAtiva) return false;
      }

      if (somenteDisponiveis && p.stock_quantity <= 0) return false;

      // Filtro de atlética
      if (atleticaSelecionada) {
        if (p.atletica_id !== atleticaSelecionada) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Esgotados sempre ao final
      const esgA = a.stock_quantity <= 0 ? 1 : 0;
      const esgB = b.stock_quantity <= 0 ? 1 : 0;
      if (esgA !== esgB) return esgA - esgB;
      if (ordenacao === 'menor_preco') return a.price - b.price;
      if (ordenacao === 'maior_preco') return b.price - a.price;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const atleticaObjeto = atleticas.find((a) => a.id === atleticaSelecionada);
  const categoriaObjeto = CATEGORIAS.find((c) => c.id === categoriaAtiva);

  return (
    <>
      <section className="relative overflow-hidden fundo-granulado border-b border-borda-sutil">
        <div className="absolute inset-0 fundo-grade [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden="true" />
        <div className="brilho-ouro w-[480px] h-[480px] -top-56 -right-24 opacity-70" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8">
          <TituloSecao
            nivel="h1"
            rotulo="Loja oficial"
            titulo={<>Veste a <span className="texto-ouro">Cinética.</span></>}
            descricao="Manto, copo, caneca e acessório oficial. Comprou, retirou com a diretoria."
            className="!mb-8"
          />

          <div className="flex items-center gap-2">
            <label className="campo-pop flex items-center gap-3 px-5 h-14 flex-1">
              <Search size={20} className="text-ouro shrink-0" />
              <span className="sr-only">Buscar produtos</span>
              <input
                type="search"
                placeholder="Camisa, caneca, tirante..."
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
            <button
              type="button"
              onClick={() => setDrawerFiltrosAberto(true)}
              aria-label="Abrir filtros"
              data-ativo={totalFiltrosAtivos > 0}
              className="chip h-14 px-5 shrink-0"
            >
              <SlidersHorizontal size={18} />
              <span className="hidden sm:inline">Filtros</span>
              {totalFiltrosAtivos > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-azul-950 text-ouro text-[11px] font-black flex items-center justify-center">
                  {totalFiltrosAtivos}
                </span>
              )}
            </button>
          </div>

          {CATEGORIAS.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto sem-barra-rolagem -mx-4 px-4 sm:mx-0 sm:px-0">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  data-ativo={categoriaAtiva === cat.id}
                  aria-pressed={categoriaAtiva === cat.id}
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className="chip"
                >
                  {cat.rotulo}
                </button>
              ))}
              <button
                type="button"
                data-ativo={somenteDisponiveis}
                aria-pressed={somenteDisponiveis}
                onClick={() => setSomenteDisponiveis((v) => !v)}
                className="chip"
              >
                {somenteDisponiveis && <Check size={14} />} Só disponíveis
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        {totalFiltrosAtivos > 0 && !carregando && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {atleticaSelecionada && atleticaObjeto && (
              <span className="selo bg-fundo-card border border-borda-media text-texto-principal normal-case tracking-normal">
                Atlética: {atleticaObjeto.nome}
                <button type="button" aria-label="Remover filtro de atlética" onClick={() => setAtleticaSelecionada('')} className="cursor-pointer">
                  <X size={12} />
                </button>
              </span>
            )}
            {ordenacao !== 'novos' && (
              <span className="selo bg-fundo-card border border-borda-media text-texto-principal normal-case tracking-normal">
                {ordenacao === 'menor_preco' ? 'Menor preço' : 'Maior preço'}
                <button type="button" aria-label="Remover ordenação" onClick={() => setOrdenacao('novos')} className="cursor-pointer">
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={limparTodosFiltros}
              className="text-xs font-bold text-texto-secundario hover:text-ouro underline underline-offset-4 cursor-pointer"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {erroCarga && !carregando ? (
          <EstadoVazio
            titulo="Não foi possível carregar a loja"
            descricao="Verifique sua conexão e tente novamente."
            icone={<RotateCcw className="w-7 h-7" />}
            acao={
              <Botao variante="primario" onClick={() => setTentativa((t) => t + 1)}>
                Tentar novamente
              </Botao>
            }
          />
        ) : carregando ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[4/5] rounded-[1.75rem]" />
            ))}
          </div>
        ) : produtosFiltrados.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
            {produtosFiltrados.map((produto) => (
              <CardProduto key={produto.id} produto={produto} />
            ))}
          </div>
        ) : (
          <EstadoVazio
            titulo={busca || totalFiltrosAtivos > 0 ? 'Nada encontrado' : 'Loja abastecendo'}
            descricao={
              busca || totalFiltrosAtivos > 0
                ? 'Tenta tirar algum filtro ou buscar outro termo.'
                : 'Ainda não há produtos cadastrados na loja oficial.'
            }
            icone={<ShoppingBag className="w-7 h-7" />}
            acao={
              busca || totalFiltrosAtivos > 0 ? (
                <Botao variante="contorno" onClick={limparTodosFiltros}>
                  Limpar filtros
                </Botao>
              ) : undefined
            }
          />
        )}
      </div>

      {/* Drawer Lateral de Filtros (Sheet) */}
      {drawerFiltrosAberto && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerFiltrosAberto(false)}
          />

          {/* Painel Lateral */}
          <aside className="relative z-10 w-full max-w-md bg-fundo-card border-l border-borda-media rounded-l-[2rem] overflow-hidden flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header do Drawer */}
            <div className="p-5 sm:p-6 border-b border-borda-sutil flex items-center justify-between bg-fundo-elevado/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-ouro/10 text-ouro border border-ouro/20 flex items-center justify-center">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black font-titulo text-texto-principal">Filtros da Loja</h3>
                  <p className="text-[11px] text-texto-secundario">Refine os produtos exibidos</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerFiltrosAberto(false)}
                className="p-2 rounded-xl text-texto-terciario hover:text-texto-secundario hover:bg-fundo-elevado transition-all cursor-pointer"
                aria-label="Fechar filtros"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-fundo-elevado/60 border border-borda-sutil cursor-pointer">
                <span className="text-xs font-black uppercase tracking-wider text-texto-principal">Somente disponíveis</span>
                <input
                  type="checkbox"
                  checked={somenteDisponiveis}
                  onChange={(e) => setSomenteDisponiveis(e.target.checked)}
                  className="w-4 h-4 accent-ouro"
                />
              </label>

              {/* 1. Filtro por Categoria */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-texto-principal">
                    Categoria
                  </label>
                  {categoriaAtiva !== 'todas' && (
                    <button
                      type="button"
                      onClick={() => setCategoriaAtiva('todas')}
                      className="text-[11px] text-ouro hover:underline font-bold cursor-pointer"
                    >
                      Resetar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS.map((cat) => {
                    const ativo = categoriaAtiva === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoriaAtiva(cat.id)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-left flex items-center justify-between border ${
                          ativo
                            ? 'bg-ouro text-azul-950 border-ouro shadow-md shadow-ouro/20 font-black'
                            : 'bg-fundo-elevado/60 text-texto-secundario border-borda-sutil hover:border-borda-media hover:bg-fundo-elevado'
                        }`}
                      >
                        <span className="truncate">{cat.rotulo}</span>
                        {ativo && <Check size={14} className="shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Filtro por Atlética */}
              {atleticas.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-texto-principal">
                      Atlética
                    </label>
                    {atleticaSelecionada && (
                      <button
                        type="button"
                        onClick={() => setAtleticaSelecionada('')}
                        className="text-[11px] text-ouro hover:underline font-bold cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setAtleticaSelecionada('')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer border ${
                        !atleticaSelecionada
                          ? 'bg-ouro/10 text-destaque border-ouro/40 font-black'
                          : 'bg-fundo-elevado/60 text-texto-secundario border-borda-sutil hover:text-texto-principal hover:bg-fundo-elevado'
                      }`}
                    >
                      <span>Todas as Atléticas</span>
                      {!atleticaSelecionada && <Check size={14} />}
                    </button>

                    {atleticas.map((atl) => {
                      const ativo = atleticaSelecionada === atl.id;
                      return (
                        <button
                          key={atl.id}
                          type="button"
                          onClick={() => setAtleticaSelecionada(atl.id)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer border ${
                            ativo
                              ? 'bg-ouro/15 text-destaque border-ouro/50 font-black'
                              : 'bg-fundo-elevado/60 text-texto-secundario border-borda-sutil hover:border-borda-media hover:bg-fundo-elevado'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-5 h-5 rounded-md bg-fundo-card border border-borda-sutil overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-black">
                              {atl.logo_url ? (
                                <ImagemOtimizada src={atl.logo_url} alt={atl.nome} largura={32} comPlaceholder={false} className="w-full h-full object-cover" />
                              ) : (
                                atl.nome[0]
                              )}
                            </div>
                            <span className="truncate">{atl.nome}</span>
                          </div>
                          {ativo && <Check size={14} className="shrink-0 ml-1 text-ouro" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Ordenação */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-texto-principal">
                    Ordenar Por
                  </label>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'novos', rotulo: 'Mais Recentes (Lançamentos)' },
                    { id: 'menor_preco', rotulo: 'Menor Preço' },
                    { id: 'maior_preco', rotulo: 'Maior Preço' },
                  ].map((ord) => {
                    const ativo = ordenacao === ord.id;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => setOrdenacao(ord.id as typeof ordenacao)}
                        className={`w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-between border ${
                          ativo
                            ? 'bg-ouro/15 text-destaque border-ouro/50 shadow-sm font-black'
                            : 'bg-fundo-elevado/60 text-texto-secundario border-borda-sutil hover:border-borda-media'
                        }`}
                      >
                        <span>{ord.rotulo}</span>
                        {ativo && <Check size={16} className="text-ouro" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer com Ações */}
            <div className="p-5 sm:p-6 border-t border-borda-sutil bg-fundo-elevado/60 space-y-3">
              <Botao
                larguraTotal
                variante="primario"
                tamanho="lg"
                onClick={() => setDrawerFiltrosAberto(false)}
                className="font-black"
              >
                Ver {produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'Produto' : 'Produtos'}
              </Botao>

              {totalFiltrosAtivos > 0 && (
                <button
                  type="button"
                  onClick={limparTodosFiltros}
                  className="w-full py-2 text-xs font-bold uppercase tracking-wider text-texto-secundario hover:text-texto-principal transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Limpar Todos os Filtros</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default function PaginaLoja() {
  return (
    <Suspense
      fallback={<div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16"><div className="skeleton h-40 rounded-[1.75rem]" /></div>}
    >
      <ConteudoLoja />
    </Suspense>
  );
}
