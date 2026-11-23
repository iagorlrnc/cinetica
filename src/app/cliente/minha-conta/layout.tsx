import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Minha conta | Cinética',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function LayoutMinhaConta({ children }: { children: React.ReactNode }) {
  return children;
}
