'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usarCookies } from '@/contextos/ContextoCookies';
import Botao from '@/componentes/ui/Botao';
import {
  FileText,
  Shield,
  Cookie,
  Lock,
  CheckCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

export default function PaginaTermosEPrivacidade() {
  const [abaAtiva, setAbaAtiva] = useState<'termos' | 'privacidade' | 'cookies'>('termos');
  const { abrirBanner } = usarCookies();

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-800 pb-16">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 py-6 sm:py-10 mb-6 sm:mb-8 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl sm:text-4xl font-black font-titulo tracking-tight uppercase leading-tight text-slate-900">
            Termos & <span className="text-[#c59941]">Privacidade</span>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
            Sua confiança e segurança são fundamentais para o Cinética Ingressos. Aqui detalhamos as regras de uso da plataforma e como protegemos seus dados pessoais de acordo com a LGPD.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Navigation Tabs - 3 Column Segmented Control */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2 p-1 sm:p-1.5 bg-white border border-slate-200 rounded-xl sm:rounded-2xl mb-6 sm:mb-8 shadow-sm">
          <button
            type="button"
            onClick={() => setAbaAtiva('termos')}
            className={`py-2.5 sm:py-3 px-1 sm:px-4 rounded-lg sm:rounded-xl font-extrabold sm:font-black text-[11px] sm:text-xs uppercase tracking-normal sm:tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-1 sm:gap-2 touch-manipulation text-center ${
              abaAtiva === 'termos'
                ? 'bg-gradient-to-r from-[#c59941] to-[#9a7228] text-[#0e1422] shadow-md shadow-[#c59941]/25 font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText size={15} className="shrink-0" />
            <span className="whitespace-nowrap">
              <span className="sm:hidden">Termos</span>
              <span className="hidden sm:inline">Termos de Uso</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('privacidade')}
            className={`py-2.5 sm:py-3 px-1 sm:px-4 rounded-lg sm:rounded-xl font-extrabold sm:font-black text-[11px] sm:text-xs uppercase tracking-normal sm:tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-1 sm:gap-2 touch-manipulation text-center ${
              abaAtiva === 'privacidade'
                ? 'bg-[#0e1422] text-[#f4d68a] shadow-md shadow-[#0e1422]/20 font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Lock size={15} className="shrink-0" />
            <span className="whitespace-nowrap">
              <span className="sm:hidden">Privacidade</span>
              <span className="hidden sm:inline">Política de Privacidade</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('cookies')}
            className={`py-2.5 sm:py-3 px-1 sm:px-4 rounded-lg sm:rounded-xl font-extrabold sm:font-black text-[11px] sm:text-xs uppercase tracking-normal sm:tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-1 sm:gap-2 touch-manipulation text-center ${
              abaAtiva === 'cookies'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cookie size={15} className="shrink-0" />
            <span className="whitespace-nowrap">
              <span className="sm:hidden">Cookies</span>
              <span className="hidden sm:inline">Uso de Cookies</span>
            </span>
          </button>
        </div>

        {/* Content Box */}
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-8 space-y-5 sm:space-y-6 leading-relaxed text-slate-700 text-xs sm:text-sm shadow-sm">
          {/* TAB 1: TERMOS DE USO */}
          {abaAtiva === 'termos' && (
            <div className="space-y-5 sm:space-y-6 animar-entrar-baixo">
              <div className="border-b border-slate-200 pb-3 sm:pb-4">
                <h2 className="text-lg sm:text-xl font-bold font-titulo text-slate-900 uppercase flex items-center gap-2 leading-tight">
                  <FileText className="text-[#c59941] shrink-0" size={20} />
                  Termos Gerais de Uso da Plataforma
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Última atualização: Agosto de 2026</p>
              </div>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#c59941] shrink-0" />
                  1. Objeto e Aceitação
                </h3>
                <p>
                  O <strong>Cinética Ingressos</strong> é a plataforma oficial da Atlética Cinética (A.A.A.F.A. Fisioterapia) dedicada à intermediação de vendas e gestão de ingressos para festas universitárias, eventos esportivos e produtos oficiais. Ao acessar ou criar uma conta em nosso site, você concorda integralmente com estes Termos de Uso.
                </p>
              </section>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#c59941] shrink-0" />
                  2. Ingressos Digitais e QR Code
                </h3>
                <p>
                  Cada ingresso adquirido no Cinética Ingressos gera um <strong>QR Code único e criptografado</strong> vinculado à sua conta. Este QR Code é estritamente pessoal e indispensável para a validação na entrada do evento.
                </p>
                <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 text-xs text-slate-600">
                  <li>O QR Code é validado uma única vez na portaria. Tentativas de cópia ou duplicidade serão recusadas.</li>
                  <li>A responsabilidade pelo zelo das credenciais da conta e do ingresso é do comprador.</li>
                </ul>
              </section>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#c59941] shrink-0" />
                  3. Cancelamentos e Reembolsos
                </h3>
                <p>
                  Em atendimento ao Código de Defesa do Consumidor (Art. 49), o usuário poderá solicitar o cancelamento da compra em até <strong>7 (sete) dias corridos</strong> a contar da data de confirmação do pagamento, desde que a solicitação seja feita até 48 horas antes da realização do evento.
                </p>
              </section>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#c59941] shrink-0" />
                  4. Responsabilidades dos Organizadores
                </h3>
                <p>
                  A comissão organizadora é integralmente responsável pelo cumprimento da programação, infraestrutura, classificação etária e regras de entrada do evento.
                </p>
              </section>
            </div>
          )}

          {/* TAB 2: POLÍTICA DE PRIVACIDADE (LGPD) */}
          {abaAtiva === 'privacidade' && (
            <div className="space-y-5 sm:space-y-6 animar-entrar-baixo">
              <div className="border-b border-slate-200 pb-3 sm:pb-4">
                <h2 className="text-lg sm:text-xl font-bold font-titulo text-slate-900 uppercase flex items-center gap-2 leading-tight">
                  <Lock className="text-[#c59941] shrink-0" size={20} />
                  Política de Privacidade & Proteção de Dados
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</p>
              </div>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={16} className="text-[#c59941] shrink-0" />
                  1. Coleta de Dados Pessoais
                </h3>
                <p>
                  Para prestação dos nossos serviços de bilheteria e emissão de ingressos nominais, coletamos os seguintes dados básicos:
                </p>
                <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 text-xs text-slate-600">
                  <li><strong>Dados de Identificação:</strong> Nome completo, e-mail e número de telefone.</li>
                  <li><strong>Dados Transacionais:</strong> Histórico de compras, ingressos ativos e comprovantes.</li>
                  <li><strong>Dados Técnicos:</strong> Endereço IP e registros de logs para fins de segurança e prevenção a fraudes.</li>
                </ul>
              </section>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={16} className="text-[#c59941] shrink-0" />
                  2. Finalidade do Tratamento
                </h3>
                <p>
                  Seus dados são utilizados estritamente para:
                </p>
                <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 text-xs text-slate-600">
                  <li>Gerar seus ingressos e QR Codes com autenticidade garantida;</li>
                  <li>Permitir a validação segura na portaria do evento;</li>
                  <li>Enviar notificações de suporte e confirmações de compra.</li>
                </ul>
              </section>

              <section className="space-y-2 sm:space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={16} className="text-[#c59941] shrink-0" />
                  3. Direitos do Titular de Dados
                </h3>
                <p>
                  De acordo com a LGPD, você possui total controle sobre seus dados pessoais, podendo solicitar a qualquer momento a confirmação da existência de tratamento, correção de dados incompletos ou exclusão de sua conta.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: GERENCIAMENTO DE COOKIES */}
          {abaAtiva === 'cookies' && (
            <div className="space-y-5 sm:space-y-6 animar-entrar-baixo">
              <div className="border-b border-slate-200 pb-3 sm:pb-4">
                <h2 className="text-lg sm:text-xl font-bold font-titulo text-slate-900 uppercase flex items-center gap-2 leading-tight">
                  <Cookie className="text-[#c59941] shrink-0" size={20} />
                  Política e Preferências de Cookies
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Controle como utilizamos cookies para personalizar sua navegação</p>
              </div>

              <p>
                Cookies são pequenos arquivos armazenados em seu dispositivo que nos ajudam a manter sua sessão ativa, guardar suas preferências de navegação e garantir o correto funcionamento do Cinética Ingressos.
              </p>

              <div className="bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">Gerenciador de Preferências de Cookies</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Clique no botão abaixo para reabrir o banner e configurar quais categorias deseja autorizar.</p>
                  </div>
                  <Botao
                    variante="festiva"
                    tamanho="md"
                    onClick={abrirBanner}
                    icone={<Cookie size={16} />}
                    className="w-full sm:w-auto min-h-[44px] justify-center text-xs font-black uppercase"
                  >
                    Abrir Preferências
                  </Botao>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-emerald-600 text-xs uppercase mb-1">Cookies Essenciais</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Necessários para que você faça login, acesse "Meus Ingressos" e realize compras com segurança. Não podem ser desativados.
                  </p>
                </div>
                <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-[#c59941] text-xs uppercase mb-1">Cookies de Desempenho</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ajudam-nos a medir estatísticas anônimas de acesso para melhorar a velocidade da plataforma no seu celular.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Support Callout */}
        <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-[#0e1422] rounded-xl sm:rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <HelpCircle size={24} className="text-[#c59941] shrink-0" />
            <div>
              <h4 className="font-bold text-white text-sm">Possui dúvidas sobre nossa política?</h4>
              <p className="text-xs text-slate-300">Nossa equipe de suporte está à disposição para ajudar.</p>
            </div>
          </div>
          <Link href="/eventos" className="w-full sm:w-auto">
            <Botao variante="festiva" tamanho="sm" icone={<ArrowRight size={14} />} className="w-full sm:w-auto min-h-[44px] justify-center">
              Explorar Eventos
            </Botao>
          </Link>
        </div>
      </div>
    </div>
  );
}
