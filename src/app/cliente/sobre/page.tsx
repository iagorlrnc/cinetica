import { Metadata } from 'next';
import Link from 'next/link';
import {
  ShoppingBag,
  Gift,
  Ticket,
  ShieldCheck,
  QrCode,
  Users,
  PackageCheck,
  Shuffle,
  Trophy,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { serializarJsonLdSeguro } from '@/lib/jsonLd';
import { obterUrlSite } from '@/lib/dominios';

const baseUrl = obterUrlSite();

const DESCRICAO =
  'Conheça a Cinética: loja oficial de produtos da Atlética Cinética (A.A.A.F.A. Fisioterapia), sorteios online com bilhetes numerados e venda de ingressos para eventos universitários em Palmas/TO.';

export const metadata: Metadata = {
  title: 'Sobre a Cinética — Loja Oficial, Sorteios Online e Ingressos | Palmas/TO',
  description: DESCRICAO,
  alternates: {
    canonical: `${baseUrl}/sobre`,
  },
  openGraph: {
    title: 'Sobre a Cinética — Loja Oficial e Sorteios Online',
    description:
      'Produtos oficiais da atlética, sorteios online com pagamento via Pix e ingressos para eventos universitários em Palmas/TO.',
    url: `${baseUrl}/sobre`,
    siteName: 'Cinética',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre a Cinética',
    description: 'Loja oficial, sorteios online e ingressos da Atlética Cinética em Palmas/TO.',
  },
};

const FRENTES = [
  {
    icone: ShoppingBag,
    selo: 'Principal',
    titulo: 'Loja oficial',
    texto:
      'Camisetas, kits e produtos oficiais da atlética. Escolha o tamanho, pague por Pix ou cartão e retire seu pedido diretamente com a diretoria.',
    href: '/loja',
    acao: 'Ver produtos',
    destaque: true,
  },
  {
    icone: Gift,
    selo: 'Principal',
    titulo: 'Sorteios online',
    texto:
      'Garanta suas cotas, receba números de bilhete gerados automaticamente após o Pix aprovado e acompanhe o resultado pela plataforma.',
    href: '/sorteios',
    acao: 'Ver sorteios',
    destaque: true,
  },
  {
    icone: Ticket,
    selo: 'Também disponível',
    titulo: 'Ingressos para eventos',
    texto:
      'Festas, calouradas e eventos das atléticas parceiras com ingresso digital em QR Code validado na portaria.',
    href: '/eventos',
    acao: 'Ver eventos',
    destaque: false,
  },
] as const;

const PASSOS_SORTEIO = [
  { icone: Gift, titulo: 'Escolha o sorteio', texto: 'Veja o prêmio, o valor da cota, a data da apuração e o regulamento.' },
  { icone: QrCode, titulo: 'Pague por Pix', texto: 'O pagamento é processado pelo Mercado Pago e confirmado em segundos.' },
  { icone: Shuffle, titulo: 'Receba seus números', texto: 'Os bilhetes são gerados só após a aprovação e ficam em “Meus bilhetes”.' },
  { icone: Trophy, titulo: 'Acompanhe o resultado', texto: 'Na data marcada o ganhador é apurado e divulgado na página do sorteio.' },
] as const;

const PILARES = [
  {
    icone: ShieldCheck,
    titulo: 'Pagamento seguro',
    texto: 'Pix e cartão processados pelo Mercado Pago. Não armazenamos dados do seu cartão.',
  },
  {
    icone: PackageCheck,
    titulo: 'Pedido acompanhado',
    texto: 'Cada compra fica registrada em “Meus pedidos”, com status do pagamento e da retirada.',
  },
  {
    icone: Users,
    titulo: 'Feito pela atlética',
    texto: 'Mantida pela Atlética Cinética para financiar ações, eventos e o esporte universitário.',
  },
] as const;

const PERGUNTAS = [
  {
    p: 'Como recebo um produto da loja?',
    r: 'Após a aprovação do pagamento, o pedido aparece como “Pago • Aguardando retirada” em Meus pedidos. A retirada é feita diretamente com a diretoria da atlética, que marca o pedido como entregue.',
  },
  {
    p: 'Quando recebo os números do sorteio?',
    r: 'Assim que o Pix é aprovado. Pedidos não pagos expiram automaticamente e nenhum número é reservado para eles.',
  },
  {
    p: 'Como sei quem ganhou?',
    r: 'O resultado é publicado na página do sorteio, com o nome do ganhador, o número do bilhete premiado e a cidade, conforme o regulamento de cada sorteio.',
  },
  {
    p: 'Ainda dá para comprar ingressos?',
    r: 'Sim. A venda de ingressos continua disponível na aba Eventos, com QR Code pessoal emitido na hora após o pagamento.',
  },
] as const;

export default function PaginaSobre() {
  const jsonLdSobre = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Atlética Cinética — A.A.A.F.A. Fisioterapia',
        alternateName: 'Cinética',
        url: baseUrl,
        logo: `${baseUrl}/imagens/cinetica-logo-512.png`,
        taxID: '68.627.894/0001-88',
        description: DESCRICAO,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Palmas',
          addressRegion: 'TO',
          addressCountry: 'BR',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: PERGUNTAS.map(({ p, r }) => ({
          '@type': 'Question',
          name: p,
          acceptedAnswer: { '@type': 'Answer', text: r },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLdSeguro(jsonLdSobre) }}
      />
      <main className="min-h-screen bg-fundo-principal text-texto-principal py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-12 sm:space-y-16">
          {/* Cabeçalho */}
          <header className="text-center space-y-4 pt-6">
            <span className="inline-block px-3 py-1 rounded-full bg-ouro/15 text-destaque text-xs font-black uppercase tracking-widest border border-ouro/30">
              Loja · Sorteios · Ingressos
            </span>
            <h1 className="titulo-display text-5xl sm:text-7xl text-texto-principal">
              Sobre a <span className="gradiente-texto">Cinética</span>
            </h1>
            <p className="text-texto-secundario text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              A Cinética é a plataforma oficial da <strong>Atlética Cinética (A.A.A.F.A. Fisioterapia)</strong>. Aqui você
              compra os <strong>produtos oficiais</strong> da atlética, participa dos <strong>sorteios online</strong> e,
              quando tiver evento, garante seu <strong>ingresso</strong> — tudo com pagamento seguro e acompanhamento pela sua conta.
            </p>
          </header>

          {/* Missão */}
          <section className="bg-fundo-card border border-borda-sutil rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-black uppercase font-titulo text-texto-principal">Nossa missão</h2>
            <p className="text-texto-secundario text-sm sm:text-base leading-relaxed">
              Fortalecer a atlética e aproximar a comunidade acadêmica com uma experiência de compra simples, transparente e
              100% digital. Cada produto vendido e cada cota de sorteio ajuda a financiar os jogos, as ações e os eventos da
              Cinética.
            </p>
          </section>

          {/* O que você encontra */}
          <section className="space-y-6" aria-labelledby="titulo-frentes">
            <h2 id="titulo-frentes" className="text-xl sm:text-2xl font-black uppercase font-titulo text-texto-principal text-center">
              O que você encontra aqui
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {FRENTES.map(({ icone: Icone, selo, titulo, texto, href, acao, destaque }) => (
                <article
                  key={titulo}
                  className={`relative flex flex-col rounded-2xl p-6 space-y-3 shadow-sm border ${
                    destaque ? 'bg-fundo-card border-ouro/40' : 'bg-fundo-card/70 border-borda-sutil'
                  }`}
                >
                  <span
                    className={`self-start text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      destaque ? 'bg-ouro/15 text-destaque border-ouro/30' : 'text-texto-terciario border-borda-sutil'
                    }`}
                  >
                    {selo}
                  </span>
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      destaque ? 'bg-ouro/15 text-ouro' : 'bg-fundo-elevado text-texto-secundario'
                    }`}
                  >
                    <Icone size={24} />
                  </div>
                  <h3 className="text-lg font-black uppercase font-titulo text-texto-principal">{titulo}</h3>
                  <p className="text-sm text-texto-secundario leading-relaxed flex-1">{texto}</p>
                  <Link
                    href={href}
                    className={`inline-flex items-center gap-1.5 text-sm font-bold transition-colors ${
                      destaque ? 'text-ouro hover:text-destaque' : 'text-texto-secundario hover:text-texto-principal'
                    }`}
                  >
                    {acao} <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {/* Como funcionam os sorteios */}
          <section className="bg-fundo-card border border-borda-sutil rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm" aria-labelledby="titulo-sorteios">
            <div className="space-y-2">
              <h2 id="titulo-sorteios" className="text-xl sm:text-2xl font-black uppercase font-titulo text-texto-principal flex items-center gap-2">
                <Gift size={24} className="text-ouro shrink-0" />
                Como funcionam os sorteios
              </h2>
              <p className="text-sm text-texto-secundario leading-relaxed">
                Cada sorteio tem prêmio, quantidade de cotas, data de apuração e regulamento próprios, sempre visíveis antes da compra.
              </p>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PASSOS_SORTEIO.map(({ icone: Icone, titulo, texto }, i) => (
                <li key={titulo} className="p-4 rounded-xl bg-fundo-elevado/60 border border-borda-sutil space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-ouro text-azul-950 text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <Icone size={18} className="text-ouro" />
                  </div>
                  <h3 className="text-sm font-bold text-texto-principal">{titulo}</h3>
                  <p className="text-xs text-texto-secundario leading-relaxed">{texto}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Pilares */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {PILARES.map(({ icone: Icone, titulo, texto }) => (
              <div key={titulo} className="bg-fundo-card border border-borda-sutil rounded-xl p-6 space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-lg bg-ouro/10 flex items-center justify-center text-ouro">
                  <Icone size={24} />
                </div>
                <h3 className="text-lg font-black uppercase font-titulo text-texto-principal">{titulo}</h3>
                <p className="text-xs text-texto-secundario leading-relaxed">{texto}</p>
              </div>
            ))}
          </section>

          {/* Perguntas frequentes */}
          <section className="space-y-4" aria-labelledby="titulo-faq">
            <h2 id="titulo-faq" className="text-xl sm:text-2xl font-black uppercase font-titulo text-texto-principal flex items-center gap-2">
              <HelpCircle size={24} className="text-ouro shrink-0" />
              Perguntas frequentes
            </h2>
            <div className="space-y-3">
              {PERGUNTAS.map(({ p, r }) => (
                <details
                  key={p}
                  className="group bg-fundo-card border border-borda-sutil rounded-xl px-5 py-4 shadow-sm open:border-ouro/40"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-bold text-texto-principal">
                    {p}
                    <ArrowRight size={16} className="text-ouro shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="pt-3 text-sm text-texto-secundario leading-relaxed">{r}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Chamada final */}
          <section className="bg-azul-900 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left shadow-lg">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black uppercase font-titulo text-white">Vista a camisa e concorra</h2>
              <p className="text-sm text-slate-300">
                Confira os produtos oficiais e os sorteios abertos. Dúvidas? Veja os{' '}
                <Link href="/termos-e-privacidade" className="text-ouro underline hover:text-ouro-claro">
                  termos e a política de privacidade
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Link
                href="/loja"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-ouro to-ouro-classico font-black uppercase text-sm text-azul-950 hover:brightness-105 transition-all shadow-md"
              >
                <ShoppingBag size={16} /> Ir para a loja
              </Link>
              <Link
                href="/sorteios"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl border border-ouro/50 font-black uppercase text-sm text-ouro hover:bg-ouro/10 transition-colors"
              >
                <Gift size={16} /> Ver sorteios
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
