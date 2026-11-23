import type { MetadataRoute } from 'next';
import { obterUrlSite } from '@/lib/dominios';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = obterUrlSite();

  const rotasPrivadas = [
    '/meus-ingressos',
    '/meus-bilhetes',
    '/minha-conta',
    '/checkout',
    '/loja/carrinho',
    '/loja/checkout',
    '/loja/meus-pedidos',
    '/autenticacao/',
    '/diretor/',
    '/admin/',
    '/api/',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: rotasPrivadas,
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: rotasPrivadas,
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: rotasPrivadas,
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: rotasPrivadas,
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: rotasPrivadas,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
