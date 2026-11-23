'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usarCookies } from '@/contextos/ContextoCookies';
import { CreditCard, ShieldCheck, Mail, Copy, Check, QrCode } from 'lucide-react';
import Logo from '@/componentes/ui/Logo';
import Modal from '@/componentes/ui/Modal';
import { VERSAO_SISTEMA } from '@/lib/constantes';
import { construirUrl } from '@/lib/dominios';

/** E-mail de atendimento configurado no ambiente (vazio = não exibe). */
const EMAIL_SUPORTE = (process.env.NEXT_PUBLIC_EMAIL_SUPORTE || '').trim();

export default function Rodape() {
  const { abrirBanner } = usarCookies();
  const [modalAjudaAberto, setModalAjudaAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiarEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL_SUPORTE);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Área de transferência indisponível: o e-mail continua selecionável
    }
  }

  const anoAtual = new Date().getFullYear();

  return (
    <>
      <footer className="relative overflow-hidden bg-azul-950 border-t border-borda-sutil">
        {/* Faixa rolante com o grito da atlética */}
        <div className="bg-ouro text-azul-950 py-3 overflow-hidden select-none" aria-hidden="true">
          <div className="faixa-rolante faixa-rolante-lenta">
            {Array.from({ length: 2 }).map((_, bloco) => (
              <div key={bloco} className="flex items-center shrink-0">
                {Array.from({ length: 6 }).map((__, i) => (
                  <span key={i} className="flex items-center gap-6 pr-6 font-titulo font-extrabold text-xl sm:text-2xl uppercase tracking-tight">
                    Cinética
                    <span className="text-azul-950/50">✦</span>
                    Cinética
                    <span className="text-azul-950/50">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
            {/* Marca */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <Logo href="/" tamanhoIcone="sm" tamanhoTexto="sm" />
              <p className="text-sm text-texto-secundario leading-relaxed max-w-xs">
                Ingressos, sorteios e loja oficial da Atlética Cinética (A.A.A.F.A. Fisioterapia).
              </p>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <ShieldCheck size={14} className="shrink-0" />
                Pagamento seguro e QR Code na hora
              </p>
            </div>

            {/* Explorar */}
            <nav aria-label="Explorar">
              <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-ouro mb-3">Explorar</h4>
              <ul className="space-y-2 text-sm text-texto-secundario">
                {[
                  { href: '/eventos', rotulo: 'Eventos' },
                  { href: '/sorteios', rotulo: 'Sorteios' },
                  { href: '/loja', rotulo: 'Loja oficial' },
                  { href: '/minha-conta', rotulo: 'Minha conta' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-ouro transition-colors">
                      {l.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Ajuda */}
            <nav aria-label="Ajuda">
              <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-ouro mb-3">Ajuda</h4>
              <ul className="space-y-2 text-sm text-texto-secundario">
                <li>
                  <button type="button" onClick={() => setModalAjudaAberto(true)} className="hover:text-ouro transition-colors cursor-pointer text-left">
                    Central de ajuda
                  </button>
                </li>
                <li>
                  <Link href="/termos-e-privacidade" className="hover:text-ouro transition-colors">
                    Termos e privacidade
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={abrirBanner} className="hover:text-ouro transition-colors cursor-pointer text-left">
                    Preferências de cookies
                  </button>
                </li>
                <li>
                  <Link href="/sobre" className="hover:text-ouro transition-colors">
                    Sobre a plataforma
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Pagamento e contato */}
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-ouro mb-3">Pagamento</h4>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-borda-media text-xs font-semibold text-texto-principal">
                  <QrCode size={13} className="text-ouro" /> Pix
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-borda-media text-xs font-semibold text-texto-principal">
                  <CreditCard size={13} className="text-ouro" /> Cartão
                </span>
              </div>
              {EMAIL_SUPORTE && (
                <a
                  href={`mailto:${EMAIL_SUPORTE}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-texto-secundario hover:text-ouro transition-colors break-all"
                >
                  <Mail size={13} className="shrink-0" />
                  {EMAIL_SUPORTE}
                </a>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-borda-sutil flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-texto-terciario text-center sm:text-left">
            <p>
              © {anoAtual} Atlética Cinética · A.A.A.F.A. Fisioterapia · CNPJ 68.627.894/0001-88
            </p>
            <span className="flex items-center gap-3">
              <a href={construirUrl('diretor', '/autenticacao/entrar')} className="hover:text-ouro transition-colors">
                Área da diretoria
              </a>
              <a href={construirUrl('admin', '/autenticacao/entrar')} className="hover:text-ouro transition-colors">
                Admin
              </a>
              <span className="font-mono">{VERSAO_SISTEMA}</span>
            </span>
          </div>
        </div>
      </footer>

      <Modal
        aberto={modalAjudaAberto}
        aoFechar={() => setModalAjudaAberto(false)}
        titulo="Central de ajuda"
        descricao="Dúvida com compra, ingresso ou pedido? Fala com a gente."
        tamanho="md"
      >
        {EMAIL_SUPORTE ? (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-fundo-elevado border border-borda-media">
              <p className="text-xs font-black uppercase tracking-widest text-ouro mb-2 flex items-center gap-2">
                <Mail size={14} /> E-mail oficial
              </p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-base sm:text-lg font-titulo font-extrabold text-texto-principal select-all break-all">
                  {EMAIL_SUPORTE}
                </span>
                <button
                  type="button"
                  onClick={copiarEmail}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-fundo-card border border-borda-media text-xs font-bold text-texto-principal hover:border-ouro transition-colors cursor-pointer"
                >
                  {copiado ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <p className="text-sm text-texto-secundario leading-relaxed">
              Para agilizar, mande o e-mail da sua conta e o código do pedido.
            </p>

            <div className="flex justify-end">
              <a href={`mailto:${EMAIL_SUPORTE}`} className="botao-pop px-6 py-3 text-sm">
                <Mail size={16} />
                Mandar e-mail
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-texto-secundario leading-relaxed">
            Fale com a diretoria da Atlética Cinética pelos canais oficiais da atlética. Para agilizar, informe o e-mail da sua
            conta e o código do pedido.
          </p>
        )}
      </Modal>
    </>
  );
}
