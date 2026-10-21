'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Ticket,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Gift,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  Share2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import Cartao from '@/componentes/ui/Cartao';
import Modal from '@/componentes/ui/Modal';
import BarraNavegacaoMobile from '@/componentes/layout/BarraNavegacaoMobile';
import { formatarMoeda } from '@/lib/utilitarios';

interface Sorteio {
  id: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  premioPrincipal: string;
  premiosSecundarios: string[];
  valorCota: number;
  dataSorteio: string;
  status: 'ativo' | 'em_breve' | 'encerrado';
  totalCotas: number;
  cotasVendidas: number;
  ganhador?: {
    nome: string;
    bilhete: string;
    data: string;
    cidade: string;
  };
  destaque?: boolean;
}

const SORTEIOS_MOCK: Sorteio[] = [
  {
    id: 'sorteio-pix-kit-2026',
    titulo: 'Mega Ação Entre Amigos 2026',
    subtitulo: 'R$ 1.000 no Pix + Kit Oficial Cinética Completo',
    descricao:
      'Participe da maior ação da Atlética Cinética! Toda a arrecadação é revertida para os treinos esportivos dos Jogos Universitários e recepção dos calouros.',
    premioPrincipal: 'R$ 1.000,00 via Pix na conta do ganhador',
    premiosSecundarios: [
      '1x Camisa Oficial Atlética Cinética 2026 (tamanho à escolha)',
      '1x Tirante Premium + Copo Térmico Gravado a Laser',
      '2x Ingressos VIP para a Cervejada Oficial de Calouros',
    ],
    valorCota: 10,
    dataSorteio: '2026-11-28T20:00:00Z',
    status: 'ativo',
    totalCotas: 500,
    cotasVendidas: 382,
    destaque: true,
  },
  {
    id: 'passaporte-temporada-vip',
    titulo: 'Passaporte VIP Temporada Universitária',
    subtitulo: 'Acesso VIP + Open Bar a todos os eventos do semestre',
    descricao:
      'Curta todos os eventos acadêmicos, calouradas e comemorações da Cinética com acesso livre e credencial especial.',
    premioPrincipal: '02 Passaportes VIP para todos os eventos oficiais',
    premiosSecundarios: [
      'Kit Festa com 2 Copos da Cinética + 2 Tirantes',
      'R$ 300,00 em consumação exclusiva nos bares dos eventos',
    ],
    valorCota: 15,
    dataSorteio: '2026-12-15T19:00:00Z',
    status: 'ativo',
    totalCotas: 300,
    cotasVendidas: 140,
    destaque: false,
  },
  {
    id: 'rifa-solidaria-fisioterapia',
    titulo: 'Ação Solidária Fisioterapia em Movimento',
    subtitulo: 'Arrecadação beneficente + R$ 500 no Pix',
    descricao:
      'Edição beneficente realizada em prol de materiais de fisioterapia comunitária e projetos sociais da atlética.',
    premioPrincipal: 'R$ 500,00 no Pix + Kit Fisioterapia Cinética',
    premiosSecundarios: ['Conjunto de moletons Cinética Fisio'],
    valorCota: 5,
    dataSorteio: '2026-09-20T20:00:00Z',
    status: 'encerrado',
    totalCotas: 400,
    cotasVendidas: 400,
    ganhador: {
      nome: 'Mariana S. Albuquerque',
      bilhete: '#0247',
      data: '20/09/2026',
      cidade: 'Palmas - TO',
    },
    destaque: false,
  },
];

