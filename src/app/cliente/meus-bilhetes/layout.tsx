import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meus Bilhetes | Cinética',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function LayoutMeusBilhetes({ children }: { children: React.ReactNode }) {
  return children;
}
