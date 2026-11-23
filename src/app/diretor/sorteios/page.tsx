'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Plus, Edit, Trash2, Trophy, Upload, AlertTriangle, Ticket } from 'lucide-react';
import GerenciarBilhetes from '@/componentes/sorteios/GerenciarBilhetes';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Modal from '@/componentes/ui/Modal';
import EstadoVazio from '@/componentes/ui/EstadoVazio';
import Carregando from '@/componentes/ui/Carregando';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { useNotificacao } from '@/componentes/ui/Notificacao';
import { obterIdAtleticaCinetica } from '@/lib/atleticaCinetica';
import { formatarDataHora, formatarMoeda } from '@/lib/utilitarios';
import {
  STATUS_SORTEIO_ROTULO,
  calcularProgressoCotas,
  ehErroTabelaSorteiosAusente,
  ordenarSorteios,
  validarFormularioSorteio,
  type FormularioSorteio,
} from '@/lib/sorteios';
import type { Sorteio, StatusSorteio } from '@/tipos';
import { traduzirErroBanco } from '@/lib/errosBanco';

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const FORM_VAZIO: FormularioSorteio = {
  titulo: '',
  subtitulo: '',
  descricao: '',
  premio_principal: '',
  premios_secundarios: '',
  valor_cota: '',
  total_cotas: '',
  cotas_vendidas: '0',
  data_sorteio: '',
  status: 'rascunho',
  destaque: false,
  imagem_url: '',
  regulamento: '',
  forma_apuracao: '',
  ganhador_nome: '',
  ganhador_bilhete: '',
  ganhador_cidade: '',
};

function paraDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function sorteioParaFormulario(s: Sorteio): FormularioSorteio {
  return {
    titulo: s.titulo,
    subtitulo: s.subtitulo || '',
    descricao: s.descricao || '',
    premio_principal: s.premio_principal,
    premios_secundarios: (s.premios_secundarios || []).join('\n'),
    valor_cota: String(s.valor_cota),
    total_cotas: String(s.total_cotas),
    cotas_vendidas: String(s.cotas_vendidas),
    data_sorteio: paraDatetimeLocal(s.data_sorteio),
    status: s.status,
    destaque: s.destaque,
    imagem_url: s.imagem_url || '',
    regulamento: s.regulamento || '',
    forma_apuracao: s.forma_apuracao || '',
    ganhador_nome: s.ganhador_nome || '',
    ganhador_bilhete: s.ganhador_bilhete || '',
    ganhador_cidade: s.ganhador_cidade || '',
  };
}

