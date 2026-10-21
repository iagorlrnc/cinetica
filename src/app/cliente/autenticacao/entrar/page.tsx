'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Ticket, ArrowLeft, Clock } from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Modal from '@/componentes/ui/Modal';
import CaptchaCloudflare from '@/componentes/ui/CaptchaCloudflare';
import Carregando from '@/componentes/ui/Carregando';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';

function FormularioEntrar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirecionarPara = searchParams.get('redirecionar') || '/';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modalPendenteAberto, setModalPendenteAberto] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  // Estados de Rate Limit
  const [bloqueado, setBloqueado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [mensagemRateLimit, setMensagemRateLimit] = useState('');

  const supabase = criarClienteNavegador();
  const { entrar } = usarAutenticacao();

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado) return;
    setErro('');

    if (!turnstileToken) {
      setErro('Por favor, complete a verificação de segurança (Cloudflare Turnstile).');
      return;
    }

    setCarregando(true);

    try {
      const resultado = await entrar(email.trim(), senha, 'geral', turnstileToken);

      if (resultado.erro) {
        if (resultado.bloqueado) {
          setBloqueado(true);
          setSegundosRestantes(resultado.segundosRestantes || 60);
          setMensagemRateLimit(resultado.erro);

          const intervalo = setInterval(() => {
            setSegundosRestantes((prev) => {
              if (prev <= 1) {
                clearInterval(intervalo);
                setBloqueado(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }

        setErro(resultado.erro);
        return;
      }

      // Autenticação bem-sucedida, busca perfil correto na tabela 'profiles'
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', user.id)
          .maybeSingle();

        if (perfil?.role === 'diretor' && perfil?.status === 'pendente') {
          await supabase.auth.signOut();
          setModalPendenteAberto(true);
          return;
        }

        if (perfil?.role === 'admin') {
          router.push('/admin');
        } else if (perfil?.role === 'diretor') {
          router.push('/diretor');
        } else {
          router.push(redirecionarPara);
        }
      } else {
        router.push(redirecionarPara);
      }
    } catch (err: any) {
      setErro(err?.message || 'Ocorreu um erro ao tentar entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 py-8 relative overflow-hidden bg-[#fafafa]">
      {/* Background subtle gold ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#c59941]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider mb-4 sm:mb-6 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-full border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={14} />
          Voltar ao início
        </Link>

        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl shadow-slate-200/50 animar-entrar-baixo border border-slate-200/80">
          <div className="flex items-center gap-3.5 mb-6 sm:mb-8 pb-5 border-b border-slate-100">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#c59941] to-[#9a7228] text-[#0e1422] flex items-center justify-center shadow-md shadow-[#c59941]/20 shrink-0">
              <Ticket className="w-6 h-6 transform -rotate-12" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-titulo text-slate-900">
                Entrar
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Acesse sua conta Cinética Ingressos
              </p>
            </div>
          </div>

          <form onSubmit={aoSubmeter} className="space-y-4 sm:space-y-5">
            <CampoTexto
              rotulo="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => {
                setEmail((e.target as HTMLInputElement).value);
                if (erro) setErro('');
              }}
              icone={<Mail size={18} />}
              required
            />

            <CampoTexto
              rotulo="Senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => {
                setSenha((e.target as HTMLInputElement).value);
                if (erro) setErro('');
              }}
              icone={<Lock size={18} />}
              required
            />

            <div className="flex justify-end -mt-1 sm:-mt-2">
              <Link
                href="/autenticacao/recuperar-senha"
                className="text-xs font-semibold text-[#c59941] hover:text-[#9a7228] hover:underline transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>

            {bloqueado && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 flex items-start gap-3 animar-entrar-baixo">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600 font-bold mt-0.5">
                  <Clock size={16} className="animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs sm:text-sm text-red-700">Bloqueado Temporariamente</p>
                  <p className="mt-1 leading-relaxed text-red-600">
                    {mensagemRateLimit || 'Muitas tentativas incorretas em sequência.'}
                  </p>
                  <div className="mt-2 text-xs font-mono font-bold text-red-700 flex items-center gap-1.5 flex-wrap">
                    Tente novamente em: <span className="bg-red-200 px-2 py-0.5 rounded border border-red-300 text-red-800 text-sm font-bold">{segundosRestantes}s</span>
                  </div>
                </div>
              </div>
            )}

            {erro && !bloqueado && (
              <div className="p-3 sm:p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 leading-relaxed flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
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
            >
              {bloqueado ? `Aguarde ${segundosRestantes}s` : 'Entrar'}
            </Botao>

            <CaptchaCloudflare
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
            />
          </form>

          <p className="text-center text-xs sm:text-sm text-slate-500 mt-6">
            Não tem conta?{' '}
            <Link
              href="/autenticacao/cadastro"
              className="text-[#c59941] hover:text-[#9a7228] hover:underline font-bold transition-colors ml-1 inline-block"
            >
              Cadastre-se gratuitamente
            </Link>
          </p>
        </div>
      </div>

      {/* Modal Pop-up de Aguardando Aprovação */}
      <Modal
        aberto={modalPendenteAberto}
        aoFechar={() => setModalPendenteAberto(false)}
        tamanho="sm"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-md">
            <Clock size={32} />
          </div>

          <h3 className="text-xl font-black font-titulo text-slate-900">
            Cadastro em Análise
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed">
            Sua conta de <strong className="text-[#c59941] font-bold">Diretor de Atlética</strong> e os dados cadastrados ainda estão aguardando a aprovação do <strong className="text-slate-900">Administrador</strong>.
          </p>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
            ⏳ Você receberá a permissão de acesso ao painel assim que o administrador aprovar seu credenciamento.
          </div>

          <Botao
            variante="festiva"
            larguraTotal
            onClick={() => setModalPendenteAberto(false)}
          >
            Entendido
          </Botao>
        </div>
      </Modal>
    </div>
  );
}

export default function PaginaEntrar() {
  return (
    <Suspense fallback={<Carregando telaCheia texto="Carregando..." />}>
      <FormularioEntrar />
    </Suspense>
  );
}
