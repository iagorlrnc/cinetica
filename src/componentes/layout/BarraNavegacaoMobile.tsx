'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, Gift, ShoppingBag, UserRound } from 'lucide-react';
import { usarCarrinho } from '@/contextos/ContextoCarrinho';
import { cn } from '@/lib/utilitarios';

/**
 * Barra de abas inferior (estilo app) para celular.
 */
export default function BarraNavegacaoMobile() {
  const pathname = usePathname() || '/';
  const { totalItens } = usarCarrinho();

  const em = (rota: string) => pathname.startsWith(rota) || pathname.startsWith(`/cliente${rota}`);
  // Páginas da conta (ingressos, bilhetes, pedidos) acendem a aba "Conta"
  const naConta = ['/minha-conta', '/meus-ingressos', '/meus-bilhetes', '/loja/meus-pedidos'].some(em);
  const ativo = (rota: string) =>
    rota === '/'
      ? pathname === '/' || pathname === '/cliente'
      : rota === '/minha-conta'
        ? naConta
        : em(rota) && !naConta;

  const abas = [
    { rotulo: 'Início', href: '/', icone: Home },
    { rotulo: 'Loja', href: '/loja', icone: ShoppingBag, contador: totalItens },
    { rotulo: 'Sorteios', href: '/sorteios', icone: Gift },
    { rotulo: 'Eventos', href: '/eventos', icone: CalendarDays },
    { rotulo: 'Conta', href: '/minha-conta', icone: UserRound },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-md grid grid-cols-5 gap-1 rounded-[1.75rem] bg-azul-900/90 backdrop-blur-xl border border-borda-media p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]">
        {abas.map(({ rotulo, href, icone: Icone, contador }) => {
          const estaAtivo = ativo(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={estaAtivo ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 rounded-[1.25rem] py-2 text-[10px] font-bold transition-all',
                estaAtivo ? 'bg-ouro text-azul-950' : 'text-texto-secundario hover:text-texto-principal'
              )}
            >
              <Icone size={20} strokeWidth={estaAtivo ? 2.6 : 2} />
              <span className="leading-none">{rotulo}</span>
              {Boolean(contador) && (
                <span className="absolute top-1 right-[18%] min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                  {contador}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
