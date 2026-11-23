import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProvedorNotificacao } from "@/componentes/ui/Notificacao";
import { ProvedorAutenticacao } from "@/contextos/ContextoAutenticacao";
import { ProvedorCookies } from "@/contextos/ContextoCookies";
import { ProvedorCarrinho } from "@/contextos/ContextoCarrinho";
import dynamic from "next/dynamic";
import { obterUrlSite } from '@/lib/dominios';

const BannerCookies = dynamic(() => import("@/componentes/ui/BannerCookies"));

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#070d22",
};


export const metadata: Metadata = {
  metadataBase: new URL(obterUrlSite()),
  title: "Cinética | Loja Oficial e Sorteios — A.A.A.F.A. Fisioterapia",
  description: "Loja oficial e sorteios online da Atlética Cinética (A.A.A.F.A. Fisioterapia) em Palmas/TO. Compre produtos oficiais, concorra a prêmios com pagamento via Pix e garanta ingressos para eventos.",
  keywords: ["cinetica", "atletica", "loja oficial", "produtos", "camisetas", "sorteios", "rifas", "fisioterapia", "aaafa", "palmas", "ingressos"],
  authors: [{ name: "Cinética Fisioterapia" }],
  icons: {
    icon: "/cinetica-logo.png",
    shortcut: "/cinetica-logo.png",
    apple: "/cinetica-logo.png",
  },
  openGraph: {
    title: "Cinética | Loja Oficial e Sorteios",
    description: "Produtos oficiais da atlética, sorteios online via Pix e ingressos para eventos universitários em Palmas/TO.",
    siteName: "Cinética",
    locale: "pt_BR",
    type: "website",
    images: ["/cinetica-logo.png"],
  },
};

export default function LayoutRaiz({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ProvedorAutenticacao>
          <ProvedorCookies>
            <ProvedorNotificacao>
              <ProvedorCarrinho>
                {children}
                <BannerCookies />
              </ProvedorCarrinho>
            </ProvedorNotificacao>
          </ProvedorCookies>
        </ProvedorAutenticacao>
      </body>
    </html>
  );
}

