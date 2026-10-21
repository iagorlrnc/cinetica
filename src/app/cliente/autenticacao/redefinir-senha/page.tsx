'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao';
import { criarClienteNavegador } from '@/lib/supabase/cliente';
import Botao from '@/componentes/ui/Botao';
import CampoTexto from '@/componentes/ui/CampoTexto';
import Carregando from '@/componentes/ui/Carregando';
import IndicadorForcaSenha from '@/componentes/ui/IndicadorForcaSenha';
import { avaliarSenha, traduzirErroAuth } from '@/lib/utilitarios';
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

function FormularioRedefinirSenha() {
  const { redefinirSenha } = usarAutenticacao();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = criarClienteNavegador();

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let montado = true;

    async function validarAcessoRecuperacao() {
      if (typeof window === 'undefined') return;

      // 1. Extrair parâmetros tanto da Query String (?) quanto do Fragmento Hash (#)
      const paramsUrl = new URLSearchParams(window.location.search);
      const hashString = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const paramsHash = new URLSearchParams(hashString);

      // 1.1 Verificar erros retornados pelo Supabase (Query ou Hash)
      const erroDesc =
        paramsUrl.get('error_description') ||
        paramsHash.get('error_description') ||
        paramsUrl.get('error') ||
        paramsHash.get('error');

      if (erroDesc) {
        if (montado) {
          const msgFormatada = decodeURIComponent(erroDesc).replace(/\+/g, ' ');
          setErro(traduzirErroAuth(msgFormatada));
          setSessaoValida(false);
          setVerificandoSessao(false);
        }
        return;
      }

      // 2. Se houver token_hash na URL (fluxo mais seguro contra scanners de email)
      const tokenHash = paramsUrl.get('token_hash') || paramsHash.get('token_hash');
      const tipoOtp = (paramsUrl.get('type') || paramsHash.get('type') || 'recovery') as any;

      if (tokenHash) {
        try {
          const { data: dataOtp, error: errOtp } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: tipoOtp,
          });

          if (!errOtp && dataOtp?.session) {
            if (montado) {
              setSessaoValida(true);
              setVerificandoSessao(false);
            }
            return;
          }
        } catch (e) {
          console.warn('Falha na verificação de token_hash:', e);
        }
      }

      // 3. Se houver código PKCE (?code=...)
      const code = paramsUrl.get('code');
      if (code) {
        try {
          const { data: dataCode, error: errCode } = await supabase.auth.exchangeCodeForSession(code);
          if (!errCode && dataCode?.session) {
            if (montado) {
              setSessaoValida(true);
              setVerificandoSessao(false);
            }
            return;
          }
        } catch (e) {
          console.warn('Falha na troca de código PKCE:', e);
        }
      }

      // 4. Se houver access_token e refresh_token no Hash (#access_token=...)
      const accessToken = paramsHash.get('access_token');
      const refreshToken = paramsHash.get('refresh_token');
      if (accessToken && refreshToken) {
        try {
          const { data: dataSession, error: errSession } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!errSession && dataSession?.session) {
            if (montado) {
              setSessaoValida(true);
              setVerificandoSessao(false);
            }
            return;
          }
        } catch (e) {
          console.warn('Falha ao definir sessão via hash token:', e);
        }
      }

      // 5. Verificar se já existe uma sessão ativa estabelecida
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (montado) {
          if (session?.user) {
            setSessaoValida(true);
            setVerificandoSessao(false);
            return;
          }

          // Aguarda um pequeno intervalo caso o Supabase ainda esteja processando o evento de autenticação
          const timeoutId = setTimeout(async () => {
            if (!montado) return;
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user) {
              setSessaoValida(true);
            } else {
              setSessaoValida(false);
              setErro('Link de recuperação inválido ou expirado. Por favor, solicite uma nova redefinição de senha.');
            }
            setVerificandoSessao(false);
          }, 1500);

          return () => clearTimeout(timeoutId);
        }
      } catch (err) {
        if (montado) {
          setSessaoValida(false);
          setErro('Não foi possível verificar a validade do link de recuperação.');
          setVerificandoSessao(false);
        }
      }
    }

    validarAcessoRecuperacao();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (_event === 'PASSWORD_RECOVERY' || (session?.user && montado)) {
        setSessaoValida(true);
        setVerificandoSessao(false);
      }
    });

    return () => {
      montado = false;
      subscription.unsubscribe();
    };
  }, [supabase, searchParams]);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    const statusSenha = avaliarSenha(novaSenha);
    if (!statusSenha.valida) {
      setErro('A senha deve conter no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial (!@#$...).');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas digitadas não coincidem.');
      return;
    }

    setCarregando(true);

    const resultado = await redefinirSenha(novaSenha);

    if (resultado.erro) {
      setErro(traduzirErroAuth(resultado.erro));
      setCarregando(false);
    } else {
      setSucesso(true);
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
                Nova Senha
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Crie uma senha forte e segura
              </p>
            </div>
          </div>

          {verificandoSessao ? (
            <div className="text-center py-10 space-y-4">
              <Carregando texto="Validando link de recuperação..." />
            </div>
          ) : sucesso ? (
            /* Estado de Sucesso */
            <div className="text-center space-y-5 py-2 animar-entrar-baixo">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold font-titulo text-slate-900">
                  Senha alterada com sucesso!
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Sua nova senha já está ativa. Você pode agora fazer login com as novas credenciais.
                </p>
              </div>

              <div className="pt-3">
                <Botao
                  variante="festiva"
                  larguraTotal
                  tamanho="lg"
                  onClick={() => router.push('/autenticacao/entrar')}
                >
                  Ir para o Login
                </Botao>
              </div>
            </div>
          ) : !sessaoValida ? (
            /* Link Inválido ou Expirado */
            <div className="text-center space-y-5 py-2 animar-entrar-baixo">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600 shadow-sm">
                <AlertCircle size={36} />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold font-titulo text-slate-900">
                  Link Inválido ou Expirado
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  {erro || 'O link de recuperação que você utilizou já foi usado ou expirou por motivos de segurança.'}
                </p>
              </div>

              <div className="pt-3 space-y-3">
                <Botao
                  variante="festiva"
                  larguraTotal
                  tamanho="lg"
                  onClick={() => router.push('/autenticacao/recuperar-senha')}
                >
                  Solicitar Novo Link
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
            /* Formulário de Nova Senha */
            <form onSubmit={aoSubmeter} className="space-y-4 sm:space-y-5">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-[#c59941]" />
                <span>Link validado com segurança. Digite sua nova senha abaixo.</span>
              </div>

              <CampoTexto
                rotulo="Nova Senha"
                type="password"
                placeholder="Ex: Senha#2026"
                value={novaSenha}
                onChange={(e) => setNovaSenha((e.target as HTMLInputElement).value)}
                icone={<Lock size={18} />}
                required
              />

              <CampoTexto
                rotulo="Confirmar Nova Senha"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha((e.target as HTMLInputElement).value)}
                icone={<Lock size={18} />}
                required
              />

              <IndicadorForcaSenha senha={novaSenha} />

              {erro && (
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
                disabled={carregando || !novaSenha || !confirmarSenha || !avaliarSenha(novaSenha).valida}
              >
                Salvar Nova Senha
              </Botao>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaginaRedefinirSenha() {
  return (
    <Suspense fallback={<Carregando telaCheia texto="Carregando redefinição de senha..." />}>
      <FormularioRedefinirSenha />
    </Suspense>
  );
}
