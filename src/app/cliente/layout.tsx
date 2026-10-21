'use client';

import { usePathname } from 'next/navigation';
import CabecalhoCliente from '@/componentes/layout/CabecalhoCliente';
import Rodape from '@/componentes/layout/Rodape';

export default function LayoutCliente({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const ehPaginaAutenticacao = pathname?.includes('/autenticacao');

  if (ehPaginaAutenticacao) {
    return <main className="min-h-screen bg-[#fafafa]">{children}</main>;
  }

  const ehInicio = pathname === '/' || pathname === '/cliente';

  return (
    <>
      <CabecalhoCliente />
      <main className={`min-h-screen ${ehInicio ? 'pt-0' : 'pt-16 md:pt-[120px]'}`}>
        {children}
      </main>
      <Rodape />
    </>
  );
}

