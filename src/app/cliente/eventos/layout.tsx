import { Metadata } from 'next';
import { serializarJsonLdSeguro } from '@/lib/jsonLd';
import { obterUrlSite } from '@/lib/dominios';

const baseUrl = obterUrlSite();

export const metadata: Metadata = {
  title: 'Eventos | Cinética',
  description:
    'Confira todos os eventos, calouradas e festas de atléticas universitárias em Palmas e no Tocantins. Compre seus ingressos digitais via Pix ou Cartão na Cinética!',
  alternates: {
    canonical: `${baseUrl}/eventos`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    title: 'Eventos | Cinética',
    description:
      'Encontre os melhores eventos universitários e garanta seus ingressos digitais com segurança.',
    url: `${baseUrl}/eventos`,
    siteName: 'Cinética',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Todos os Eventos | Cinética',
    description: 'Adquira ingressos para eventos universitários com aprovação instantânea.',
  },
};

export default function LayoutEventos({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLdEventos = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Eventos Universitários',
    description: 'Catálogo oficial de eventos, calouradas e festas organizadas por atléticas.',
    url: `${baseUrl}/eventos`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLdSeguro(jsonLdEventos) }}
      />
      {children}
    </>
  );
}