export default function PaginaSorteios() {
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'encerrados'>('todos');
  const [sorteioSelecionado, setSorteioSelecionado] = useState<Sorteio | null>(null);
  const [qtdCotas, setQtdCotas] = useState(1);
  const [chaveCopiada, setChaveCopiada] = useState(false);
  const [modalRegulamento, setModalRegulamento] = useState(false);

  const chavePixOficial = 'atletica.cinetica@fisioterapia.com.br';

  const sorteiosFiltrados = SORTEIOS_MOCK.filter((s) => {
    if (filtro === 'ativos') return s.status === 'ativo';
    if (filtro === 'encerrados') return s.status === 'encerrado';
    return true;
  });

  function copiarChavePix() {
    navigator.clipboard.writeText(chavePixOficial);
    setChaveCopiada(true);
    setTimeout(() => setChaveCopiada(false), 3000);
  }

  return (
    <>
      <BarraNavegacaoMobile />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <h1 className="text-2xl sm:text-3xl font-black font-titulo mb-2 text-slate-900">
          Sorteios & <span className="gradiente-texto">Rifas</span>
        </h1>
        <p className="text-slate-600 mb-8">
          Participe das ações beneficentes e rifas oficiais da Atlética Cinética
        </p>

        {/* Segmented Filter Control */}
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-md flex items-center justify-between gap-1 sm:gap-2 mb-8 max-w-md mx-auto sm:mx-0">
            <button
              onClick={() => setFiltro('todos')}
              className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center min-h-[38px] ${
                filtro === 'todos'
                  ? 'bg-gradient-to-r from-[#c59941] to-[#9a7228] text-[#0e1422] shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Todos ({SORTEIOS_MOCK.length})
            </button>
            <button
              onClick={() => setFiltro('ativos')}
              className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center min-h-[38px] ${
                filtro === 'ativos'
                  ? 'bg-gradient-to-r from-[#c59941] to-[#9a7228] text-[#0e1422] shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Em Andamento
            </button>
            <button
              onClick={() => setFiltro('encerrados')}
              className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center min-h-[38px] ${
                filtro === 'encerrados'
                  ? 'bg-gradient-to-r from-[#c59941] to-[#9a7228] text-[#0e1422] shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Encerrados
            </button>
          </div>

          {/* Sorteios List */}
          <div className="space-y-6">
            {sorteiosFiltrados.map((sorteio) => {
              const porcentagem = Math.round((sorteio.cotasVendidas / sorteio.totalCotas) * 100);
              const ehAtivo = sorteio.status === 'ativo';

              return (
                <div
                  key={sorteio.id}
                  className={`bg-white rounded-3xl border transition-all duration-300 p-5 sm:p-8 shadow-sm hover:shadow-md ${
                    sorteio.destaque
                      ? 'border-[#c59941] ring-2 ring-[#c59941]/20'
                      : 'border-slate-200/90'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
                    {/* Left: Info & Prizes */}
                    <div className="space-y-4 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {sorteio.destaque && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#c59941] text-[#0e1422] shadow-sm">
                            ★ Principal da Temporada
                          </span>
                        )}

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            ehAtivo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {ehAtivo ? 'Sorteio Ativo' : 'Encerrado & Apurado'}
                        </span>

                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Calendar size={13} className="text-[#c59941]" />
                          Apuração em: {new Date(sorteio.dataSorteio).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-xl sm:text-2xl font-black font-titulo text-slate-900">
                          {sorteio.titulo}
                        </h2>
                        <p className="text-sm sm:text-base font-bold text-[#c59941] mt-0.5">
                          {sorteio.subtitulo}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed max-w-3xl">
                          {sorteio.descricao}
                        </p>
                      </div>

                      {/* Premios Showcase */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                          <Gift size={15} className="text-[#c59941]" />
                          <span>Premiação Oficial:</span>
                        </div>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                          <span className="text-emerald-600">🏆 1º Prêmio:</span>
                          <span>{sorteio.premioPrincipal}</span>
                        </p>
                        {sorteio.premiosSecundarios.map((premio, idx) => (
                          <p key={idx} className="text-xs text-slate-600 flex items-center gap-2">
                            <span className="text-[#c59941] font-bold">🎁 {idx + 2}º Prêmio:</span>
                            <span>{premio}</span>
                          </p>
                        ))}
                      </div>

                      {/* Ganhador (se encerrado) */}
                      {sorteio.ganhador && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Trophy size={16} className="text-amber-600 shrink-0" />
                            <span className="text-amber-900">
                              Ganhador(a): <strong>{sorteio.ganhador.nome}</strong> ({sorteio.ganhador.cidade})
                            </span>
                          </div>
                          <span className="font-mono font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                            Bilhete Premiado: {sorteio.ganhador.bilhete}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Progress & Action */}
                    <div className="lg:w-80 p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Valor por Bilhete / Cota
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-[#c59941]">
                            {formatarMoeda(sorteio.valorCota)}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">/ bilhete</span>
                        </div>
                      </div>

                      {/* Barra de Progresso de Bilhetes */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600">Disponibilidade</span>
                          <span className="text-slate-900 font-mono">{porcentagem}% vendido</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#c59941] to-[#9a7228] transition-all duration-500 rounded-full"
                            style={{ width: `${porcentagem}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{sorteio.cotasVendidas} adquiridos</span>
                          <span>{sorteio.totalCotas - sorteio.cotasVendidas} restantes</span>
                        </div>
                      </div>

                      {/* Botão de Ação */}
                      {ehAtivo ? (
                        <div className="space-y-2">
                          <Botao
                            variante="festiva"
                            larguraTotal
                            tamanho="lg"
                            icone={<Ticket size={18} />}
                            onClick={() => {
                              setSorteioSelecionado(sorteio);
                              setQtdCotas(1);
                            }}
                          >
                            Participar Agora
                          </Botao>
                          <button
                            onClick={() => setModalRegulamento(true)}
                            className="w-full text-center text-xs text-slate-500 hover:text-slate-900 underline transition-colors"
                          >
                            Ver Regulamento & Regras
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled
                          className="w-full py-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs uppercase cursor-not-allowed"
                        >
                          Sorteio Finalizado
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dúvidas e Regulamento Box */}
          <div className="mt-12 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#c59941]/10 text-[#c59941] flex items-center justify-center shrink-0">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold font-titulo text-slate-900">
                  Como funcionam os sorteios da Cinética?
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Transparência, lisura e apoio direto aos projetos acadêmicos e esportivos do curso de Fisioterapia.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#c59941] text-[#0e1422] text-[10px] font-black flex items-center justify-center">1</span>
                  Escolha suas Cotas
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Defina quantos bilhetes deseja adquirir. Quanto mais cotas, maiores são suas chances de ganhar.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#c59941] text-[#0e1422] text-[10px] font-black flex items-center justify-center">2</span>
                  Pagamento via Pix
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Faça o pagamento direto para a chave Pix oficial da Atlética Cinética e envie o comprovante para a diretoria.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#c59941] text-[#0e1422] text-[10px] font-black flex items-center justify-center">3</span>
                  Apuração Ao Vivo
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  O resultado é vinculado à extração da Loteria Federal ou live oficial no Instagram com total transparência.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Participação / Pagamento do Sorteio */}
        <Modal
          aberto={!!sorteioSelecionado}
          aoFechar={() => setSorteioSelecionado(null)}
          tamanho="md"
        >
          {sorteioSelecionado && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#c59941]">
                  Atlética Cinética • Ação Oficial
                </span>
                <h3 className="text-lg sm:text-xl font-bold font-titulo text-slate-900 mt-0.5">
                  {sorteioSelecionado.titulo}
                </h3>
              </div>

              {/* Quantidade de Cotas Seletor */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Selecione a quantidade de cotas:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 10].map((qtd) => (
                    <button
                      key={qtd}
                      onClick={() => setQtdCotas(qtd)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        qtdCotas === qtd
                          ? 'bg-[#c59941] text-[#0e1422] border-[#c59941] font-black shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {qtd} {qtd === 1 ? 'Cota' : 'Cotas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo do Valor */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">Valor Total a Pagar:</span>
                  <p className="text-xl font-black text-[#c59941]">
                    {formatarMoeda(sorteioSelecionado.valorCota * qtdCotas)}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {qtdCotas} {qtdCotas === 1 ? 'bilhete' : 'bilhetes'}
                </span>
              </div>

              {/* Chave Pix da Atlética */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Chave Pix Oficial da Atlética Cinética:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={chavePixOficial}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 select-all"
                  />
                  <Botao
                    variante={chaveCopiada ? 'sucesso' : 'primario'}
                    tamanho="sm"
                    onClick={copiarChavePix}
                    icone={chaveCopiada ? <Check size={14} /> : <Copy size={14} />}
                  >
                    {chaveCopiada ? 'Copiado!' : 'Copiar'}
                  </Botao>
                </div>
              </div>

              {/* Instrução WhatsApp */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle size={15} />
                  Envio do Comprovante:
                </p>
                <p>
                  Após a transferência, envie o comprovante Pix para a diretoria via WhatsApp para validação e recebimento dos seus números da sorte!
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href={`https://wa.me/5563999999999?text=${encodeURIComponent(
                    `Olá! Gostaria de garantir ${qtdCotas} cota(s) no sorteio "${sorteioSelecionado.titulo}" da Atlética Cinética.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Botao variante="festiva" larguraTotal tamanho="lg" icone={<ExternalLink size={16} />}>
                    Confirmar no WhatsApp
                  </Botao>
                </a>
                <Botao variante="contorno" tamanho="lg" onClick={() => setSorteioSelecionado(null)}>
                  Fechar
                </Botao>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal de Regulamento */}
        <Modal
          aberto={modalRegulamento}
          aoFechar={() => setModalRegulamento(false)}
          tamanho="md"
        >
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold font-titulo text-slate-900">
                Regulamento dos Sorteios & Rifas
              </h3>
              <p className="text-xs text-slate-500">Atlética Cinética (A.A.A.F.A. Fisioterapia)</p>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-96 overflow-y-auto pr-1">
              <p>
                <strong>1. Organização:</strong> Todos os sorteios promovidos nesta página são de responsabilidade exclusiva da Diretoria da Atlética Cinética (A.A.A.F.A. Fisioterapia).
              </p>
              <p>
                <strong>2. Destinação dos Recursos:</strong> Os valores arrecadados são destinados integralmente para a compra de materiais desportivos, taxas de participação em jogos universitários e acolhimento dos estudantes do curso de Fisioterapia.
              </p>
              <p>
                <strong>3. Forma de Apuração:</strong> A apuração ocorre pontualmente na data estipulada com base na extração oficial da Loteria Federal ou por meio de sorteador eletrônico transmitido em live ao vivo no Instagram oficial @atleticacinetica.
              </p>
              <p>
                <strong>4. Entrega dos Prêmios:</strong> O prêmio em dinheiro é depositado via Pix na conta bancária titular do ganhador em até 24 horas após o término da apuração. Prêmios físicos e kits oficiais podem ser retirados presencialmente no campus ou enviados via Correios.
              </p>
            </div>

            <div className="pt-2">
              <Botao variante="festiva" larguraTotal onClick={() => setModalRegulamento(false)}>
                Entendido
              </Botao>
            </div>
          </div>
        </Modal>
    </>
  );
}
