'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';

/**
 * Placeholder leve (SVG animado, < 1 KB) exibido enquanto a imagem real carrega.
 * Evita “buraco” na tela em conexões lentas e não exige requisição extra.
 */
const SHIMMER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><defs><linearGradient id="g"><stop stop-color="#111a33" offset="0"/><stop stop-color="#1c2a4d" offset=".5"/><stop stop-color="#111a33" offset="1"/></linearGradient></defs><rect width="40" height="40" fill="#111a33"/><rect width="40" height="40" fill="url(#g)"><animate attributeName="x" from="-40" to="40" dur="1.2s" repeatCount="indefinite"/></rect></svg>'
)}` as const;

const PADRAO_STORAGE_SUPABASE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i;

/**
 * Só passa pelo otimizador do Next o que está liberado em `images.remotePatterns`
 * (Storage público do Supabase) ou arquivos locais sem query string.
 * Qualquer outra origem (data:, blob:, outros domínios) é exibida sem otimização.
 */
export function podeOtimizarImagem(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return !src.includes('?');
  return PADRAO_STORAGE_SUPABASE.test(src);
}

interface PropsImagemOtimizada {
  src: string;
  alt: string;
  /** Largura máxima (px CSS) em que a imagem aparece. O Next gera versões 1x e 2x a partir dela. */
  largura: number;
  /** Altura proporcional. Padrão: igual à largura (quadrada). */
  altura?: number;
  className?: string;
  style?: CSSProperties;
  /** Imagem principal da tela (LCP): carrega antes, sem lazy loading. */
  prioridade?: boolean;
  /** Qualidade da compressão (precisa estar em `images.qualities`). */
  qualidade?: 60 | 75;
  /** Exibe o placeholder animado. Desative em imagens decorativas com fundo próprio. */
  comPlaceholder?: boolean;
  draggable?: boolean;
  'aria-hidden'?: boolean;
}

export default function ImagemOtimizada({
  src,
  alt,
  largura,
  altura,
  className,
  style,
  prioridade = false,
  qualidade = 60,
  comPlaceholder = true,
  draggable,
  'aria-hidden': ariaHidden,
}: PropsImagemOtimizada) {
  // Se o otimizador falhar (ex.: domínio não liberado), cai para a URL original.
  const [falhouOtimizacao, setFalhouOtimizacao] = useState(false);
  const otimizar = podeOtimizarImagem(src) && !falhouOtimizacao;

  return (
    <Image
      src={src}
      alt={alt}
      width={largura}
      height={altura ?? largura}
      quality={qualidade}
      unoptimized={!otimizar}
      className={className}
      style={style}
      draggable={draggable}
      aria-hidden={ariaHidden}
      placeholder={comPlaceholder ? SHIMMER : 'empty'}
      loading={prioridade ? 'eager' : 'lazy'}
      fetchPriority={prioridade ? 'high' : 'auto'}
      decoding="async"
      onError={() => {
        if (otimizar) setFalhouOtimizacao(true);
      }}
    />
  );
}
