'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { formatarMoeda } from '@/lib/utilitarios';
import CheckoutTransparenteLoja from '@/componentes/loja/CheckoutTransparenteLoja';
import Botao from '@/componentes/ui/Botao';
import Carregando from '@/componentes/ui/Carregando';
import {
  ShoppingCart,
  ArrowLeft,
  ShieldCheck,
  Lock,
  LogIn,
  UserCheck,
  Sparkles,
} from 'lucide-react';

export default function PaginaCheckoutLoja() {
  const router = useRouter();
  const { usuario, perfil, carregando: carregandoAuth } = usarAutenticacao();
  const { itens, totalItens, totalValorCentavos, carregando: carregandoCarrinho } = usarCarrinho();

  if (carregandoAuth || carregandoCarrinho) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Carregando tamanho="lg" texto="Preparando seu checkout seguro..." />
      </div>
    );
  }

  // Se o carrinho estiver vazio
  if (itens.length === 0) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-slate-400">
          <ShoppingCart size={28} />
        </div>
        <h2 className="text-xl font-bold text-white font-titulo">Carrinho Vazio</h2>
        <p className="text-xs text-slate-400">
          Você não possui itens no carrinho para finalizar a compra.
        </p>
        <Link href="/loja">
          <Botao variante="festiva" tamanho="md" icone={<Sparkles size={16} />}>
            Ir para a Loja Oficial
          </Botao>
        </Link>
      </div>
    );
  }

  const totalReais = totalValorCentavos / 100;

  // Se o usuário não estiver logado, exibe aviso e botão de login
  if (!usuario) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
        <div>
          <Link
            href="/loja/carrinho"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar ao Carrinho
          </Link>
        </div>

        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#c59941]/10 border border-[#c59941]/20 mx-auto flex items-center justify-center text-[#c59941]">
            <Lock size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 font-titulo">
              Identifique-se para Continuar
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Para garantir a segurança da sua compra e vincular seus produtos ao seu perfil oficial, faça login ou cadastre-se. Seu carrinho continuará salvo!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/autenticacao/entrar?redirecionar=/loja/checkout" className="w-full sm:w-auto">
              <Botao variante="primario" tamanho="lg" larguraTotal icone={<LogIn size={16} />}>
                Fazer Login
              </Botao>
            </Link>
            <Link href="/autenticacao/cadastro?redirecionar=/loja/checkout" className="w-full sm:w-auto">
              <Botao variante="secundario" tamanho="lg" larguraTotal icone={<UserCheck size={16} />}>
                Criar Nova Conta
              </Botao>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Itens formatados para o checkout
  const itensPayload = itens.map((it) => ({
    product_id: it.product_id,
    size: it.tamanho,
    quantity: it.quantidade,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Botão Voltar */}
      <div>
        <Link
          href="/loja/carrinho"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar ao Carrinho
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulário de Checkout Transparente (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black font-titulo text-slate-900 flex items-center gap-2.5">
              <ShieldCheck className="text-[#c59941]" size={28} />
              Finalizar Pedido
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Escolha a forma de pagamento e confirme sua compra com segurança
            </p>
          </div>

          <CheckoutTransparenteLoja
            itens={itensPayload}
            usuario={{
              id: usuario.id,
              nome: perfil?.nome || usuario.user_metadata?.nome || usuario.user_metadata?.full_name,
              email: perfil?.email || usuario.email,
              cpf: perfil?.cpf || usuario.user_metadata?.cpf,
              telefone: perfil?.telefone || usuario.user_metadata?.telefone,
            }}
            totalCentavos={totalValorCentavos}
          />
        </div>

        {/* Resumo dos Itens e Totais (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 space-y-6 shadow-sm sticky top-28">
            <h3 className="text-lg font-bold text-slate-900 font-titulo pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Itens do Pedido</span>
              <span className="text-xs font-normal text-slate-500">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
            </h3>

            {/* Lista dos Itens */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {itens.map((item) => {
                const foto = item.produto?.images?.[0] || '/imagens/placeholder-produto.png';
                const subtotal = (item.precoUnitario * item.quantidade) / 100;

                return (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <img
                      src={foto}
                      alt={item.produto?.name || 'Produto'}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.produto?.name || 'Produto'}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>Qtd: {item.quantidade}x</span>
                        {item.tamanho && <span>• Tam: {item.tamanho}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-900 font-titulo shrink-0">
                      {formatarMoeda(subtotal)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Totais */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal dos produtos</span>
                <span className="font-bold text-slate-900">{formatarMoeda(totalReais)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Entrega / Retirada</span>
                <span className="text-emerald-600 font-bold">Com a Atlética</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-900">Total a Pagar</span>
                <span className="text-2xl font-black text-slate-900 font-titulo">
                  {formatarMoeda(totalReais)}
                </span>
              </div>
            </div>

            {/* Dados do Comprador */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
              <p className="text-slate-500 font-bold uppercase tracking-wider">Comprador:</p>
              <p className="text-slate-900 font-medium">{perfil?.nome || usuario.email}</p>
              <p className="text-slate-500">{usuario.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
