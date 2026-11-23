'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Minus, Plus, QrCode, RotateCcw, Ticket, Timer, PartyPopper, AlertCircle } from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import { formatarMoeda } from '@/lib/utilitarios';
import { cotasRestantes, formatarNumeroBilhete } from '@/lib/sorteios';
import { MAX_COTAS_POR_COMPRA } from '@/lib/pagamentos/sorteios';
import { TEMPO_RESERVA_COTAS_MINUTOS } from '@/lib/constantes';
import type { Sorteio } from '@/tipos';

const OPCOES = [1, 3, 5, 10];
const INTERVALO_CONSULTA_MS = 4000;

interface Cobranca {
  pedido_id: string;
  qr_code: string;
  qr_code_base64: string | null;
  expira_em: string;
  valor_total: number;
  quantidade: number;
}

type Etapa = 'escolher' | 'pagando' | 'pago' | 'expirado' | 'problema';

function formatarTempo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Compra de cotas via Pix (Mercado Pago). Os bilhetes só são criados — e só
 * aparecem para o usuário — depois que o pagamento é aprovado.
 */
export default function CheckoutPixSorteio({ sorteio, aoConcluir }: { sorteio: Sorteio; aoConcluir?: () => void }) {
  const gratuito = sorteio.valor_cota <= 0;
  const maxCotas = gratuito ? 1 : Math.max(1, Math.min(MAX_COTAS_POR_COMPRA, cotasRestantes(sorteio)));
  const [quantidade, setQuantidade] = useState(1);
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [numeros, setNumeros] = useState<number[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [restanteMs, setRestanteMs] = useState(0);
  const consultando = useRef(false);

  async function gerarPix() {
    setErro(null);
    setGerando(true);
    try {
      const res = await fetch('/api/sorteios/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sorteio_id: sorteio.id, quantidade }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.erro || 'Não foi possível gerar o Pix.');
        return;
      }
      setCobranca(dados as Cobranca);
      setEtapa('pagando');
    } catch {
      setErro('Sem conexão. Tente novamente.');
    } finally {
      setGerando(false);
    }
  }

  async function resgatar() {
    setErro(null);
    setGerando(true);
    try {
      const res = await fetch('/api/sorteios/gratuito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sorteio_id: sorteio.id }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.erro || 'Não foi possível resgatar a cota.');
        return;
      }
      setNumeros(dados.numeros || []);
      setEtapa('pago');
      aoConcluir?.();
    } catch {
      setErro('Sem conexão. Tente novamente.');
    } finally {
      setGerando(false);
    }
  }

  const consultar = useCallback(async () => {
    if (!cobranca || consultando.current) return;
    consultando.current = true;
    try {
      const res = await fetch(`/api/sorteios/pix?pedido_id=${encodeURIComponent(cobranca.pedido_id)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const dados = await res.json();
      if (dados.status === 'pago') {
        setNumeros(dados.numeros || []);
        setEtapa('pago');
        aoConcluir?.();
      } else if (dados.status === 'expirado' || dados.status === 'cancelado') {
        setEtapa('expirado');
      } else if (dados.status === 'pago_sem_cota' || dados.status === 'estornado') {
        setEtapa('problema');
      }
    } finally {
      consultando.current = false;
    }
  }, [cobranca, aoConcluir]);

  // Consulta o pagamento e atualiza a contagem regressiva enquanto o Pix está aberto
  useEffect(() => {
    if (etapa !== 'pagando' || !cobranca) return;
    const fim = new Date(cobranca.expira_em).getTime();
    const tick = () => setRestanteMs(fim - Date.now());
    tick();
    const relogio = setInterval(tick, 1000);
    const consulta = setInterval(consultar, INTERVALO_CONSULTA_MS);
    const aoVoltar = () => document.visibilityState === 'visible' && consultar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(relogio);
      clearInterval(consulta);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [etapa, cobranca, consultar]);

  async function copiarCodigo() {
    if (!cobranca) return;
    try {
      await navigator.clipboard.writeText(cobranca.qr_code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      setCopiado(false);
    }
  }

  const total = Math.round(sorteio.valor_cota * quantidade * 100) / 100;

  if (etapa === 'pago') {
    return (
      <div className="text-center space-y-5">
        <span className="w-16 h-16 rounded-2xl bg-emerald-400 text-azul-950 flex items-center justify-center mx-auto">
          <PartyPopper size={30} />
        </span>
        <div>
          <p className="font-titulo font-extrabold text-2xl text-texto-principal">{gratuito ? 'Cota resgatada!' : 'Pagamento aprovado!'}</p>
          <p className="text-sm text-texto-secundario mt-1">Seus números da sorte já estão na sua conta:</p>
        </div>
        <ul className="flex flex-wrap justify-center gap-2">
          {numeros.map((n) => (
            <li key={n} className="px-4 py-2 rounded-xl border-2 border-dashed border-ouro bg-ouro/10 font-mono font-black text-lg text-ouro">
              {formatarNumeroBilhete(n, sorteio.total_cotas)}
            </li>
          ))}
        </ul>
        <Link href="/meus-bilhetes" className="botao-pop h-12 px-6 text-base">
          <Ticket size={18} /> Ver meus bilhetes
        </Link>
      </div>
    );
  }

  if (etapa === 'expirado' || etapa === 'problema') {
    return (
      <div className="text-center space-y-4">
        <span className="w-14 h-14 rounded-2xl bg-fundo-elevado border border-borda-media flex items-center justify-center mx-auto">
          <AlertCircle className="text-ouro" />
        </span>
        <p className="font-titulo font-extrabold text-xl text-texto-principal">
          {etapa === 'expirado' ? 'O Pix expirou' : 'Precisamos verificar seu pagamento'}
        </p>
        <p className="text-sm text-texto-secundario">
          {etapa === 'expirado'
            ? 'As cotas reservadas voltaram para a venda. Se ainda quiser participar, gere um novo Pix.'
            : 'O pagamento chegou depois do prazo e as cotas já tinham acabado. Fale com a diretoria para o reembolso.'}
        </p>
        {etapa === 'expirado' && (
          <Botao
            icone={<RotateCcw size={16} />}
            onClick={() => {
              setCobranca(null);
              setEtapa('escolher');
            }}
          >
            Gerar novo Pix
          </Botao>
        )}
      </div>
    );
  }

  if (etapa === 'pagando' && cobranca) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-ouro text-azul-950">
          <div>
            <p className="text-xs font-black uppercase tracking-wider opacity-70">Total</p>
            <p className="font-titulo font-extrabold text-2xl leading-none mt-1">{formatarMoeda(cobranca.valor_total)}</p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-full bg-azul-950 text-ouro" aria-live="polite">
            <Timer size={15} /> {formatarTempo(restanteMs)}
          </span>
        </div>

        <div className="flex justify-center">
          {cobranca.qr_code_base64 ? (
            <img
              src={`data:image/png;base64,${cobranca.qr_code_base64}`}
              alt="QR Code do Pix"
              className="w-56 h-56 rounded-2xl bg-[#ffffff] p-3"
            />
          ) : (
            <div className="w-56 h-56 rounded-2xl bg-fundo-elevado flex items-center justify-center">
              <QrCode className="w-16 h-16 text-texto-terciario" />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-texto-secundario mb-2">Pix copia e cola</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={cobranca.qr_code}
              aria-label="Código Pix copia e cola"
              onFocus={(e) => e.currentTarget.select()}
              className="campo-pop flex-1 min-w-0 h-12 px-4 text-xs font-mono"
            />
            <Botao variante={copiado ? 'sucesso' : 'primario'} onClick={copiarCodigo} icone={copiado ? <Check size={16} /> : <Copy size={16} />}>
              {copiado ? 'Copiado!' : 'Copiar'}
            </Botao>
          </div>
        </div>

        <p className="flex items-center justify-center gap-2 text-sm text-texto-secundario">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Aguardando pagamento. Seus bilhetes aparecem aqui assim que o Pix for aprovado.
        </p>
      </div>
    );
  }

  // Sorteio gratuito: 1 cota por pessoa
  if (gratuito) {
    return (
      <div className="space-y-6">
        <div className="p-5 rounded-3xl bg-ouro text-azul-950 flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider opacity-70">Cota</span>
            <p className="font-titulo font-extrabold text-3xl leading-none mt-1">Grátis</p>
          </div>
          <span className="text-sm font-black px-3 py-1.5 rounded-full bg-azul-950 text-ouro">1 cota</span>
        </div>

        <p className="p-4 rounded-2xl bg-fundo-elevado border border-borda-media text-sm text-texto-principal flex gap-2">
          <AlertCircle size={18} className="text-ouro shrink-0 mt-0.5" />
          <span>
            Sorteio gratuito: cada conta pode resgatar <strong>apenas 1 cota</strong>. O número é sorteado e fica guardado em Meus bilhetes.
          </span>
        </p>

        {erro && <p className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{erro}</p>}

        <button type="button" onClick={resgatar} disabled={gerando} className="botao-pop w-full h-14 text-base">
          <Ticket size={20} /> {gerando ? 'Resgatando...' : 'Resgatar'}
        </button>
      </div>
    );
  }

  // Etapa: escolher quantidade
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-texto-secundario mb-3">Quantas cotas?</p>
        <div className="grid grid-cols-4 gap-2">
          {OPCOES.filter((q) => q <= maxCotas).map((q) => (
            <button
              key={q}
              type="button"
              data-ativo={quantidade === q}
              onClick={() => setQuantidade(q)}
              className="chip justify-center h-12 text-base font-titulo font-extrabold"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            type="button"
            aria-label="Diminuir cotas"
            onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
            className="w-11 h-11 rounded-full border border-borda-media flex items-center justify-center hover:border-ouro cursor-pointer"
          >
            <Minus size={16} />
          </button>
          <span className="font-titulo font-extrabold text-3xl w-14 text-center text-texto-principal" aria-live="polite">
            {quantidade}
          </span>
          <button
            type="button"
            aria-label="Aumentar cotas"
            onClick={() => setQuantidade((q) => Math.min(maxCotas, q + 1))}
            className="w-11 h-11 rounded-full border border-borda-media flex items-center justify-center hover:border-ouro cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-ouro text-azul-950 flex items-center justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-wider opacity-70">Total</span>
          <p className="font-titulo font-extrabold text-3xl leading-none mt-1">{formatarMoeda(total)}</p>
        </div>
        <span className="text-sm font-black px-3 py-1.5 rounded-full bg-azul-950 text-ouro">
          {quantidade} {quantidade === 1 ? 'cota' : 'cotas'}
        </span>
      </div>

      {erro && <p className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{erro}</p>}

      <button type="button" onClick={gerarPix} disabled={gerando} className="botao-pop w-full h-14 text-base">
        <QrCode size={20} /> {gerando ? 'Gerando Pix...' : 'Pagar com Pix'}
      </button>
      <p className="text-xs text-center text-texto-terciario">
        As cotas ficam reservadas por {TEMPO_RESERVA_COTAS_MINUTOS} minutos. Os números são sorteados e liberados na sua conta assim que o pagamento é aprovado.
      </p>
    </div>
  );
}
