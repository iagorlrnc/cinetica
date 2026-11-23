'use client';

import { usePathname } from 'next/navigation';
import CabecalhoCliente from '@/componentes/layout/CabecalhoCliente';
import Rodape from '@/componentes/layout/Rodape';
import BarraNavegacaoMobile from '@/componentes/layout/BarraNavegacaoMobile';

export default function LayoutCliente({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const ehPaginaAutenticacao = pathname?.includes('/autenticacao');

  if (ehPaginaAutenticacao) {
    return <main className="tema-cinetica min-h-screen">{children}</main>;
  }

  return (
    <div className="tema-cinetica min-h-screen flex flex-col pb-[76px] lg:pb-0">
      <CabecalhoCliente />
      <main className="flex-1 pt-[72px] sm:pt-20">{children}</main>
      <Rodape />
      <BarraNavegacaoMobile />
    </div>
  );
}
