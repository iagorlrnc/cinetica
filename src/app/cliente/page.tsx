'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gift, ShoppingBag, RotateCcw } from 'lucide-react';
import HeroProdutos from '@/componentes/inicio/HeroProdutos';
import FaixaCinetica from '@/componentes/inicio/FaixaCinetica';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { COLUNAS_SORTEIO_PUBLICO, normalizarSorteio, ordenarSorteios } from '@/lib/sorteios';
import CardSorteio from '@/componentes/sorteios/CardSorteio';
import CardProduto from '@/componentes/loja/CardProduto';
import TituloSecao from '@/componentes/ui/TituloSecao';
import type { ProdutoLoja, Sorteio } from '@/tipos';

interface DadosInicio {
  sorteios: Sorteio[];
  produtos: ProdutoLoja[];
}

export default function PaginaInicial() {
  const [supabase] = useState(() => criarClienteNavegador());
  const [agora] = useState(() => Date.now());
  const [dados, setDados] = useState<DadosInicio | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setErro(false);
      const [resSorteios, resProdutos] = await Promise.all([
        supabase
          .from('sorteios')
          .select(COLUNAS_SORTEIO_PUBLICO)
          .in('status', ['ativo', 'em_breve'])
          .order('data_sorteio', { ascending: true })
          .limit(4),
        supabase
          .from('store_products')
          .select(
            'id, atletica_id, name, description, price, category, images, sizes, stock_quantity, is_active, created_by, created_at, updated_at, atletica:atleticas(id, nome, logo_url, cor_primaria, cor_secundaria)'
          )
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (!ativo) return;

      if (resSorteios.error && resProdutos.error) {
        setErro(true);
        return;
      }

      const sorteios = ordenarSorteios(
        ((resSorteios.data || []) as unknown as Parameters<typeof normalizarSorteio>[0][]).map(normalizarSorteio)
      ).slice(0, 2);

      const produtos = ((resProdutos.data || []) as unknown as (ProdutoLoja & { atletica: unknown })[]).map((p) => ({
        ...p,
        atletica: Array.isArray(p.atletica) ? p.atletica[0] ?? undefined : (p.atletica as ProdutoLoja['atletica']),
      }));
      // Disponíveis primeiro
      produtos.sort((a, b) => Number(b.stock_quantity > 0) - Number(a.stock_quantity > 0));

      setDados({ sorteios, produtos });
    }

    carregar().catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [supabase, agora, tentativa]);

  const carregando = !dados && !erro;

  return (
    <div className="overflow-x-clip">
      {/* ================= HERO (carrossel de produtos com a mão) ================= */}
      <HeroProdutos produtos={dados?.produtos ?? []} carregando={carregando} />

      {/* ================= FAIXA ================= */}
      <div className="relative z-30 -mt-10 sm:-mt-12">
        <FaixaCinetica />
      </div>

      {erro && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
          <div className="rounded-[1.75rem] border border-red-500/30 bg-red-500/10 p-8 text-center">
            <p className="font-titulo font-extrabold text-2xl text-texto-principal">Ops, não deu pra carregar agora.</p>
            <p className="text-texto-secundario mt-2">Confere sua conexão e tenta de novo.</p>
            <button type="button" onClick={() => setTentativa((t) => t + 1)} className="botao-pop h-12 px-6 mt-6">
              <RotateCcw size={18} /> Tentar de novo
            </button>
          </div>
        </div>
      )}

      {/* ================= SORTEIOS ================= */}
      {(carregando || (dados && dados.sorteios.length > 0)) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32">
          <TituloSecao
            rotulo="Sorteios"
            titulo={
              <>
                Tá com <span className="texto-ouro">sorte</span> hoje?
              </>
            }
            descricao="Cotas baratinhas, prêmios bons e a grana vai pros projetos da atlética."
            link={{ href: '/sorteios', texto: 'Todos os sorteios' }}
          />
          {carregando ? (
            <div className="grid gap-5">
              <div className="skeleton h-64 rounded-[1.75rem]" />
            </div>
          ) : (
            <div className="grid gap-5">
              {dados!.sorteios.map((s) => (
                <Link key={s.id} href="/sorteios" className="block" aria-label={`Ver sorteio ${s.titulo}`}>
                  <CardSorteio sorteio={s} agora={agora} compacto />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= LOJA ================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-16 sm:pb-20">
        <TituloSecao
          rotulo="Loja oficial"
          titulo={
            <>
              Veste o <span className="texto-ouro">manto.</span>
            </>
          }
          descricao="Camisas, copos, canecas e acessórios oficiais da Cinética."
          link={{ href: '/loja', texto: 'Entrar na loja' }}
        />

        {carregando ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[3/4] rounded-[1.75rem]" />
            ))}
          </div>
        ) : dados && dados.produtos.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {dados.produtos.slice(0, 4).map((p) => (
              <CardProduto key={p.id} produto={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-borda-media p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-ouro mx-auto mb-3" />
            <p className="font-titulo font-extrabold text-2xl text-texto-principal">Loja abastecendo</p>
            <p className="text-texto-secundario mt-1">Os produtos novos chegam em breve.</p>
          </div>
        )}
      </section>

      {/* Atalho para sorteios quando a seção não aparece */}
      {dados && dados.sorteios.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-24">
          <Link
            href="/sorteios"
            className="group flex items-center justify-between gap-4 rounded-[1.75rem] border border-borda-sutil bg-fundo-card p-6 hover:border-ouro/60 transition-colors"
          >
            <span className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-ouro/15 text-ouro flex items-center justify-center">
                <Gift size={22} />
              </span>
              <span>
                <span className="block font-titulo font-extrabold text-xl text-texto-principal">Sorteios</span>
                <span className="text-sm text-texto-secundario">Veja os resultados e as próximas ações.</span>
              </span>
            </span>
            <ArrowRight className="text-ouro transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      )}
    </div>
  );
}
