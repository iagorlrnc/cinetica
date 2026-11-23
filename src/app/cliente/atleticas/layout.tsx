import { Metadata } from 'next';
import { obterUrlSite } from '@/lib/dominios';

const baseUrl = obterUrlSite();

export const metadata: Metadata = {
  title: 'Atléticas | Cinética',
  description:
    'Conheça as atléticas acadêmicas parceiras da Cinética. Encontre eventos, calouradas e festas organizadas pelas atléticas.',
  alternates: {
    canonical: `${baseUrl}/atleticas`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Atléticas | Cinética',
    description:
      'Painel oficial de atléticas universitárias parceiras da plataforma Cinética.',
    url: `${baseUrl}/atleticas`,
    siteName: 'Cinética',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function LayoutAtleticas({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
