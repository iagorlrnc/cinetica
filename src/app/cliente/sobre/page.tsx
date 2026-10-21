import { Metadata } from 'next';
import Link from 'next/link';
import { Ticket, ShieldCheck, CreditCard, Users, Sparkles, Award } from 'lucide-react';
import { serializarJsonLdSeguro } from '@/lib/jsonLd';

const dominioPrincipal = (process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL || 'meuingrss.com.br').replace(/\/+$/, '');
const protocolo = process.env.NEXT_PUBLIC_PROTOCOLO || 'https';
const baseUrl = `${protocolo}://${dominioPrincipal}`;

export const metadata: Metadata = {
  title: 'Sobre o meuingrss — Plataforma de Ingressos para Festas Universitárias em Palmas/TO',
  description:
    'Saiba tudo sobre o meuingrss: a plataforma oficial de compra de ingressos para festas universitárias, calouradas e cervejadas de atléticas em Palmas/TO.',
  alternates: {
    canonical: `${baseUrl}/sobre`,
  },
  openGraph: {
    title: 'Sobre o meuingrss — Ingressos Universitários em Palmas/TO',
    description:
      'A plataforma definitiva para compra de ingressos digitais via QR Code para festas de atléticas universitárias.',
    url: `${baseUrl}/sobre`,
    siteName: 'meuingrss',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre o meuingrss',
    description: 'Compra rápida e segura de ingressos para festas universitárias em Palmas/TO.',
  },
};

export default function PaginaSobre() {
  const jsonLdSobre = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Cinética Ingressos',
    url: baseUrl,
    logo: `${baseUrl}/cinetica-logo.png`,
    description:
      'Plataforma de venda de ingressos digitais especializada em festas, calouradas e cervejadas organizadas por atléticas universitárias em Palmas e região.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Palmas',
      addressRegion: 'TO',
      addressCountry: 'BR',
    },
    sameAs: [`${baseUrl}`],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLdSeguro(jsonLdSobre) }}
      />
      <main className="min-h-screen bg-[#fafafa] text-slate-800 py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header Banner */}
          <header className="text-center space-y-4 pt-6">
            <span className="inline-block px-3 py-1 rounded-full bg-[#c59941]/15 text-[#9a7228] text-xs font-black uppercase tracking-widest border border-[#c59941]/30">
              Plataforma de vendas de Ingressos
            </span>
            <h1 className="text-3xl sm:text-5xl font-black font-titulo tracking-tight uppercase leading-tight text-slate-900">
              Sobre a <span className="gradiente-texto">Cinética Ingressos</span>
            </h1>
            <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              A <strong>Cinética Ingressos</strong> (A.A.A.F.A. Fisioterapia) é a plataforma tecnológica oficial para a compra e venda de ingressos de festas universitárias, calouradas e eventos acadêmicos.
            </p>
          </header>

          {/* Missão e O que Fazemos */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-black uppercase font-titulo text-slate-900 flex items-center gap-2">
              Nossa Missão
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Conectar universitários, atléticas e produtores de eventos através de uma experiência de compra instantânea, segura e 100% digital. Eliminamos filas, ingressos físicos de papel e fraudes com a emissão automática de QR Codes validados em tempo real na portaria do evento.
            </p>
          </section>

          {/* Pilares */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#c59941]/10 flex items-center justify-center text-[#c59941]">
                <CreditCard size={24} />
              </div>
              <h3 className="text-lg font-black uppercase font-titulo text-slate-900">Pagamento Instantâneo</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pagamento via Pix aprovado na hora com emissão imediata do ingresso digital em QR Code no seu celular.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-6 space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#0e1422]/10 flex items-center justify-center text-[#0e1422]">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-lg font-black uppercase font-titulo text-slate-900">Segurança Antifraude</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Validação por leitura de QR Code em scanner oficial pelas equipes das atléticas, evitando clonagem e cópias.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-6 space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#c59941]/10 flex items-center justify-center text-[#c59941]">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-black uppercase font-titulo text-slate-900">Foco Universitário</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Desenvolvido sob medida para atléticas acadêmicas, oferecendo gestão de lotes e relatórios de vendas em tempo real.
              </p>
            </div>
          </section>

          {/* Onde Atuamos */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-black uppercase font-titulo text-slate-900 flex items-center gap-2">
              <Award size={24} className="text-[#c59941]" />
              Onde Comprar Ingressos de Festa Universitária?
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Se você está procurando onde comprar ingressos para as melhores festas universitárias, recepções de calouros e eventos de atléticas, a <strong>Cinética Ingressos</strong> é o canal oficial. Acesse os eventos ativos, escolha o lote desejado e garanta seu ingresso com facilidade.
            </p>
            <div className="pt-4 flex flex-wrap gap-4">
              <Link href="/eventos">
                <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#c59941] to-[#9a7228] font-black uppercase text-sm text-white hover:brightness-105 transition-all shadow-md cursor-pointer">
                  Ver Eventos Disponíveis
                </button>
              </Link>
              <Link href="/atleticas">
                <button className="px-6 py-3 rounded-xl bg-slate-100 border border-slate-200 font-bold text-sm text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer">
                  Conhecer Atléticas Parceiras
                </button>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
