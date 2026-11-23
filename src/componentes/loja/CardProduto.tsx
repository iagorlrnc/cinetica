'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Plus, Check } from 'lucide-react';
import { cn, formatarMoeda } from '@/lib/utilitarios';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { usarNotificacao } from '@/componentes/ui/Notificacao';
import type { ProdutoLoja } from '@/tipos';

interface PropsCardProduto {
  produto: ProdutoLoja;
}

export default function CardProduto({ produto }: PropsCardProduto) {
  const { itens, adicionarItem } = usarCarrinho();
  const { mostrarNotificacao } = usarNotificacao();
  const [adicionando, setAdicionando] = useState(false);
  const [adicionado, setAdicionado] = useState(false);

  const esgotado = produto.stock_quantity <= 0;
  const precoReais = produto.price / 100;
  const estaNoCarrinho = adicionado || itens.some((it) => it.product_id === produto.id);
  const temVariosTamanhos = Array.isArray(produto.sizes) && produto.sizes.length > 1;

  async function handleAdicionar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (esgotado || adicionando || estaNoCarrinho) return;

    setAdicionando(true);
    const tamanhoInicial = Array.isArray(produto.sizes) && produto.sizes.length > 0 ? produto.sizes[0] : null;
    const sucesso = await adicionarItem(produto, tamanhoInicial, 1);
    setAdicionando(false);

    if (sucesso) {
      setAdicionado(true);
      mostrarNotificacao({
        tipo: 'sucesso',
        titulo: 'Foi pro carrinho!',
        mensagem: `${produto.name}${tamanhoInicial ? ` (${tamanhoInicial})` : ''} adicionado.`,
      });
    } else {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Não deu certo', mensagem: 'Não foi possível adicionar este produto.' });
    }
  }

  return (
    <div className="group relative flex flex-col">
      <div className="relative">
      <Link
        href={`/loja/produto/${produto.id}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] bg-fundo-elevado border border-borda-sutil transition-all duration-300 group-hover:border-ouro/60 group-hover:-translate-y-1 group-hover:shadow-[0_24px_50px_-24px_rgba(242,193,78,0.45)]"
      >
        {produto.images?.[0] ? (
          <img
            src={produto.images[0]}
            alt={produto.name}
            loading="lazy"
            className={cn(
              'w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.07]',
              esgotado && 'grayscale opacity-50'
            )}
          />
        ) : (
          <div className="w-full h-full fundo-pontos flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-ouro/50" />
          </div>
        )}

        <span className="absolute top-3 left-3 selo bg-azul-950/80 backdrop-blur text-ouro border border-ouro/30 !text-[10px]">
          {produto.category}
        </span>

        {esgotado ? (
          <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center adesivo !bg-red-500 !text-white justify-center text-base">
            Esgotado
          </span>
        ) : produto.stock_quantity <= 5 ? (
          <span className="absolute top-3 right-3 selo bg-white text-azul-950 !text-[10px]">Só {produto.stock_quantity}!</span>
        ) : null}
      </Link>

      {/* Botão rápido de adicionar */}
      {!esgotado && (
        <button
          type="button"
          onClick={estaNoCarrinho ? undefined : handleAdicionar}
          disabled={adicionando}
          aria-label={estaNoCarrinho ? 'Já está no carrinho' : `Adicionar ${produto.name} ao carrinho`}
          title={temVariosTamanhos ? `Adiciona no tamanho ${produto.sizes[0]}. Troque no carrinho ou na página do produto.` : undefined}
          className={cn(
            'absolute right-3 bottom-3 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_4px_0_#070d22]',
            estaNoCarrinho ? 'bg-emerald-400 text-azul-950' : 'bg-ouro text-azul-950 hover:bg-ouro-vivo hover:scale-110 active:scale-95',
            adicionando && 'animate-pulse'
          )}
        >
          {estaNoCarrinho ? <Check size={20} strokeWidth={3} /> : <Plus size={22} strokeWidth={3} />}
        </button>
      )}
      </div>

      <Link href={`/loja/produto/${produto.id}`} className="pt-3 px-1 block">
        <h3 className="font-titulo font-extrabold text-base sm:text-lg text-texto-principal leading-tight line-clamp-2 group-hover:text-ouro transition-colors">
          {produto.name}
        </h3>
        <p className={cn('mt-1 font-titulo font-extrabold text-lg sm:text-xl', precoReais === 0 ? 'text-emerald-400' : 'text-ouro')}>
          {precoReais === 0 ? 'Brinde grátis' : formatarMoeda(precoReais)}
        </p>
      </Link>
    </div>
  );
}
