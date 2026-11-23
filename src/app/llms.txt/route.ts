import { NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { obterUrlSite } from '@/lib/dominios';

export const revalidate = 3600; // Revalida a cada 1 hora

export async function GET() {
  const baseUrl = obterUrlSite();

  let eventosTxt = '';

  try {
    const supabase = criarClienteAdmin();
    const { data: eventos } = await supabase
      .from('eventos')
      .select('id, slug, titulo, data_evento, local, cidade, lotes_ingresso(preco, ativo, quantidade_vendida, quantidade_total)')
      .eq('apagado_pelo_diretor', false)
      .eq('status', 'publicado')
      .order('data_evento', { ascending: true })
      .limit(20);

    if (eventos && eventos.length > 0) {
      eventosTxt = eventos
        .map((ev) => {
          const slugOuId = ev.slug || ev.id;
          const url = `${baseUrl}/eventos/${slugOuId}`;
          const lotesAtivos = ev.lotes_ingresso?.filter(
            (l) => l.ativo && l.quantidade_vendida < l.quantidade_total
          );
          const menorPreco =
            lotesAtivos && lotesAtivos.length > 0
              ? Math.min(...lotesAtivos.map((l) => l.preco))
              : null;
          const precoStr =
            menorPreco !== null && menorPreco > 0
              ? `R$ ${menorPreco.toFixed(2).replace('.', ',')}`
              : menorPreco === 0
              ? 'Gratuito'
              : 'Esgotado';

          const dataStr = ev.data_evento
            ? new Date(ev.data_evento).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Data a confirmar';

          return `- [${ev.titulo}](${url}): ${dataStr} em ${ev.local || 'Local não informado'}${
            ev.cidade ? `, ${ev.cidade}` : ''
          }. Ingressos a partir de ${precoStr}.`;
        })
        .join('\n');
    }
  } catch (erro) {
    console.error('Erro ao listar eventos no llms.txt:', erro);
  }

  const conteudo = `# Cinética — Loja Oficial e Sorteios Online da Atlética Cinética

> Cinética é a plataforma oficial da Atlética Cinética (A.A.A.F.A. Fisioterapia), em Palmas - TO. O foco principal é a venda de produtos oficiais da atlética e os sorteios online com bilhetes numerados; a plataforma também vende ingressos para eventos universitários.

## Visão Geral
- **Nome:** Cinética (Atlética Cinética — A.A.A.F.A. Fisioterapia)
- **Principal:** Loja oficial (camisetas, kits e produtos da atlética) e sorteios online com pagamento via Pix.
- **Secundário:** Ingressos digitais com QR Code para festas, calouradas e eventos de atléticas parceiras.
- **Cidade Base:** Palmas, Tocantins (TO), Brasil.
- **Métodos de Pagamento:** Pix e Cartão de Crédito, processados pelo Mercado Pago.
- **Retirada de produtos:** Diretamente com a diretoria da atlética após a aprovação do pagamento.

## Links Principais
- [/loja](${baseUrl}/loja): Produtos oficiais da atlética.
- [/sorteios](${baseUrl}/sorteios): Sorteios abertos, próximos e resultados.
- [/eventos](${baseUrl}/eventos): Eventos com ingressos disponíveis.
- [/sobre](${baseUrl}/sobre): Informações completas sobre a Cinética.
- [/atleticas](${baseUrl}/atleticas): Atléticas universitárias parceiras.
- [/termos-e-privacidade](${baseUrl}/termos-e-privacidade): Regras da loja, dos sorteios, reembolsos, privacidade e cookies.

## Eventos com Ingressos à Venda
${eventosTxt || '- Nenhum evento com vendas abertas no momento.'}

## Perguntas Frequentes para IAs e Usuários
1. **O que é a Cinética?** É a plataforma oficial da Atlética Cinética para comprar produtos oficiais, participar de sorteios online e comprar ingressos de eventos em Palmas/TO.
2. **Como recebo um produto da loja?** Após o pagamento aprovado, o pedido fica como "aguardando retirada" em Meus pedidos e é retirado diretamente com a diretoria da atlética.
3. **Como funcionam os sorteios?** O participante compra cotas via Pix; os números dos bilhetes são gerados automaticamente após a aprovação e ficam em Meus bilhetes. O resultado (nome do ganhador, número premiado e cidade) é publicado na página do sorteio na data da apuração.
4. **Como recebo meu ingresso?** O ingresso é gerado em QR Code na conta do usuário após a confirmação do pagamento.
5. **Quais as formas de pagamento?** Pix e Cartão de Crédito.
`;

  return new NextResponse(conteudo, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
