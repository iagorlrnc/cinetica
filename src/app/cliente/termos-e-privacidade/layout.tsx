import { Metadata } from 'next';
import { obterUrlSite } from '@/lib/dominios';

const baseUrl = obterUrlSite();

export const metadata: Metadata = {
  title: 'Termos de Uso, Privacidade e Cookies | Cinética',
  description:
    'Regras da loja oficial, dos sorteios online e da venda de ingressos da Atlética Cinética, além de como tratamos seus dados pessoais (LGPD) e usamos cookies.',
  alternates: {
    canonical: `${baseUrl}/termos-e-privacidade`,
  },
};

export default function LayoutTermosEPrivacidade({ children }: { children: React.ReactNode }) {
  return children;
}
