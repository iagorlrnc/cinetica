import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProvedorNotificacao } from "@/componentes/ui/Notificacao";
import { ProvedorAutenticacao } from "@/contextos/ContextoAutenticacao";
import { ProvedorCookies } from "@/contextos/ContextoCookies";
import { ProvedorCarrinho } from "@/contextos/ContextoCarrinho";
import dynamic from "next/dynamic";

const BannerCookies = dynamic(() => import("@/componentes/ui/BannerCookies"));

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#fafafa",
};

const dominioPrincipal = (process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL || 'meuingrss.com.br').replace(/\/+$/, '');
const protocoloConfig = process.env.NEXT_PUBLIC_PROTOCOLO || 'https';

export const metadata: Metadata = {
  metadataBase: new URL(`${protocoloConfig}://${dominioPrincipal}`),
  title: "Cinética Ingressos | A.A.A.F.A. Fisioterapia",
  description: "A plataforma oficial de ingressos e eventos da Atlética Cinética (A.A.A.F.A. Fisioterapia). Compre com segurança via PIX e acesse com QR Code.",
  keywords: ["cinetica", "ingressos", "fisioterapia", "atletica", "eventos", "QR Code", "aaafa"],
  authors: [{ name: "Cinética Fisioterapia" }],
  icons: {
    icon: "/cinetica-logo.png",
    shortcut: "/cinetica-logo.png",
    apple: "/cinetica-logo.png",
  },
  openGraph: {
    title: "Cinética Ingressos | A.A.A.F.A. Fisioterapia",
    description: "Encontre os melhores eventos da Cinética e compre ingressos com segurança.",
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

