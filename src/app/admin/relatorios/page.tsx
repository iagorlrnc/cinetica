'use client';

import { useState, useEffect } from 'react';
import Cartao from '@/componentes/ui/Cartao';
import Carregando from '@/componentes/ui/Carregando';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { formatarMoeda } from '@/lib/utilitarios';
import { DollarSign, Ticket, Users } from 'lucide-react';

interface DadosRelatorio {
  volumeTotal: number;
  totalPagamentos: number;
  totalIngressos: number;
  ingressosValidos: number;
  ingressosUtilizados: number;
  eventosPublicados: number;
  atleticasAtivas: number;
  clientes: number;
  diretores: number;
}

export default function PaginaRelatorios() {
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const supabase = criarClienteNavegador();

  async function buscarDados() {
    const [
      pagamentosRes,
      ingressosTotaisRes,
      ingressosValidosRes,
      ingressosUtilizadosRes,
      eventosPublicadosRes,
      atleticasAtivasRes,
      clientesRes,
      diretoresRes,
    ] = await Promise.all([
      supabase.from('pagamentos').select('valor').eq('status', 'aprovado'),
      supabase.from('ingressos').select('id', { count: 'exact', head: true }),
      supabase.from('ingressos').select('id', { count: 'exact', head: true }).eq('status', 'valido'),
      supabase.from('ingressos').select('id', { count: 'exact', head: true }).eq('status', 'utilizado'),
      supabase.from('eventos').select('id', { count: 'exact', head: true }).eq('status', 'publicado'),
      supabase.from('atleticas').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'cliente'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'diretor'),
    ]);

    const volumeTotal = pagamentosRes.data?.reduce((a: number, p: { valor?: number }) => a + Number(p.valor || 0), 0) || 0;

    setDados({
      volumeTotal,
      totalPagamentos: pagamentosRes.data?.length || 0,
      totalIngressos: ingressosTotaisRes.count || 0,
      ingressosValidos: ingressosValidosRes.count || 0,
      ingressosUtilizados: ingressosUtilizadosRes.count || 0,
      eventosPublicados: eventosPublicadosRes.count || 0,
      atleticasAtivas: atleticasAtivasRes.count || 0,
      clientes: clientesRes.count || 0,
      diretores: diretoresRes.count || 0,
    });
    setCarregando(false);
  }

  useEffect(() => { buscarDados(); }, []);

  if (carregando) return <div className="flex items-center justify-center h-96"><Carregando tamanho="lg" texto="Carregando dados..." /></div>;
  if (!dados) return null;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-black font-titulo mb-2 text-slate-900">
        <span className="text-[#c59941]">Relatórios</span>
      </h1>
      <p className="text-slate-500 mb-8">Visão analítica da plataforma</p>

      {/* Financeiro */}
      <h2 className="text-lg font-bold font-titulo mb-4 flex items-center gap-2 text-slate-900">
        <DollarSign size={20} className="text-emerald-600" /> Financeiro
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Volume Total</p>
          <p className="text-3xl font-black font-titulo text-emerald-600">{formatarMoeda(dados.volumeTotal)}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Receita Plataforma (10%)</p>
          <p className="text-3xl font-black font-titulo text-[#9a7228]">{formatarMoeda(dados.volumeTotal * 0.1)}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Transações</p>
          <p className="text-3xl font-black font-titulo text-slate-900">{dados.totalPagamentos}</p>
        </Cartao>
      </div>

      {/* Ingressos */}
      <h2 className="text-lg font-bold font-titulo mb-4 flex items-center gap-2 text-slate-900">
        <Ticket size={20} className="text-[#9a7228]" /> Ingressos
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Total Vendidos</p>
          <p className="text-3xl font-black font-titulo text-slate-900">{dados.totalIngressos}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Válidos (não usados)</p>
          <p className="text-3xl font-black font-titulo text-emerald-600">{dados.ingressosValidos}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Utilizados</p>
          <p className="text-3xl font-black font-titulo text-[#121826]">{dados.ingressosUtilizados}</p>
        </Cartao>
      </div>

      {/* Usuários */}
      <h2 className="text-lg font-bold font-titulo mb-4 flex items-center gap-2 text-slate-900">
        <Users size={20} className="text-[#121826]" /> Usuários & Operações
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Clientes</p>
          <p className="text-3xl font-black font-titulo text-slate-900">{dados.clientes}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Diretores</p>
          <p className="text-3xl font-black font-titulo text-[#9a7228]">{dados.diretores}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Atléticas Ativas</p>
          <p className="text-3xl font-black font-titulo text-[#9a7228]">{dados.atleticasAtivas}</p>
        </Cartao>
        <Cartao variante="vidro">
          <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Eventos Publicados</p>
          <p className="text-3xl font-black font-titulo text-[#c59941]">{dados.eventosPublicados}</p>
        </Cartao>
      </div>
    </div>
  );
}
