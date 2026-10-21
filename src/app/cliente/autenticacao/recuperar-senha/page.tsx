'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Mail, KeyRound, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import CaptchaCloudflare from '@/componentes/ui/CaptchaCloudflare';
import Carregando from '@/componentes/ui/Carregando';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';

function FormularioRecuperarSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  // Estados de Rate Limit
  const [bloqueado, setBloqueado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [mensagemRateLimit, setMensagemRateLimit] = useState('');

  const { recuperarSenha } = usarAutenticacao();

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
      const resultado = await recuperarSenha(email.trim(), turnstileToken);

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

      setEnviadoComSucesso(true);
    } catch {
      setErro('Ocorreu um erro ao tentar enviar o e-mail de recuperação. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 relative overflow-hidden bg-[#fafafa]">
      {/* Background subtle gold ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#c59941]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link
          href="/autenticacao/entrar"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all uppercase tracking-wider mb-4 sm:mb-6 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-full border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={14} />
          Voltar ao login
        </Link>

        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl shadow-slate-200/50 animar-entrar-baixo border border-slate-200/80">
          {/* Cabeçalho */}
          <div className="flex items-center gap-3.5 mb-6 sm:mb-8 pb-5 border-b border-slate-100">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#c59941] to-[#9a7228] text-[#0e1422] flex items-center justify-center shadow-md shadow-[#c59941]/20 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-titulo text-slate-900">
                Recuperar Senha
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Redefina o acesso à sua conta Cinética Ingressos
              </p>
            </div>
          </div>

          {enviadoComSucesso ? (
            /* Estado de Sucesso */
            <div className="text-center space-y-5 py-2 animar-entrar-baixo">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold font-titulo text-slate-900">
                  E-mail de recuperação enviado!
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Enviamos as instruções para <strong className="text-[#c59941] font-semibold">{email}</strong>. Clique no link enviado para cadastrar uma nova senha.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 text-left">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span>Dicas importantes:</span>
                </div>
                <p>• O link é temporário e expira em breve por segurança.</p>
                <p>• Se não encontrar na caixa de entrada, verifique sua pasta de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong>.</p>
              </div>

              <div className="pt-3 space-y-3">
                <Botao
                  variante="festiva"
                  larguraTotal
                  tamanho="lg"
                  onClick={() => {
                    setEnviadoComSucesso(false);
                    setEmail('');
                  }}
                >
                  Enviar para outro e-mail
                </Botao>

                <Link
                  href="/autenticacao/entrar"
                  className="block text-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors py-2"
                >
                  Voltar para tela de login
                </Link>
              </div>
            </div>
          ) : (
            /* Formulário de Envio */
            <form onSubmit={aoSubmeter} className="space-y-4 sm:space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Digite o e-mail cadastrado na sua conta. Nós lhe enviaremos um link seguro para você redefinir sua senha.
              </p>

              <CampoTexto
                rotulo="Email cadastrado"
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

              {bloqueado && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 flex items-start gap-3 animar-entrar-baixo">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600 font-bold mt-0.5">
                    <Clock size={16} className="animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-red-700">Bloqueado Temporariamente</p>
                    <p className="mt-1 leading-relaxed text-red-600">
                      {mensagemRateLimit || 'Muitas tentativas em sequência.'}
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
                {bloqueado ? `Aguarde ${segundosRestantes}s` : 'Enviar Link de Recuperação'}
              </Botao>

              <CaptchaCloudflare
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
              />

              <p className="text-center text-xs text-slate-500 pt-2">
                Lembrou a senha?{' '}
                <Link
                  href="/autenticacao/entrar"
                  className="text-[#c59941] hover:text-[#9a7228] hover:underline font-bold transition-colors ml-1 inline-block"
                >
                  Entrar agora
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaginaRecuperarSenha() {
  return (
    <Suspense fallback={<Carregando telaCheia texto="Carregando recuperação de senha..." />}>
      <FormularioRecuperarSenha />
    </Suspense>
  );
}
