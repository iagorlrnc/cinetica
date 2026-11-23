'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Ticket, Trash2, RotateCcw, Search } from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { useNotificacao } from '@/componentes/ui/Notificacao';
import { formatarDataHora } from '@/lib/utilitarios';
import {
  cotasRestantes,
  formatarNumeroBilhete,
  traduzirErroBilhete,
  validarRegistroBilhetes,
  type BilheteDiretoria,
} from '@/lib/sorteios';
import type { Sorteio } from '@/tipos';

interface Props {
  sorteio: Sorteio;
  /** Chamado após registrar/cancelar, para a lista de sorteios atualizar as cotas. */
  aoAlterar: () => void;
}

/**
 * Painel da diretoria para registrar bilhetes na conta de um participante
 * (após conferir o Pix) e cancelar bilhetes registrados por engano.
 * Toda escrita passa pelas RPCs da migração 034, que checam a permissão no banco.
 */
export default function GerenciarBilhetes({ sorteio, aoAlterar }: Props) {
  const [supabase] = useState(() => criarClienteNavegador());
  const { sucesso, erro: notificarErro } = useNotificacao();
  const [bilhetes, setBilhetes] = useState<BilheteDiretoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [observacao, setObservacao] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [ultimos, setUltimos] = useState<{ nome: string; numeros: number[] } | null>(null);
  const [filtro, setFiltro] = useState('');
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const restantes = Math.max(0, sorteio.total_cotas - bilhetes.length);
  const podeRegistrar = sorteio.status === 'ativo' && cotasRestantes({ ...sorteio, cotas_vendidas: bilhetes.length }) > 0;

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('listar_bilhetes_sorteio', { p_sorteio_id: sorteio.id });
    if (error) {
      notificarErro(
        'Não foi possível carregar os bilhetes',
        error.code === 'PGRST202' ? 'Rode a migração 034_bilhetes_sorteio.sql no Supabase.' : 'Tente novamente.'
      );
      setBilhetes([]);
    } else {
      setBilhetes((data || []) as BilheteDiretoria[]);
    }
    setCarregando(false);
  }, [supabase, sorteio.id, notificarErro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function recarregar() {
    setCarregando(true);
    void carregar();
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setErroForm(null);
    const validacao = validarRegistroBilhetes({ email, quantidade, restantes });
    if (!validacao.ok) {
      setErroForm(validacao.erro);
      return;
    }
    setRegistrando(true);
    const { data, error } = await supabase.rpc('registrar_bilhetes_sorteio', {
      p_sorteio_id: sorteio.id,
      p_email: validacao.email,
      p_quantidade: validacao.quantidade,
      p_observacao: observacao.trim() || null,
    });
    setRegistrando(false);

    const resposta = data as { sucesso?: boolean; erro?: string; numeros?: number[]; usuario_nome?: string; restantes?: number } | null;
    if (error || !resposta?.sucesso) {
      const msg =
        resposta?.erro === 'cotas_insuficientes' && typeof resposta.restantes === 'number'
          ? `Só restam ${resposta.restantes} cotas.`
          : traduzirErroBilhete(resposta?.erro);
      setErroForm(msg);
      return;
    }

    setUltimos({ nome: resposta.usuario_nome || validacao.email, numeros: resposta.numeros || [] });
    sucesso('Bilhetes registrados', `${validacao.quantidade} bilhete(s) na conta de ${resposta.usuario_nome || validacao.email}.`);
    setEmail('');
    setQuantidade('1');
    setObservacao('');
    await carregar();
    aoAlterar();
  }

  async function cancelar(b: BilheteDiretoria) {
    if (!window.confirm(`Cancelar o bilhete ${formatarNumeroBilhete(b.numero, sorteio.total_cotas)} de ${b.usuario_nome || b.usuario_email}?`)) return;
    setCancelandoId(b.id);
    const { data, error } = await supabase.rpc('cancelar_bilhete_sorteio', { p_bilhete_id: b.id });
    setCancelandoId(null);
    const resposta = data as { sucesso?: boolean; erro?: string } | null;
    if (error || !resposta?.sucesso) {
      notificarErro('Não foi possível cancelar', traduzirErroBilhete(resposta?.erro));
      return;
    }
    sucesso('Bilhete cancelado');
    await carregar();
    aoAlterar();
  }

  const termo = filtro.trim().toLowerCase();
  const filtrados = termo
    ? bilhetes.filter(
        (b) =>
          b.usuario_email?.toLowerCase().includes(termo) ||
          b.usuario_nome?.toLowerCase().includes(termo) ||
          String(b.numero) === termo.replace(/^0+/, '')
      )
    : bilhetes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-3 rounded-xl bg-fundo-elevado/60 border border-borda-sutil">
          <p className="text-2xl font-black text-texto-principal">{bilhetes.length}</p>
          <p className="text-[11px] font-bold uppercase text-texto-secundario">Emitidos</p>
        </div>
        <div className="p-3 rounded-xl bg-fundo-elevado/60 border border-borda-sutil">
          <p className="text-2xl font-black text-texto-principal">{restantes}</p>
          <p className="text-[11px] font-bold uppercase text-texto-secundario">Restantes</p>
        </div>
        <div className="p-3 rounded-xl bg-fundo-elevado/60 border border-borda-sutil">
          <p className="text-2xl font-black text-texto-principal">{new Set(bilhetes.map((b) => b.usuario_email)).size}</p>
          <p className="text-[11px] font-bold uppercase text-texto-secundario">Participantes</p>
        </div>
      </div>

      {podeRegistrar ? (
        <form onSubmit={registrar} className="space-y-3 p-4 rounded-2xl border border-borda-media">
          <p className="text-sm font-bold text-texto-principal">Registrar bilhetes (depois de conferir o Pix)</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <CampoTexto
              rotulo="E-mail da conta do participante"
              type="email"
              icone={<Mail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.com"
              maxLength={254}
              autoComplete="off"
            />
            <CampoTexto
              rotulo="Cotas"
              type="number"
              min={1}
              max={Math.min(100, restantes)}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
          <CampoTexto
            rotulo="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: Pix de 28/11 às 14h"
            maxLength={200}
          />
          {erroForm && <p className="text-sm font-semibold text-red-500">{erroForm}</p>}
          <div className="flex justify-end">
            <Botao type="submit" carregando={registrando} icone={<Ticket size={16} />}>
              Registrar bilhetes
            </Botao>
          </div>
          <p className="text-xs text-texto-terciario">
            Os números são sorteados entre os livres e aparecem na hora em &quot;Meus bilhetes&quot; da conta do participante.
          </p>
        </form>
      ) : (
        <p className="p-4 rounded-2xl bg-fundo-elevado/60 border border-borda-sutil text-sm text-texto-secundario">
          {sorteio.status !== 'ativo'
            ? 'Bilhetes só podem ser registrados com o sorteio em "Vendas abertas".'
            : 'Todas as cotas já foram emitidas.'}
        </p>
      )}

      {ultimos && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-sm font-bold text-texto-principal mb-2">Números de {ultimos.nome}:</p>
          <div className="flex flex-wrap gap-1.5">
            {ultimos.numeros.map((n) => (
              <span key={n} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 font-mono font-bold text-sm text-texto-principal">
                {formatarNumeroBilhete(n, sorteio.total_cotas)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-bold text-texto-principal">Bilhetes emitidos</p>
          <button type="button" onClick={recarregar} className="text-xs font-bold text-texto-secundario hover:text-texto-principal inline-flex items-center gap-1 cursor-pointer">
            <RotateCcw size={13} /> Atualizar
          </button>
        </div>
        {bilhetes.length > 0 && (
          <CampoTexto
            icone={<Search size={16} />}
            placeholder="Buscar por e-mail, nome ou número"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        )}
        <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-borda-sutil rounded-xl border border-borda-sutil">
          {carregando ? (
            <p className="p-4 text-sm text-texto-secundario">Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p className="p-4 text-sm text-texto-secundario">{bilhetes.length === 0 ? 'Nenhum bilhete emitido ainda.' : 'Nada encontrado.'}</p>
          ) : (
            filtrados.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3">
                <span className="px-2.5 py-1 rounded-lg bg-fundo-elevado font-mono font-black text-sm text-texto-principal shrink-0">
                  {formatarNumeroBilhete(b.numero, sorteio.total_cotas)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-texto-principal truncate">{b.usuario_nome || 'Sem nome'}</p>
                  <p className="text-xs text-texto-secundario truncate">
                    {b.usuario_email} · {formatarDataHora(b.criado_em)}
                    {b.observacao ? ` · ${b.observacao}` : ''}
                  </p>
                </div>
                {sorteio.status !== 'encerrado' && (
                  <button
                    type="button"
                    onClick={() => cancelar(b)}
                    disabled={cancelandoId === b.id}
                    aria-label={`Cancelar bilhete ${b.numero}`}
                    className="p-2 rounded-lg text-texto-terciario hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