export default function PaginaSorteiosDiretor() {
  const { perfil, carregando: carregandoAuth } = usarAutenticacao();
  const { sucesso, erro: notificarErro } = useNotificacao();
  const supabase = criarClienteNavegador();

  const [atleticaId, setAtleticaId] = useState<string | null>(null);
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormularioSorteio>(FORM_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<Sorteio | null>(null);
  const [bilhetesDe, setBilhetesDe] = useState<Sorteio | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const idAtl = await obterIdAtleticaCinetica(supabase);
    setAtleticaId(idAtl);

    if (!idAtl) {
      setSorteios([]);
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase
      .from('sorteios')
      .select('*')
      .eq('atletica_id', idAtl)
      .order('data_sorteio', { ascending: false });

    if (error && ehErroTabelaSorteiosAusente(error)) {
      notificarErro(
        'Módulo de sorteios não instalado',
        'A tabela "sorteios" não existe no banco. Rode supabase/migracoes/033_hardening_seguranca_e_sorteios.sql no SQL Editor do Supabase.'
      );
    } else if (error) {
      notificarErro('Erro ao carregar sorteios', 'Tente novamente em instantes.');
    }
    setSorteios(ordenarSorteios(((data || []) as Sorteio[]).map((s) => ({ ...s, valor_cota: Number(s.valor_cota) }))));
    setCarregando(false);
  }, [perfil, supabase, notificarErro]);

  useEffect(() => {
    if (!carregandoAuth) carregar();
  }, [carregandoAuth, carregar]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErros({});
    setModalAberto(true);
  }

  function abrirEdicao(s: Sorteio) {
    setEditandoId(s.id);
    setForm(sorteioParaFormulario(s));
    setErros({});
    setModalAberto(true);
  }

  function atualizar<K extends keyof FormularioSorteio>(campo: K, valor: FormularioSorteio[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviarImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      notificarErro('Formato inválido', 'Envie JPG, PNG, WEBP ou GIF.');
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      notificarErro('Arquivo muito grande', 'O tamanho máximo é 5MB.');
      return;
    }
    setEnviandoImagem(true);
    try {
      const ext = arquivo.type.split('/')[1].replace('jpeg', 'jpg');
      const nome = `sorteio_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { data, error } = await supabase.storage.from('imagens').upload(nome, arquivo, {
        cacheControl: '3600',
        upsert: false,
        contentType: arquivo.type,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('imagens').getPublicUrl(data.path);
      atualizar('imagem_url', pub.publicUrl);
    } catch {
      notificarErro('Falha no upload', 'Não foi possível enviar a imagem.');
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function salvar() {
    if (!atleticaId) return;
    const resultado = validarFormularioSorteio(form);
    if (!resultado.ok) {
      setErros(resultado.erros);
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        const anterior = sorteios.find((s) => s.id === editandoId);
        // cotas_vendidas é mantida pelo banco a partir dos bilhetes emitidos
        const { cotas_vendidas: _ignorado, ...semCotas } = resultado.dados;
        void _ignorado;
        const dados = {
          ...semCotas,
          apurado_em: resultado.dados.status === 'encerrado' ? anterior?.apurado_em || resultado.dados.apurado_em : null,
        };
        const { error } = await supabase.from('sorteios').update(dados).eq('id', editandoId);
        if (error) throw error;
        sucesso('Sorteio atualizado', 'As alterações foram salvas.');
      } else {
        const { error } = await supabase
          .from('sorteios')
          .insert({ ...resultado.dados, cotas_vendidas: 0, atletica_id: atleticaId, criado_por: perfil?.id || null });
        if (error) throw error;
        sucesso('Sorteio criado', resultado.dados.status === 'rascunho' ? 'Salvo como rascunho.' : 'Já está visível na vitrine.');
      }
      setModalAberto(false);
      await carregar();
    } catch (err) {
      const msg = traduzirErroBanco(err, 'salvar o sorteio');
      notificarErro('Não foi possível salvar', msg);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    const { error } = await supabase.from('sorteios').delete().eq('id', paraExcluir.id);
    if (error) {
      notificarErro('Erro ao excluir', error.message);
    } else {
      sucesso('Sorteio excluído');
      setSorteios((l) => l.filter((s) => s.id !== paraExcluir.id));
    }
    setParaExcluir(null);
  }

  if (carregandoAuth || carregando) {
    return <div className="py-20 text-center"><Carregando tamanho="lg" texto="Carregando sorteios..." /></div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-titulo">
            Sorteios & <span className="gradiente-texto">Rifas</span>
          </h1>
          <p className="text-texto-secundario mt-1">{sorteios.length} sorteio(s) cadastrado(s)</p>
        </div>
        <Botao icone={<Plus size={16} />} onClick={abrirNovo} disabled={!atleticaId}>
          Novo sorteio
        </Botao>
      </div>

      {!atleticaId ? (
        <EstadoVazio titulo="Atlética Cinética não cadastrada" descricao="Cadastre a atlética na aba Atlética Cinética para criar sorteios." icone={<AlertTriangle className="w-7 h-7" />} />
      ) : sorteios.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum sorteio ainda"
          descricao="Crie o primeiro sorteio. Ele aparecerá em /sorteios quando estiver com status 'Em breve' ou 'Vendas abertas'."
          icone={<Gift className="w-7 h-7" />}
          acao={<Botao icone={<Plus size={16} />} onClick={abrirNovo}>Criar sorteio</Botao>}
        />
      ) : (
        <div className="space-y-4">
          {sorteios.map((s) => {
            const progresso = calcularProgressoCotas(s.cotas_vendidas, s.total_cotas);
            return (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {STATUS_SORTEIO_ROTULO[s.status]}
                      </span>
                      {s.destaque && <span className="text-[10px] font-black uppercase text-[#9a7228]">★ Destaque</span>}
                      <span className="text-xs text-slate-500">Apuração: {formatarDataHora(s.data_sorteio)}</span>
                    </div>
                    <h3 className="font-black text-lg text-slate-900 truncate">{s.titulo}</h3>
                    <p className="text-xs text-slate-500 truncate">🏆 {s.premio_principal}</p>
                    {s.status === 'encerrado' && s.ganhador_nome && (
                      <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <Trophy size={12} /> {s.ganhador_nome} {s.ganhador_bilhete ? `• ${s.ganhador_bilhete}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="md:w-72 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{s.cotas_vendidas}/{s.total_cotas} cotas</span>
                      <span>{formatarMoeda(s.cotas_vendidas * s.valor_cota)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#c59941]" style={{ width: `${progresso}%` }} />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Botao tamanho="sm" icone={<Ticket size={13} />} onClick={() => setBilhetesDe(s)}>Bilhetes</Botao>
                      <div className="flex-1" />
                      <Botao tamanho="sm" variante="contorno" icone={<Edit size={13} />} onClick={() => abrirEdicao(s)}>Editar</Botao>
                      <Botao tamanho="sm" variante="perigo" icone={<Trash2 size={13} />} onClick={() => setParaExcluir(s)} aria-label="Excluir sorteio" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal aberto={modalAberto} aoFechar={() => !salvando && setModalAberto(false)} titulo={editandoId ? 'Editar sorteio' : 'Novo sorteio'} tamanho="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <CampoTexto rotulo="Título" obrigatorio value={form.titulo} onChange={(e) => atualizar('titulo', e.target.value)} erro={erros.titulo} maxLength={140} />
          <CampoTexto rotulo="Subtítulo" value={form.subtitulo} onChange={(e) => atualizar('subtitulo', e.target.value)} maxLength={200} />
          <CampoTexto multilinha rotulo="Descrição" value={form.descricao} onChange={(e) => atualizar('descricao', e.target.value)} erro={erros.descricao} rows={3} />
          <CampoTexto rotulo="Prêmio principal" obrigatorio value={form.premio_principal} onChange={(e) => atualizar('premio_principal', e.target.value)} erro={erros.premio_principal} maxLength={300} />
          <CampoTexto multilinha rotulo="Prêmios secundários (um por linha)" value={form.premios_secundarios} onChange={(e) => atualizar('premios_secundarios', e.target.value)} rows={3} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoTexto rotulo="Valor da cota (R$)" obrigatorio inputMode="decimal" value={form.valor_cota} onChange={(e) => atualizar('valor_cota', e.target.value)} erro={erros.valor_cota} />
            <CampoTexto rotulo="Total de cotas" obrigatorio type="number" min={1} value={form.total_cotas} onChange={(e) => atualizar('total_cotas', e.target.value)} erro={erros.total_cotas} dica={editandoId ? `${form.cotas_vendidas} já emitida(s) em bilhetes.` : 'As cotas vendidas são contadas pelos bilhetes registrados.'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoTexto rotulo="Data da apuração" obrigatorio type="datetime-local" value={form.data_sorteio} onChange={(e) => atualizar('data_sorteio', e.target.value)} erro={erros.data_sorteio} />
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => atualizar('status', e.target.value as StatusSorteio)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[44px]"
              >
                {(Object.keys(STATUS_SORTEIO_ROTULO) as StatusSorteio[]).map((st) => (
                  <option key={st} value={st}>{STATUS_SORTEIO_ROTULO[st]}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.destaque} onChange={(e) => atualizar('destaque', e.target.checked)} />
            Destacar na vitrine
          </label>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Imagem (opcional)</label>
            <div className="flex items-center gap-3">
              {form.imagem_url && <img src={form.imagem_url} alt="" className="w-16 h-16 rounded-xl object-cover border" />}
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-50">
                <Upload size={14} /> {enviandoImagem ? 'Enviando...' : 'Enviar imagem'}
                <input type="file" accept={TIPOS_IMAGEM.join(',')} className="hidden" onChange={(e) => enviarImagem(e.target.files?.[0])} disabled={enviandoImagem} />
              </label>
              {form.imagem_url && (
                <button className="text-xs text-red-600 underline" onClick={() => atualizar('imagem_url', '')}>Remover</button>
              )}
            </div>
            {erros.imagem_url && <p className="text-xs text-red-600">{erros.imagem_url}</p>}
          </div>

          <CampoTexto rotulo="Forma de apuração" placeholder="Ex.: Loteria Federal de 28/11 ou live no Instagram" value={form.forma_apuracao} onChange={(e) => atualizar('forma_apuracao', e.target.value)} maxLength={300} />
          <CampoTexto multilinha rotulo="Regulamento" value={form.regulamento} onChange={(e) => atualizar('regulamento', e.target.value)} erro={erros.regulamento} rows={5} />

          {(form.status === 'encerrado' || form.ganhador_nome) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <CampoTexto rotulo="Ganhador(a)" value={form.ganhador_nome} onChange={(e) => atualizar('ganhador_nome', e.target.value)} erro={erros.ganhador_nome} maxLength={120} />
              <CampoTexto rotulo="Bilhete" value={form.ganhador_bilhete} onChange={(e) => atualizar('ganhador_bilhete', e.target.value)} maxLength={40} />
              <CampoTexto rotulo="Cidade" value={form.ganhador_cidade} onChange={(e) => atualizar('ganhador_cidade', e.target.value)} maxLength={120} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Botao variante="contorno" onClick={() => setModalAberto(false)} disabled={salvando}>Cancelar</Botao>
            <Botao onClick={salvar} carregando={salvando}>{editandoId ? 'Salvar alterações' : 'Criar sorteio'}</Botao>
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!bilhetesDe}
        aoFechar={() => setBilhetesDe(null)}
        titulo="Bilhetes do sorteio"
        descricao={bilhetesDe?.titulo}
        tamanho="lg"
      >
        {bilhetesDe && <GerenciarBilhetes sorteio={bilhetesDe} aoAlterar={carregar} />}
      </Modal>

      <Modal aberto={!!paraExcluir} aoFechar={() => setParaExcluir(null)} titulo="Excluir sorteio" tamanho="sm">
        <p className="text-sm text-slate-600 mb-4">
          Tem certeza que deseja excluir <strong>{paraExcluir?.titulo}</strong>? Os bilhetes emitidos também serão apagados. Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={() => setParaExcluir(null)}>Cancelar</Botao>
          <Botao variante="perigo" icone={<Trash2 size={14} />} onClick={confirmarExclusao}>Excluir</Botao>
        </div>
      </Modal>
    </div>
  );
}
