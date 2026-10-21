import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sorteios & Rifas Oficiais | Atlética Cinética',
  description:
    'Participe dos sorteios e rifas oficiais da Atlética Cinética (A.A.A.F.A. Fisioterapia). Concorra a prêmios em dinheiro via Pix, kits oficiais e ingressos VIP!',
  openGraph: {
    title: 'Sorteios & Rifas Oficiais | Atlética Cinética',
    description:
      'Participe dos sorteios e rifas oficiais da Atlética Cinética (A.A.A.F.A. Fisioterapia).',
    images: ['/cinetica-logo.png'],
  },
};

export default function LayoutSorteios({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
