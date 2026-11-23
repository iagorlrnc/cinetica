'use client';

import React from 'react';
import Cartao from '@/componentes/ui/Cartao';
import { Inbox } from 'lucide-react';

interface EstadoVazioProps {
  titulo?: string;
  descricao?: string;
  icone?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}

export default function EstadoVazio({
  titulo = 'Nenhuma informação no momento',
  descricao = 'Não há dados disponíveis para exibição nesta seção.',
  icone,
  acao,
  className,
}: EstadoVazioProps) {
  return (
    <Cartao variante="contorno" className={`text-center py-14 px-6 border-dashed ${className || ''}`}>
      <div className="w-16 h-16 rounded-2xl bg-ouro/15 border border-ouro/30 flex items-center justify-center mx-auto mb-5 text-ouro -rotate-6">
        {icone || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-2xl font-extrabold font-titulo text-texto-principal mb-2">
        {titulo}
      </h3>
      <p className="text-sm text-texto-secundario max-w-sm mx-auto mb-6">
        {descricao}
      </p>
      {acao && <div className="flex justify-center">{acao}</div>}
    </Cartao>
  );
}
