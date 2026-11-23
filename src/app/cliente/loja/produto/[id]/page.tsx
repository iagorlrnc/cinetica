'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { formatarMoeda, gerarSlug } from '@/lib/utilitarios';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { usarNotificacao } from '@/componentes/ui/Notificacao';
import Botao from '@/componentes/ui/Botao';
import Carregando from '@/componentes/ui/Carregando';
import type { ProdutoLoja } from '@/tipos';
import { ShoppingCart, ArrowLeft, ShieldCheck, Check, Plus, Minus, CreditCard, QrCode, Trophy, Package } from 'lucide-react';

function ConteudoDetalhesProduto({
  produtoId,
}: {
  produtoId: string;
}) {
  const router = useRouter();
  const { itens, adicionarItem } = usarCarrinho();
  const { mostrarNotificacao } = usarNotificacao();

  const [produto, setProduto] = useState<ProdutoLoja | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [imagemSelecionada, setImagemSelecionada] = useState<string>('');
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [adicionando, setAdicionando] = useState(false);
  const [adicionadoRecente, setAdicionadoRecente] = useState(false);

  const [supabase] = useState(() => criarClienteNavegador());

  useEffect(() => {
    async function carregarProduto() {
      try {
        const { data, error } = await supabase
          .from('store_products')
          .select(`
            *,
            atletica:atleticas(id, nome, logo_url, cor_primaria, cor_secundaria, faculdade, cidade, instagram, whatsapp)
          `)
          .eq('id', produtoId)
          .single();

        if (!error && data) {
          const prod = data as ProdutoLoja;
          setProduto(prod);
          if (prod.images && prod.images.length > 0) {
            setImagemSelecionada(prod.images[0]);
          }
          if (prod.sizes && prod.sizes.length > 0) {
            setTamanhoSelecionado(prod.sizes[0]);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar produto:', err);
      } finally {
        setCarregando(false);
      }
    }

    carregarProduto();
  }, [produtoId, supabase]);

  if (carregando) {
    return (
      <>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Carregando tamanho="lg" texto="Carregando detalhes do produto..." />
        </div>
      </>
    );
  }

  if (!produto) {
    return (
      <>
        <div className="max-w-md mx-auto py-24 px-4 text-center">
          <span className="w-20 h-20 rounded-3xl bg-ouro text-azul-950 mx-auto flex items-center justify-center -rotate-6 mb-6">
            <ShoppingCart size={34} />
          </span>
          <h1 className="titulo-display text-5xl text-texto-principal">Produto não encontrado</h1>
          <p className="text-texto-secundario mt-3 mb-8">Ele pode ter saído da loja ou o link está errado.</p>
          <Link href="/loja" className="botao-pop h-14 px-8 text-base">
            <ArrowLeft size={18} /> Voltar pra loja
          </Link>
        </div>
      </>
    );
  }

  const esgotado = produto.stock_quantity <= 0;
  const precoReais = produto.price / 100;
  const subtotalReais = precoReais * quantidade;
  const temTamanhos = Array.isArray(produto.sizes) && produto.sizes.length > 0;
  const estaNoCarrinho = itens.some((it) => it.product_id === produto.id);

  async function handleAdicionar(comprarAgora: boolean = false) {
    if (!produto || esgotado) return;

    if (temTamanhos && !tamanhoSelecionado) {
      mostrarNotificacao({
        tipo: 'erro',
        titulo: 'Selecione o tamanho',
        mensagem: 'Por favor, escolha um tamanho antes de prosseguir.',
      });
      return;
    }

    setAdicionando(true);
    const ok = await adicionarItem(produto, tamanhoSelecionado, quantidade);
    setAdicionando(false);

    if (ok) {
      setAdicionadoRecente(true);
      setTimeout(() => setAdicionadoRecente(false), 2500);

      mostrarNotificacao({
        tipo: 'sucesso',
        titulo: 'Produto adicionado!',
        mensagem: `${produto.name} foi adicionado ao seu carrinho.`,
      });

      if (comprarAgora) {
        router.push('/loja/checkout');
      }
    } else {
      mostrarNotificacao({
        tipo: 'erro',
        titulo: 'Erro ao adicionar',
        mensagem: 'Não foi possível adicionar este produto ao carrinho.',
      });
    }
  }

  return (
    <>
      <div className="relative overflow-hidden">
        <div className="brilho-ouro w-[520px] h-[520px] -top-60 -left-40 opacity-50" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-44 lg:pb-20">
          <Link
            href="/loja"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto-secundario hover:text-ouro transition-colors mb-8"
          >
            <ArrowLeft size={15} /> Loja oficial
          </Link>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
            {/* Galeria */}
            <div className="lg:sticky lg:top-28 space-y-4">
              <div className="relative aspect-square rounded-[2rem] bg-fundo-card border border-borda-sutil overflow-hidden">
                {imagemSelecionada ? (
                  <img
                    src={imagemSelecionada}
                    alt={produto.name}
                    className={`w-full h-full object-cover ${esgotado ? 'grayscale opacity-50' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full fundo-pontos flex items-center justify-center">
                    <Package size={64} className="text-ouro/40" />
                  </div>
                )}
                <span className="absolute top-4 left-4 selo bg-azul-950/80 backdrop-blur text-ouro border border-ouro/30">
                  {produto.category}
                </span>
                {esgotado && (
                  <span className="absolute inset-x-6 top-1/2 -translate-y-1/2 adesivo !bg-red-500 !text-white justify-center text-xl">
                    Esgotado
                  </span>
                )}
              </div>

              {produto.images && produto.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto sem-barra-rolagem pb-1">
                  {produto.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImagemSelecionada(img)}
                      aria-label={`Ver foto ${idx + 1}`}
                      aria-pressed={imagemSelecionada === img}
                      className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        imagemSelecionada === img ? 'border-ouro -rotate-3' : 'border-borda-sutil opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Informações */}
            <div className="space-y-8">
              <div>
                {produto.atletica?.nome && (
                  <Link
                    href={`/atleticas/${gerarSlug(produto.atletica.nome)}?aba=produtos`}
                    className="text-xs font-black uppercase tracking-[0.2em] text-ouro hover:underline underline-offset-4"
                  >
                    {produto.atletica.nome}
                  </Link>
                )}
                <h1 className="titulo-display text-5xl sm:text-6xl text-texto-principal mt-3 break-words">{produto.name}</h1>
                <div className="mt-5 flex flex-wrap items-baseline gap-3">
                  <span className={`font-titulo font-extrabold text-5xl ${precoReais === 0 ? 'text-emerald-400' : 'text-ouro'}`}>
                    {precoReais === 0 ? 'Grátis' : formatarMoeda(precoReais)}
                  </span>
                  {precoReais > 0 && (
                    <span className="text-sm font-semibold text-texto-secundario flex items-center gap-3">
                      <span className="flex items-center gap-1"><QrCode size={15} className="text-emerald-400" /> Pix</span>
                      <span className="flex items-center gap-1"><CreditCard size={15} className="text-ouro" /> Cartão</span>
                    </span>
                  )}
                </div>
              </div>

              {produto.description && (
                <p className="text-base text-texto-secundario leading-relaxed whitespace-pre-line">{produto.description}</p>
              )}

              {temTamanhos && (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-texto-terciario mb-3">
                    Tamanho {tamanhoSelecionado && <span className="text-texto-principal">· {tamanhoSelecionado}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {produto.sizes.map((tam) => (
                      <button
                        key={tam}
                        type="button"
                        onClick={() => setTamanhoSelecionado(tam)}
                        aria-pressed={tamanhoSelecionado === tam}
                        data-ativo={tamanhoSelecionado === tam}
                        className="chip min-w-14 h-14 justify-center text-base font-titulo font-extrabold"
                      >
                        {tam}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-fundo-card border border-borda-sutil">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                    disabled={quantidade <= 1 || esgotado || precoReais === 0}
                    className="w-11 h-11 rounded-full border border-borda-media flex items-center justify-center text-texto-principal hover:border-ouro disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-titulo font-extrabold text-2xl text-texto-principal" aria-live="polite">
                    {precoReais === 0 ? 1 : quantidade}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.min(produto.stock_quantity, q + 1))}
                    disabled={quantidade >= produto.stock_quantity || esgotado || precoReais === 0}
                    className="w-11 h-11 rounded-full border border-borda-media flex items-center justify-center text-texto-principal hover:border-ouro disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-texto-terciario">
                    {esgotado ? 'Sem estoque' : precoReais === 0 ? 'Limite de 1 por pessoa' : `${produto.stock_quantity} em estoque`}
                  </p>
                  <p className="font-titulo font-extrabold text-2xl text-texto-principal">
                    {precoReais === 0 ? 'Grátis' : formatarMoeda(subtotalReais)}
                  </p>
                </div>
              </div>

              <div className="hidden sm:grid grid-cols-2 gap-3">
                <Botao
                  tamanho="xl"
                  variante="festiva"
                  onClick={() => handleAdicionar(true)}
                  disabled={esgotado || adicionando}
                >
                  {esgotado ? 'Esgotado' : precoReais === 0 ? 'Resgatar' : 'Comprar agora'}
                </Botao>
                <Botao
                  tamanho="xl"
                  variante="contorno"
                  onClick={() => handleAdicionar(false)}
                  disabled={esgotado || adicionando}
                  icone={adicionadoRecente ? <Check size={20} /> : <ShoppingCart size={20} />}
                >
                  {adicionadoRecente ? 'No carrinho!' : estaNoCarrinho ? 'Adicionar mais' : 'Pro carrinho'}
                </Botao>
              </div>

              <ul className="grid sm:grid-cols-2 gap-3">
                <li className="flex items-center gap-3 p-4 rounded-2xl border border-borda-sutil text-sm text-texto-secundario">
                  <ShieldCheck size={20} className="text-emerald-400 shrink-0" /> Pagamento seguro pelo Mercado Pago
                </li>
                <li className="flex items-center gap-3 p-4 rounded-2xl border border-borda-sutil text-sm text-texto-secundario">
                  <Trophy size={20} className="text-ouro shrink-0" /> Produto oficial da atlética
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de compra no celular (acima da navegação inferior) */}
      <div className="sm:hidden fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-40">
        <div className="flex items-center gap-2 rounded-[1.5rem] bg-fundo-card/95 backdrop-blur-xl border border-borda-media p-2.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]">
          <button
            type="button"
            onClick={() => handleAdicionar(false)}
            disabled={esgotado || adicionando}
            aria-label="Adicionar ao carrinho"
            className="w-12 h-12 rounded-full border-2 border-ouro text-ouro flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
          >
            {adicionadoRecente ? <Check size={20} /> : <ShoppingCart size={20} />}
          </button>
          <button
            type="button"
            onClick={() => handleAdicionar(true)}
            disabled={esgotado || adicionando}
            className="botao-pop flex-1 h-12 text-base"
          >
            {esgotado ? 'Esgotado' : `${precoReais === 0 ? 'Resgatar' : 'Comprar'} · ${precoReais === 0 ? 'Grátis' : formatarMoeda(subtotalReais)}`}
          </button>
        </div>
      </div>
    </>
  );
}

export default function PaginaDetalhesProduto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Carregando tamanho="lg" texto="Carregando produto..." />
        </div>
      }
    >
      <ConteudoDetalhesProduto produtoId={resolvedParams.id} />
    </Suspense>
  );
}
