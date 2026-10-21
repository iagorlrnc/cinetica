'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Carregando from '@/componentes/ui/Carregando';
import Modal from '@/componentes/ui/Modal';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import {
  Ticket,
  Mail,
  Lock,
  ArrowLeft,
  Clock,
  TrendingUp,
  QrCode,
  ArrowRight
} from 'lucide-react';

import { useRateLimitAuth } from '@/hooks/useRateLimitAuth';
import CaptchaCloudflare from '@/componentes/ui/CaptchaCloudflare';

import { construirUrl } from '@/lib/dominios';
import { obterIdAtleticaCinetica } from '@/lib/atleticaCinetica';

function FormularioEntrarDiretor() {
  const { entrar } = usarAutenticacao();
  const [erro, setErro] = useState('');
  const { bloqueado, segundosRestantes, mensagemRateLimit, aplicarStatus } = useRateLimitAuth(() => {
    setErro('');
  });
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirecionar = searchParams.get('redirecionar') || '/';
  const urlSitePrincipal = construirUrl('cliente', '/');

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modalPendenteAberto, setModalPendenteAberto] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const supabase = criarClienteNavegador();

  useEffect(() => {
    if (searchParams.get('pendente') === '1') {
      setModalPendenteAberto(true);
    }
  }, [searchParams]);

  function fecharModalPendente() {
    setModalPendenteAberto(false);
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado) return;

    setErro('');
    setCarregando(true);

    const emailTratado = email.trim().toLowerCase();

    // 1. Verifica preventivamente se o e-mail possui um cadastro pendente de aprovação
    try {
      const { data: statusResp } = await supabase.rpc('verificar_status_cadastro', {
        p_email: emailTratado,
      });

      const infoStatus = Array.isArray(statusResp) ? statusResp[0] : statusResp;

      if (infoStatus?.status === 'pendente') {
        await supabase.auth.signOut();
        setModalPendenteAberto(true);
        setErro('Sua solicitação de cadastro para o painel de diretor está em análise pelo administrador. Aguarde a aprovação para acessar o sistema.');
        setCarregando(false);
        return;
      }
    } catch (eCheck) {
      console.warn('Não foi possível pré-verificar o status do e-mail:', eCheck);
    }

    // 2. Realiza a tentativa de autenticação
    const resultado = await entrar(email, senha);

    if (resultado.erro) {
      // Caso a senha esteja errada ou haja erro de login, verifica se a conta está pendente para dar o aviso correto
      try {
        const { data: perfilPendente } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('email', emailTratado)
          .maybeSingle();

        if (perfilPendente?.status === 'pendente' || (perfilPendente?.role === 'diretor' && perfilPendente?.status === 'pendente')) {
          await supabase.auth.signOut();
          setModalPendenteAberto(true);
          setErro('Sua solicitação de cadastro para o painel de diretor está em análise pelo administrador. Aguarde a aprovação para acessar o sistema.');
          setCarregando(false);
          return;
        }
      } catch (errCheck) {
        console.warn('Erro ao consultar perfil pendente:', errCheck);
      }

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
      return;
    }

    // 3. Validação da sessão ativada
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('role, status, atletica_id')
        .eq('id', user.id)
        .single();

      if (perfil?.status === 'pendente') {
        await supabase.auth.signOut();
        setModalPendenteAberto(true);
        setErro('Sua solicitação de cadastro para o painel de diretor está em análise pelo administrador. Aguarde a aprovação para acessar o sistema.');
        setCarregando(false);
        return;
      }

      if (perfil?.status === 'bloqueado') {
        setErro('Sua solicitação de cadastro de diretor foi recusada ou está bloqueada pelo administrador.');
        await supabase.auth.signOut();
        setCarregando(false);
        return;
      }

      // Se a conta está ativa e possui atlética associada, garante que a role seja 'diretor'
      if (perfil?.status === 'ativo' && perfil.atletica_id && perfil.role === 'cliente') {
        await supabase
          .from('profiles')
          .update({ role: 'diretor' })
          .eq('id', user.id);
        perfil.role = 'diretor';
      }

      // Garante vínculo automático à Atlética Cinética para diretores e administradores
      if ((perfil?.role === 'diretor' || perfil?.role === 'admin') && !perfil.atletica_id) {
        const idCin = await obterIdAtleticaCinetica(supabase);
        if (idCin) {
          await supabase.from('profiles').update({ atletica_id: idCin }).eq('id', user.id);
          perfil.atletica_id = idCin;
        }
      }

      if (!perfil || (perfil.role !== 'diretor' && perfil.role !== 'admin' && !perfil.atletica_id)) {
        setErro('Sua conta é de cliente. O portal do diretor é restrito à Atlética Cinética.');
        await supabase.auth.signOut();
        setCarregando(false);
        return;
      }
    }

    window.location.href = redirecionar;
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#fafafa] relative overflow-hidden">
      {/* Orbes de fundo suaves */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-[#c59941]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-[#121826]/5 rounded-full blur-3xl pointer-events-none" />

      {/* LADO ESQUERDO: Painel Informativo & Métricas de Valor (Desktop) */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between p-12 xl:p-16 relative z-10 border-r border-slate-200 bg-slate-50/70">
        <div>
          {/* Navegação Superior */}
          <a
            href={urlSitePrincipal}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider bg-white hover:bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm w-fit mb-12"
          >
            <ArrowLeft size={14} />
            Voltar ao site principal
          </a>

          {/* Headline & Badges */}
          <div className="max-w-xl space-y-6">
            <h1 className="text-4xl xl:text-5xl font-black font-titulo text-slate-900 leading-tight tracking-tight">
              <span className="text-slate-500">Gerencie sua Atlética com </span>{' '}
              <span className="bg-gradient-to-r from-[#c59941] via-[#d4af37] to-[#9a7228] bg-clip-text text-transparent">
                Painel Executivo
              </span>
            </h1>

            <p className="text-base text-slate-600 font-normal leading-relaxed">
              Painel completo para gestão de vendas de ingressos em tempo real, controle de lotes, validação via QR Code e relatórios financeiros transparentes.
            </p>
          </div>

          {/* Destaques de Recursos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-xl">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-[#c59941]/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#c59941]/10 text-[#9a7228] flex items-center justify-center mb-3">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Vendas ao Vivo</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Métricas e conversão de vendas em tempo real.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-[#121826]/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#121826]/10 text-[#121826] flex items-center justify-center mb-3">
                <QrCode size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Check-in Rápido</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Leitor de QR Code para portaria sem filas.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-500/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                <Ticket size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Virada de Lotes</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Programação automática de horários e limites.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LADO DIREITO: Form de Autenticação */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center items-center p-3 sm:p-8 lg:p-12 relative z-10 w-full">
        {/* Botão de voltar visível apenas no mobile */}
        <div className="w-full max-w-md lg:hidden mb-4 sm:mb-6">
          <a
            href={urlSitePrincipal}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider bg-white hover:bg-slate-50 px-3.5 py-2 rounded-full border border-slate-200 shadow-sm"
          >
            <ArrowLeft size={14} />
            Voltar ao site principal
          </a>
        </div>

        <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl animar-entrar-baixo border border-slate-200/80">
          {/* Cabeçalho do Card */}
          <div className="flex items-center gap-3.5 sm:gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-100">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#c59941] via-[#d4a84e] to-[#9a7228] flex items-center justify-center shadow-md shadow-[#c59941]/20 shrink-0">
              <Ticket className="w-6 h-6 sm:w-7 sm:h-7 text-white transform -rotate-12" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-titulo text-slate-900 tracking-tight">
                Painel da Diretoria
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Digite suas credenciais cadastradas.
              </p>
            </div>
          </div>

          <form onSubmit={aoSubmeter} className="space-y-4 sm:space-y-5">
            <CampoTexto
              rotulo="Email corporativo ou da atlética"
              type="email"
              placeholder="diretor@atletica.com.br"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              icone={<Mail size={18} />}
              required
            />

            <CampoTexto
              rotulo="Senha de acesso"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha((e.target as HTMLInputElement).value)}
              icone={<Lock size={18} />}
              required
            />

            <div className="flex justify-end -mt-1 sm:-mt-2">
              <Link
                href="/autenticacao/recuperar-senha"
                className="text-xs font-semibold text-[#9a7228] hover:text-[#c59941] hover:underline transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>

            {bloqueado && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-3 animar-entrar-baixo">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600 font-bold mt-0.5">
                  <Clock size={16} className="animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs sm:text-sm text-red-800">Bloqueado Temporariamente</p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {mensagemRateLimit || 'Muitas tentativas incorretas em sequência.'}
                  </p>
                  <div className="mt-2 text-xs font-mono font-bold text-red-700 flex items-center gap-1.5 flex-wrap">
                    Tente novamente em: <span className="bg-red-100 px-2 py-0.5 rounded border border-red-300 text-red-800 text-sm font-bold">{segundosRestantes}s</span>
                  </div>
                </div>
              </div>
            )}

            {erro && !bloqueado && (
              <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 leading-relaxed flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <Botao
              type="submit"
              variante="festiva"
              larguraTotal
              tamanho="lg"
              carregando={carregando}
              disabled={bloqueado || carregando || !turnstileToken}
              icone={<ArrowRight size={18} />}
            >
              {bloqueado ? `Aguarde ${segundosRestantes}s` : 'Acessar Painel do Diretor'}
            </Botao>

            <CaptchaCloudflare
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
            />
          </form>

          {/* Chamada para Cadastro */}
          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Sua atlética ainda não tem cadastro?{' '}
              <Link
                href="/autenticacao/cadastro"
                className="text-[#9a7228] hover:text-[#c59941] underline font-bold transition-colors ml-1 inline-block"
              >
                Cadastrar Atlética
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Modal Pop-up de Aguardando Aprovação */}
      <Modal
        aberto={modalPendenteAberto}
        aoFechar={fecharModalPendente}
        tamanho="sm"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-[#c59941]/10 border border-[#c59941]/25 flex items-center justify-center mx-auto text-[#9a7228] shadow-sm">
            <Clock size={32} />
          </div>

          <h3 className="text-xl font-black font-titulo text-slate-900">
            Cadastro em Análise
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed">
            Sua conta de <strong className="text-[#9a7228] font-bold">Diretor de Atlética</strong> e os dados cadastrados foram recebidos e estão aguardando a aprovação do <strong className="text-slate-900">Administrador</strong>.
          </p>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
            Você receberá a permissão de acesso ao painel assim que o administrador aprovar seu credenciamento.
          </div>

          <Botao
            variante="festiva"
            larguraTotal
            onClick={fecharModalPendente}
          >
            Entendido
          </Botao>
        </div>
      </Modal>
    </div>
  );
}

export default function PaginaEntrarDiretor() {
  return (
    <Suspense fallback={<Carregando telaCheia texto="Carregando portal do diretor..." />}>
      <FormularioEntrarDiretor />
    </Suspense>
  );
}


