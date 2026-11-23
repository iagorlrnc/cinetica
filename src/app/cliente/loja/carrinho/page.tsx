'use client';

import ImagemOtimizada from '@/componentes/ui/ImagemOtimizada';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { formatarMoeda } from '@/lib/utilitarios';
import Carregando from '@/componentes/ui/Carregando';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, ArrowLeft, ShieldCheck, Package } from 'lucide-react';

export default function PaginaCarrinho() {
  const router = useRouter();
  const { itens, totalItens, totalValorCentavos, carregando, atualizarQuantidade, removerItem, limparCarrinho } =
    usarCarrinho();

  if (carregando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Carregando tamanho="lg" texto="Abrindo seu carrinho..." />
      </div>
    );
  }

  const totalReais = totalValorCentavos / 100;

  if (itens.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center">
        <span className="w-24 h-24 rounded-[2rem] bg-ouro text-azul-950 mx-auto flex items-center justify-center -rotate-6 shadow-[5px_5px_0_#070d22] mb-8">
          <ShoppingBag size={42} />
        </span>
        <h1 className="titulo-display text-5xl sm:text-6xl text-texto-principal">
          Carrinho <span className="texto-contorno">vazio</span>
        </h1>
        <p className="text-texto-secundario mt-4 mb-10">Bora encher isso aqui com o manto da Cinética?</p>
        <Link href="/loja" className="botao-pop h-14 px-8 text-lg">
          Ir pra loja <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  function confirmarEsvaziar() {
    if (window.confirm('Remover todos os itens do carrinho?')) limparCarrinho();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-44 lg:pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ouro mb-3">Sua sacola</p>
          <h1 className="titulo-display text-5xl sm:text-6xl text-texto-principal">
            Carrinho <span className="text-ouro">({totalItens})</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={confirmarEsvaziar}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-texto-secundario hover:text-red-400 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Trash2 size={16} /> Esvaziar
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        <ul className="space-y-4">
          {itens.map((item) => {
            const precoItemReais = item.precoUnitario / 100;
            const subtotalItemReais = precoItemReais * item.quantidade;
            const maxEstoque = item.produto?.stock_quantity ?? 99;
            const foto = item.produto?.images?.[0];

            return (
              <li key={item.id} className="flex gap-4 p-4 rounded-[1.5rem] bg-fundo-card border border-borda-sutil">
                <Link
                  href={`/loja/produto/${item.product_id}`}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-fundo-elevado overflow-hidden shrink-0 flex items-center justify-center"
                >
                  {foto ? (
                    <ImagemOtimizada src={foto} alt={item.produto?.name || 'Produto'} largura={128} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="text-ouro/50" size={32} />
                  )}
                </Link>

                <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/loja/produto/${item.product_id}`}>
                        <h2 className="font-titulo font-extrabold text-lg text-texto-principal hover:text-ouro transition-colors line-clamp-2 leading-tight">
                          {item.produto?.name || 'Produto'}
                        </h2>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {item.tamanho && (
                          <span className="selo bg-fundo-elevado border border-borda-sutil text-texto-principal !py-0.5">
                            {item.tamanho}
                          </span>
                        )}
                        <span className="text-xs text-texto-terciario">{formatarMoeda(precoItemReais)} cada</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="p-2 -m-1 text-texto-terciario hover:text-red-400 rounded-full hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      aria-label={`Remover ${item.produto?.name || 'item'}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-borda-media p-1">
                      <button
                        type="button"
                        onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-texto-principal hover:bg-fundo-hover cursor-pointer"
                        aria-label="Diminuir quantidade"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-titulo font-extrabold text-texto-principal">
                        {precoItemReais === 0 ? 1 : item.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                        disabled={precoItemReais === 0 || item.quantidade >= maxEstoque}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-texto-principal hover:bg-fundo-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        aria-label="Aumentar quantidade"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className={`font-titulo font-extrabold text-xl ${precoItemReais === 0 ? 'text-emerald-400' : 'text-ouro'}`}>
                      {precoItemReais === 0 ? 'Grátis' : formatarMoeda(subtotalItemReais)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}

          <li>
            <Link
              href="/loja"
              className="inline-flex items-center gap-2 text-sm font-bold text-texto-secundario hover:text-ouro transition-colors"
            >
              <ArrowLeft size={16} /> Continuar comprando
            </Link>
          </li>
        </ul>

        <aside className="lg:sticky lg:top-28 rounded-[1.75rem] bg-fundo-card border border-borda-media p-6 space-y-5">
          <h2 className="font-titulo font-extrabold text-2xl text-texto-principal">Resumo</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-texto-secundario">
              <span>
                Subtotal ({totalItens} {totalItens === 1 ? 'item' : 'itens'})
              </span>
              <span className="font-semibold text-texto-principal">{formatarMoeda(totalReais)}</span>
            </div>
            <div className="flex justify-between text-texto-secundario">
              <span>Entrega</span>
              <span className="font-semibold text-emerald-400">Retirada com a atlética</span>
            </div>
            <div className="pt-4 border-t border-dashed border-borda-media flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-wider text-texto-terciario">Total</span>
              <span className="font-titulo font-extrabold text-4xl text-texto-principal leading-none">{formatarMoeda(totalReais)}</span>
            </div>
          </div>

          <button type="button" onClick={() => router.push('/loja/checkout')} className="botao-pop w-full h-14 text-lg hidden lg:flex">
            Ir pro pagamento <ArrowRight size={20} />
          </button>

          <p className="flex items-center justify-center gap-2 text-xs font-semibold text-texto-secundario">
            <ShieldCheck size={15} className="text-emerald-400" /> Pix ou cartão, sem sair do site
          </p>
        </aside>
      </div>

      {/* CTA fixo no celular */}
      <div className="lg:hidden fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-40">
        <button
          type="button"
          onClick={() => router.push('/loja/checkout')}
          className="botao-pop w-full h-14 text-base justify-between px-6"
        >
          <span>Ir pro pagamento</span>
          <span className="flex items-center gap-2">
            {formatarMoeda(totalReais)} <ArrowRight size={18} />
          </span>
        </button>
      </div>
    </div>
  );
}
