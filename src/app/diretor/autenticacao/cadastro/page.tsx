'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import { formatarTelefone, formatarCPF, validarCPF, avaliarSenha, formatarCidadeEstado } from '@/lib/utilitarios';
import IndicadorForcaSenha from '@/componentes/ui/IndicadorForcaSenha';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import {
  Ticket,
  Mail,
  Lock,
  User,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building2,
  Phone,
  Briefcase,
  MapPin,
  Check,
  Clock,
  QrCode,
  ChevronDown,
  Trophy,
  CreditCard,
  KeyRound,
} from 'lucide-react';

import CaptchaCloudflare from '@/componentes/ui/CaptchaCloudflare';
import { useRateLimitAuth } from '@/hooks/useRateLimitAuth';

export default function PaginaCadastroDiretor() {
  const { cadastrar } = usarAutenticacao();
  const [erro, setErro] = useState('');
  const { bloqueado, segundosRestantes, mensagemRateLimit, aplicarStatus } = useRateLimitAuth(() => {
    setErro('');
  });

  // Controle de etapas (1, 2 ou 3)
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);

  // Etapa 1: Dados Pessoais e de Contato
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');

  // Etapa 2: Dados da Atlética
  const [atleticaNome, setAtleticaNome] = useState('');
  const [atleticaSigla, setAtleticaSigla] = useState('');
  const [atleticaCidade, setAtleticaCidade] = useState('');
  const [atleticaEstado, setAtleticaEstado] = useState('TO');

  // Etapa 3: Autenticação
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // Estados de controle da página
  const [carregando, setCarregando] = useState(false);

  const supabase = criarClienteNavegador();

  // Validação de E-mail via Código (OTP)
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [tempoReenvio, setTempoReenvio] = useState(0);
  const [emailEnviado, setEmailEnviado] = useState('');

  useEffect(() => {
    if (tempoReenvio <= 0) return;
    const interval = setInterval(() => {
      setTempoReenvio((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [tempoReenvio]);

  async function enviarCodigoValidacao() {
    setErro('');
    if (!email || !email.includes('@')) {
      setErro('Informe um e-mail válido para receber o código.');
      return;
    }

    if (enviandoCodigo || (email === emailEnviado && tempoReenvio > 0)) return;

    setEnviandoCodigo(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            nome,
            role: 'diretor',
            telefone,
            cpf,
            cargo,
            atleticaNome,
            atleticaSigla,
            atleticaCidade: formatarCidadeEstado(atleticaCidade, atleticaEstado),
            atleticaEstado,
            atletica_nome: atleticaNome,
            atletica_sigla: atleticaSigla,
            atletica_cidade: formatarCidadeEstado(atleticaCidade, atleticaEstado),
            atletica_estado: atleticaEstado,
          },
        },
      });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit') || error.status === 429) {
          setErro(
            'Limite de envio de e-mails atingido (Supabase/SMTP). Aguarde alguns minutos ou certifique-se de que o Custom SMTP (Brevo) está ativado no Supabase.'
          );
        } else if (msg.includes('Error sending confirmation email') || msg.includes('confirmation email') || msg.includes('smtp') || msg.includes('SMTP')) {
          setErro(
            'Configuração de e-mail necessária: No painel do Supabase (Authentication -> Email Settings), altere o campo "Sender Email" (Remetente) para o mesmo e-mail validado na sua conta da Brevo.'
          );
        } else {
          setErro(msg);
        }
      } else {
        setCodigoEnviado(true);
        setEmailEnviado(email);
        setTempoReenvio(60);
      }
    } catch {
      setErro('Erro de conexão ao enviar o código de validação.');
    } finally {
      setEnviandoCodigo(false);
    }
  }

  async function validarCodigoOtp() {
    setErro('');
    if (codigo.length < 6) {
      setErro('Digite o código de 6 dígitos enviado para seu e-mail.');
      return;
    }

    setValidandoCodigo(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: codigo,
        type: 'email',
      });

      if (error) {
        setErro('Código de verificação inválido ou expirado.');
      } else {
        setEmailVerificado(true);
      }
    } catch {
      setErro('Erro de conexão ao validar o código.');
    } finally {
      setValidandoCodigo(false);
    }
  }

  function avancarEtapa1() {
    setErro('');
    if (!nome.trim()) {
      setErro('Por favor, informe seu nome completo.');
      return;
    }
    if (!cpf.trim()) {
      setErro('Por favor, informe seu CPF.');
      return;
    }
    if (!validarCPF(cpf)) {
      setErro('Por favor, informe um CPF válido.');
      return;
    }
    if (!telefone.trim()) {
      setErro('Por favor, informe um telefone de contato / WhatsApp.');
      return;
    }
    setEtapa(2);
  }

  function avancarEtapa2() {
    setErro('');
    if (!atleticaNome.trim()) {
      setErro('Por favor, informe o nome da Atlética ou Faculdade.');
      return;
    }
    setEtapa(3);
  }

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado) return;

    setErro('');

    if (!email.trim() || !email.includes('@')) {
      setErro('Por favor, informe o email de acesso.');
      return;
    }

    if (!emailVerificado) {
      setErro('Verifique seu e-mail antes de concluir o cadastro.');
      return;
    }

    const statusSenha = avaliarSenha(senha);
    if (!statusSenha.valida) {
      setErro('A senha deve conter no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial (!@#$...).');
      return;
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    setCarregando(true);

    const resultado = await cadastrar(
      email,
      senha,
      nome,
      'diretor',
      {
        telefone,
        cpf,
        cargo,
        atleticaNome,
        atleticaSigla,
        atleticaCidade: formatarCidadeEstado(atleticaCidade, atleticaEstado),
        atleticaEstado,
      },
      turnstileToken
    );

    if (resultado.erro) {
      if (resultado.rateLimitData?.bloqueado || resultado.bloqueado) {
        aplicarStatus(
          resultado.rateLimitData || {
            bloqueado: true,
            segundosRestantes: resultado.segundosRestantes,
            mensagem: resultado.erro,
          }
        );
        setErro('');
      } else {
        setErro(resultado.erro);
      }
      setCarregando(false);
    } else {
      // Encerra a sessão temporária de OTP e redireciona para a tela de login do diretor exibindo o modal
      await supabase.auth.signOut();
      window.location.href = '/autenticacao/entrar?pendente=1';
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#fafafa] relative overflow-hidden">
      {/* Elementos visuais de fundo */}
      <div className="absolute top-0 -right-40 w-96 h-96 bg-[#c59941]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-40 w-96 h-96 bg-[#121826]/5 rounded-full blur-3xl pointer-events-none" />

      {/* LADO ESQUERDO: Painel Informativo & Benefícios da Atlética (Desktop) */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 flex-col justify-between p-12 xl:p-16 relative z-10 border-r border-slate-200 bg-slate-50/70">
        <div>
          {/* Navegação Superior */}
          <Link
            href="/autenticacao/entrar"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider bg-white hover:bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm w-fit mb-12"
          >
            <ArrowLeft size={14} />
            Voltar ao login de diretor
          </Link>

          {/* Headline & Badges */}
          <div className="space-y-6">
            <h1 className="text-3xl xl:text-4xl font-black font-titulo text-slate-900 leading-tight tracking-tight">
              <span className="text-slate-500">Aumente as vendas de ingressos dos seus eventos com a</span>{' '}
              <span className="font-black italic tracking-tighter text-slate-900 font-titulo inline-flex items-center gap-0.5">
                Atlética <span className="text-[#c59941]">Cinética</span>
              </span>
            </h1>

            <p className="text-sm text-slate-600 font-normal leading-relaxed">
              Junte-se à maior atlética universitária. Gerencie vendas, lotes promocionais e entrada de público em um único lugar.
            </p>
          </div>

          {/* Apresentação de Recursos */}
          <div className="space-y-3.5 mt-8">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-[#c59941]/40 transition-all flex items-start gap-3.5 group">
              <div className="w-10 h-10 rounded-xl bg-[#c59941]/10 text-[#9a7228] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                <Trophy size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#9a7228] transition-colors">Perfil & Eventos da Atlética</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Página personalizada com os dados, história, contatos e todos os eventos da sua atlética reunidos em um só lugar.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-[#121826]/40 transition-all flex items-start gap-3.5 group">
              <div className="w-10 h-10 rounded-xl bg-[#121826]/10 text-[#121826] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                <Ticket size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-slate-950 transition-colors">Vendas & Lotes Automáticos</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Crie eventos em minutos, programe viradas de lote por quantidade ou horário e acompanhe o faturamento.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-500/40 transition-all flex items-start gap-3.5 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                <QrCode size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">Check-in por QR Code</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Validação instantânea de ingressos na portaria direto pelo celular da equipe da atlética, sem filas nem fraudes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo Dinâmico do Cadastro */}
        {(nome || atleticaNome) && (
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs space-y-2 mt-6">
            <span className="text-[10px] font-black uppercase text-[#9a7228] tracking-wider block">Resumo dos Dados</span>
            {nome && <p className="text-slate-600"><strong className="text-slate-900">{nome}</strong> {cargo ? `(${cargo})` : ''}</p>}
            {atleticaNome && <p className="text-slate-600"><strong className="text-slate-900">{atleticaNome}</strong> {atleticaSigla ? `[${atleticaSigla}]` : ''}</p>}
          </div>
        )}
      </div>

      {/* LADO DIREITO: Formulario Step Wizard */}
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center items-center p-3 sm:p-8 lg:p-12 relative z-10 w-full">
        {/* Botão de voltar visível apenas no mobile */}
        <div className="w-full max-w-xl lg:hidden mb-4 sm:mb-6">
          <Link
            href="/autenticacao/entrar"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider bg-white hover:bg-slate-50 px-3.5 py-2 rounded-full border border-slate-200 shadow-sm"
          >
            <ArrowLeft size={14} />
            Voltar ao login do diretor
          </Link>
        </div>

        <div className="w-full max-w-xl bg-white rounded-3xl p-4 sm:p-8 md:p-10 shadow-xl animar-entrar-baixo border border-slate-200/80">
          {/* Cabeçalho */}
          <div className="flex items-center gap-3.5 sm:gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-100">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#c59941] via-[#d4a84e] to-[#9a7228] flex items-center justify-center shadow-md shadow-[#c59941]/20 shrink-0">
              <Ticket className="w-6 h-6 sm:w-7 sm:h-7 text-white transform -rotate-12" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-titulo text-slate-900 tracking-tight">
                Cadastro de Atlética
              </h1>
              <p className="text-xs text-slate-500">
                Registre sua atlética para gerenciar ingressos e eventos.
              </p>
            </div>
          </div>

          {/* Indicador de Etapas (Step Wizard) */}
          <div className="mb-6 sm:mb-8 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
            <div className="relative flex justify-between items-start">
              {/* Linha de fundo delimitada exatamente entre os ícones das extremidades */}
              <div className="absolute top-4 sm:top-5 left-[16.666%] right-[16.666%] h-1 bg-slate-200 z-0 rounded-full" />
              {/* Linha de progresso ativa */}
              <div
                className="absolute top-4 sm:top-5 left-[16.666%] h-1 bg-gradient-to-r from-[#c59941] via-[#d4af37] to-[#9a7228] transition-all duration-500 z-0 rounded-full"
                style={{
                  width: etapa === 1 ? '0%' : etapa === 2 ? '33.333%' : '66.666%',
                }}
              />

              {/* Etapa 1 Node */}
              <div className="relative z-10 flex flex-col items-center text-center gap-1.5 sm:gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (etapa > 1) { setErro(''); setEtapa(1); }
                  }}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    etapa === 1
                      ? 'bg-gradient-to-br from-[#c59941] to-[#9a7228] text-white ring-4 ring-[#c59941]/25 shadow-md shadow-[#c59941]/30 scale-105 sm:scale-110'
                      : etapa > 1
                      ? 'bg-emerald-600 text-white cursor-pointer shadow-sm'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {etapa > 1 ? <Check size={16} className="stroke-[3]" /> : <User size={16} />}
                </button>
                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-tight ${etapa >= 1 ? 'text-[#9a7228]' : 'text-slate-400'}`}>
                  <span className="hidden sm:inline">1. Dados Pessoais</span>
                  <span className="sm:hidden">1. Pessoal</span>
                </span>
              </div>

              {/* Etapa 2 Node */}
              <div className="relative z-10 flex flex-col items-center text-center gap-1.5 sm:gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (etapa > 2) { setErro(''); setEtapa(2); }
                    else if (etapa === 1) { avancarEtapa1(); }
                  }}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    etapa === 2
                      ? 'bg-gradient-to-br from-[#c59941] to-[#9a7228] text-white ring-4 ring-[#c59941]/25 shadow-md shadow-[#c59941]/30 scale-105 sm:scale-110'
                      : etapa > 2
                      ? 'bg-emerald-600 text-white cursor-pointer shadow-sm'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {etapa > 2 ? <Check size={16} className="stroke-[3]" /> : <Trophy size={16} />}
                </button>
                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-tight ${etapa >= 2 ? 'text-[#9a7228]' : 'text-slate-400'}`}>
                  2. Atlética
                </span>
              </div>

              {/* Etapa 3 Node */}
              <div className="relative z-10 flex flex-col items-center text-center gap-1.5 sm:gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (etapa === 2) { avancarEtapa2(); }
                  }}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    etapa === 3
                      ? 'bg-gradient-to-br from-[#c59941] to-[#9a7228] text-white ring-4 ring-[#c59941]/25 shadow-md shadow-[#c59941]/30 scale-105 sm:scale-110'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  <Lock size={16} />
                </button>
                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-tight ${etapa >= 3 ? 'text-[#9a7228]' : 'text-slate-400'}`}>
                  <span className="hidden sm:inline">3. Autenticação</span>
                  <span className="sm:hidden">3. Acesso</span>
                </span>
              </div>
            </div>
          </div>

          {/* Formulário Multietapas */}
          <form onSubmit={aoSubmeter} className="space-y-6">
            {/* ETAPA 1: Dados Pessoais e de Contato */}
            {etapa === 1 && (
              <div className="space-y-5 animar-entrar-baixo">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <User size={16} className="text-[#9a7228]" />
                      Etapa 1: Dados Pessoais
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Identificação do diretor responsável.
                    </p>
                  </div>
                </div>

                <CampoTexto
                  rotulo="Nome completo do diretor"
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  value={nome}
                  onChange={(e) => {
                    setErro('');
                    setNome((e.target as HTMLInputElement).value);
                  }}
                  icone={<User size={18} />}
                  required
                />

                <div className="space-y-1">
                  <CampoTexto
                    rotulo="CPF"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => {
                      setErro('');
                      setCpf(formatarCPF((e.target as HTMLInputElement).value));
                    }}
                    icone={<CreditCard size={18} />}
                    required
                  />
                  {cpf.replace(/\D/g, '').length === 11 && (
                    validarCPF(cpf) ? (
                      <p className="text-[11px] font-semibold text-emerald-400 pl-1 flex items-center gap-1">
                        <span>✓</span> CPF válido
                      </p>
                    ) : (
                      <p className="text-[11px] font-semibold text-red-400 pl-1 flex items-center gap-1">
                        <span>✕</span> CPF inválido. Verifique os números digitados.
                      </p>
                    )
                  )}
                </div>

                <CampoTexto
                  rotulo="Telefone / WhatsApp"
                  type="tel"
                  placeholder="(63) 99999-9999"
                  value={telefone}
                  onChange={(e) => {
                    setErro('');
                    setTelefone(formatarTelefone((e.target as HTMLInputElement).value));
                  }}
                  icone={<Phone size={18} />}
                  maxLength={15}
                  required
                />

                <div className="space-y-1.5 w-full">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Cargo ou Função na Atlética
                  </label>
                  <div className="relative group">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#c59941] transition-colors pointer-events-none z-10">
                      <Briefcase size={18} />
                    </span>
                    <select
                      value={cargo}
                      onChange={(e) => {
                        setErro('');
                        setCargo(e.target.value);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pl-11 pr-10 text-sm text-slate-900 placeholder:text-slate-400 font-normal transition-all duration-300 ease-out hover:border-[#c59941]/40 focus:outline-none focus:border-[#c59941] focus:ring-2 focus:ring-[#c59941]/20 appearance-none cursor-pointer shadow-sm"
                    >
                      <option value="" className="bg-white text-slate-500">
                        Selecione o cargo...
                      </option>
                      <option value="Presidente" className="bg-white text-slate-900">
                        Presidente
                      </option>
                      <option value="Vice-presidente" className="bg-white text-slate-900">
                        Vice-presidente
                      </option>
                      <option value="Secretário" className="bg-white text-slate-900">
                        Secretário
                      </option>
                      <option value="Tesoureiro / Diretor Financeiro" className="bg-white text-slate-900">
                        Tesoureiro / Diretor Financeiro
                      </option>
                      <option value="Diretor de Esportes" className="bg-white text-slate-900">
                        Diretor de Esportes
                      </option>
                      <option value="Diretor de Marketing" className="bg-white text-slate-900">
                        Diretor de Marketing
                      </option>
                      <option value="Diretor de Eventos" className="bg-white text-slate-900">
                        Diretor de Eventos
                      </option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                {erro && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    {erro}
                  </div>
                )}

                <Botao
                  type="button"
                  variante="festiva"
                  larguraTotal
                  tamanho="lg"
                  onClick={avancarEtapa1}
                  icone={<ArrowRight size={18} />}
                >
                  Próximo Passo: Dados da Atlética
                </Botao>
              </div>
            )}

            {/* ETAPA 2: Dados da Atlética */}
            {etapa === 2 && (
              <div className="space-y-5 animar-entrar-baixo">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Trophy size={16} className="text-[#9a7228]" />
                      Etapa 2: Dados da Atlética
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Informações da atlética.
                    </p>
                  </div>
                </div>

                <CampoTexto
                  rotulo="Nome da Atlética"
                  type="text"
                  placeholder="Ex: Atlética Cibernética"
                  value={atleticaNome}
                  onChange={(e) => {
                    setErro('');
                    setAtleticaNome((e.target as HTMLInputElement).value);
                  }}
                  icone={<Trophy size={18} />}
                  required
                />

                <CampoTexto
                  rotulo="Universidade/Faculdade"
                  type="text"
                  placeholder="Ex: UFT"
                  value={atleticaSigla}
                  onChange={(e) => {
                    setErro('');
                    setAtleticaSigla((e.target as HTMLInputElement).value);
                  }}
                  icone={<Building2 size={18} />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <CampoTexto
                      rotulo="Cidade / Campus"
                      type="text"
                      placeholder="Ex: Palmas"
                      value={atleticaCidade}
                      onChange={(e) => {
                        setErro('');
                        setAtleticaCidade((e.target as HTMLInputElement).value);
                      }}
                      icone={<MapPin size={18} />}
                    />
                  </div>
                  <div className="space-y-1.5 w-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Estado
                    </label>
                    <div className="relative group">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#c59941] transition-colors pointer-events-none z-10">
                        <MapPin size={18} />
                      </span>
                      <select
                        value={atleticaEstado}
                        onChange={(e) => {
                          setErro('');
                          setAtleticaEstado(e.target.value);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pl-11 pr-10 text-base sm:text-sm min-h-[44px] text-slate-900 placeholder:text-slate-400 font-normal transition-all duration-300 ease-out hover:border-[#c59941]/40 focus:outline-none focus:border-[#c59941] focus:ring-2 focus:ring-[#c59941]/20 appearance-none cursor-pointer shadow-sm"
                      >
                        <option value="TO" className="bg-white text-slate-900">
                          TO
                        </option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>
                </div>

                {erro && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    {erro}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Botao
                    type="button"
                    variante="fantasma"
                    onClick={() => { setErro(''); setEtapa(1); }}
                    icone={<ArrowLeft size={16} />}
                  >
                    Voltar
                  </Botao>

                  <div className="flex-1">
                    <Botao
                      type="button"
                      variante="festiva"
                      larguraTotal
                      tamanho="lg"
                      onClick={avancarEtapa2}
                      icone={<ArrowRight size={18} />}
                    >
                      Próximo Passo: Autenticação
                    </Botao>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 3: Dados de Autenticação */}
            {etapa === 3 && (
              <div className="space-y-5 animar-entrar-baixo">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Lock size={16} className="text-[#9a7228]" />
                      Etapa 3: Autenticação
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Credenciais para acesso ao painel do diretor.
                    </p>
                  </div>
                </div>

                {/* Verificação de E-mail com Validação Instantânea */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <CampoTexto
                        rotulo="Email corporativo ou da atlética"
                        type="email"
                        placeholder="diretor@atletica.com.br"
                        value={email}
                        onChange={(e) => {
                          const novoEmail = (e.target as HTMLInputElement).value;
                          setEmail(novoEmail);
                          if (novoEmail !== emailEnviado) {
                            setEmailVerificado(false);
                            setCodigoEnviado(false);
                            setTempoReenvio(0);
                          }
                        }}
                        icone={<Mail size={18} />}
                        required
                      />
                    </div>

                    {!emailVerificado && (
                      <Botao
                        type="button"
                        variante="contorno"
                        tamanho="md"
                        carregando={enviandoCodigo}
                        disabled={!email || !email.includes('@') || enviandoCodigo || (email === emailEnviado && tempoReenvio > 0)}
                        onClick={enviarCodigoValidacao}
                        className="shrink-0 h-[46px] text-xs px-3.5 border-slate-200 hover:border-[#c59941] text-slate-700 hover:text-slate-900 bg-white whitespace-nowrap w-full sm:w-auto shadow-sm"
                      >
                        {email === emailEnviado && tempoReenvio > 0 ? `Aguarde ${tempoReenvio}s` : codigoEnviado ? 'Reenviar' : 'Verificar'}
                      </Botao>
                    )}
                  </div>

                  {!emailVerificado && email.includes('@') && !codigoEnviado && (
                    <p className="text-[11px] font-semibold text-[#9a7228] flex items-center gap-1.5 pt-0.5">
                      <span>Clique em <strong>"Verificar"</strong> para receber o código no seu e-mail.</span>
                    </p>
                  )}

                  {/* Status de E-mail Verificado */}
                  {emailVerificado && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 animar-entrar-escala">
                      <ShieldCheck size={16} className="shrink-0" />
                      <span>E-mail verificado com sucesso!</span>
                    </div>
                  )}

                  {/* Caixa para Digitar e Confirmar Código (OTP) */}
                  {codigoEnviado && !emailVerificado && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-[#c59941]/30 space-y-3 animar-entrar-baixo">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound size={14} className="text-[#9a7228] shrink-0" />
                        <span>Digite o código de 6 dígitos enviado para seu e-mail:</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-3 sm:px-4 py-2.5 text-center text-base sm:text-lg font-black font-mono tracking-widest text-slate-900 focus:outline-none focus:border-[#c59941] shadow-sm"
                        />

                        <Botao
                          type="button"
                          variante="festiva"
                          tamanho="md"
                          carregando={validandoCodigo}
                          disabled={codigo.length < 6 || validandoCodigo}
                          onClick={validarCodigoOtp}
                          className="shrink-0 h-[44px] text-xs px-3 sm:px-4 whitespace-nowrap"
                        >
                          Validar
                        </Botao>
                      </div>
                    </div>
                  )}
                </div>

                <CampoTexto
                  rotulo="Senha"
                  type="password"
                  placeholder="Ex: Senha#2026"
                  value={senha}
                  onChange={(e) => setSenha((e.target as HTMLInputElement).value)}
                  icone={<Lock size={18} />}
                  required
                />

                <CampoTexto
                  rotulo="Confirmar senha"
                  type="password"
                  placeholder="Repita a senha cadastrada"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha((e.target as HTMLInputElement).value)}
                  icone={<Lock size={18} />}
                  required
                />

                <IndicadorForcaSenha senha={senha} />

                {bloqueado && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-3 animar-entrar-baixo">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600 font-bold mt-0.5">
                      <Clock size={18} className="animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-red-800">Bloqueado Temporariamente</p>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {mensagemRateLimit || 'Muitas tentativas incorretas em sequência.'}
                      </p>
                      <div className="mt-2 text-xs font-mono font-bold text-red-700 flex items-center gap-1.5">
                        Tente novamente em: <span className="bg-red-100 px-2 py-0.5 rounded border border-red-300 text-red-800 text-sm font-bold">{segundosRestantes}s</span>
                      </div>
                    </div>
                  </div>
                )}

                {erro && !bloqueado && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    {erro}
                  </div>
                )}

                <CaptchaCloudflare
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />

                <div className="flex items-center gap-3 pt-2">
                  <Botao
                    type="button"
                    variante="fantasma"
                    onClick={() => { setErro(''); setEtapa(2); }}
                    icone={<ArrowLeft size={16} />}
                  >
                    Voltar
                  </Botao>

                  <div className="flex-1">
                    <Botao
                      type="submit"
                      variante="festiva"
                      larguraTotal
                      tamanho="lg"
                      carregando={carregando}
                      disabled={bloqueado || carregando || !turnstileToken}
                    >
                      {bloqueado ? `Aguarde ${segundosRestantes}s` : 'Cadastrar e Solicitar Acesso'}
                    </Botao>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Rodapé / Link para Login */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Já possui uma conta de diretor cadastrada?{' '}
              <Link
                href="/autenticacao/entrar"
                className="text-[#9a7228] hover:text-[#c59941] underline font-bold transition-colors ml-1"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



