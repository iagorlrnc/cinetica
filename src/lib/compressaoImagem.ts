/**
 * Compressão de imagens no navegador antes do upload para o Storage.
 *
 * Fotos de celular costumam ter 3–8 MB e 4000px de largura; o site nunca as
 * exibe acima de ~1600px. Redimensionar e converter para WebP aqui reduz o
 * arquivo em 85–95% e faz a imagem abrir rápido mesmo em internet ruim.
 */

export interface OpcoesCompressao {
  /** Maior lado da imagem final, em pixels. */
  ladoMaximo?: number;
  /** Qualidade WebP entre 0 e 1. */
  qualidade?: number;
}

/** Tipos que não devem ser recomprimidos (GIF pode ser animado; SVG é vetorial). */
const TIPOS_PRESERVADOS = new Set(['image/gif', 'image/svg+xml']);

export function calcularDimensoes(largura: number, altura: number, ladoMaximo: number) {
  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo) return { largura, altura };
  const fator = ladoMaximo / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

/** Troca a extensão do nome do arquivo (ex.: "foto.JPG" → "foto.webp"). */
export function trocarExtensao(nome: string, extensao: string) {
  const base = nome.replace(/\.[^./\\]+$/, '') || 'imagem';
  return `${base}.${extensao}`;
}

/**
 * Devolve um File WebP redimensionado. Se o navegador não suportar, se o tipo
 * deve ser preservado ou se o resultado ficar maior, devolve o arquivo original.
 */
export async function comprimirImagem(arquivo: File, opcoes: OpcoesCompressao = {}): Promise<File> {
  const { ladoMaximo = 1600, qualidade = 0.82 } = opcoes;

  if (!arquivo.type.startsWith('image/') || TIPOS_PRESERVADOS.has(arquivo.type)) return arquivo;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const { largura, altura } = calcularDimensoes(bitmap.width, bitmap.height, ladoMaximo);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return arquivo;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', qualidade));
    // Safari antigo devolve PNG quando não sabe gerar WebP: nesse caso mantém o original.
    if (!blob || blob.type !== 'image/webp' || blob.size >= arquivo.size) return arquivo;

    return new File([blob], trocarExtensao(arquivo.name, 'webp'), { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return arquivo;
  }
}

/** Extensão de arquivo a partir do MIME type. */
export function extensaoDoTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return mapa[tipo] || 'jpg';
}
