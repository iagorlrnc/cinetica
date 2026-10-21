import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Autenticação | Cinética Ingressos',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function LayoutAutenticacao({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
