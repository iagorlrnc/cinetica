import { describe, expect, it } from 'vitest';
import {
  eventoJaPassou,
  ingressosRestantes,
  menorPrecoDisponivel,
  partesData,
  rotuloContagem,
  situacaoEvento,
  JANELA_EVENTO_EM_ANDAMENTO_MS,
} from '@/lib/eventos';
import { normalizarSorteio } from '@/lib/sorteios';

const lote = (preco: number, total: number, vendida: number, ativo = true) => ({
  preco,
  quantidade_total: total,
  quantidade_vendida: vendida,
  ativo,
});

const AGORA = new Date('2026-11-17T12:00:00').getTime();
const DIA = 86_400_000;

describe('menorPrecoDisponivel', () => {
  it('ignora lotes inativos e esgotados', () => {
    expect(menorPrecoDisponivel([lote(10, 5, 5), lote(30, 10, 0), lote(5, 10, 0, false), lote(20, 10, 2)])).toBe(20);
  });
  it('retorna null sem lotes à venda', () => {
    expect(menorPrecoDisponivel([])).toBeNull();
    expect(menorPrecoDisponivel(null)).toBeNull();
    expect(menorPrecoDisponivel([lote(10, 1, 1)])).toBeNull();
  });
  it('aceita lote gratuito', () => {
    expect(menorPrecoDisponivel([lote(0, 10, 0), lote(15, 10, 0)])).toBe(0);
  });
});

describe('ingressosRestantes', () => {
  it('soma apenas lotes ativos com estoque', () => {
    expect(ingressosRestantes([lote(10, 100, 40), lote(10, 50, 50), lote(10, 30, 0, false)])).toBe(60);
  });
});

describe('eventoJaPassou / situacaoEvento', () => {
  const futuro = new Date(AGORA + 3 * DIA).toISOString();

  it('considera cancelado e encerrado como passados', () => {
    expect(eventoJaPassou({ status: 'cancelado', data_evento: futuro }, AGORA)).toBe(true);
    expect(eventoJaPassou({ status: 'encerrado', data_evento: futuro }, AGORA)).toBe(true);
  });

  it('mantém o evento em andamento dentro da janela de 6h', () => {
    const comecouAgora = new Date(AGORA - 60_000).toISOString();
    const comecouHaMuito = new Date(AGORA - JANELA_EVENTO_EM_ANDAMENTO_MS - 60_000).toISOString();
    expect(eventoJaPassou({ status: 'publicado', data_evento: comecouAgora }, AGORA)).toBe(false);
    expect(eventoJaPassou({ status: 'publicado', data_evento: comecouHaMuito }, AGORA)).toBe(true);
  });

  it('classifica a situação comercial', () => {
    const base = { status: 'publicado', data_evento: futuro };
    expect(situacaoEvento({ ...base, lotes_ingresso: [lote(10, 100, 0)] }, AGORA)).toBe('disponivel');
    expect(situacaoEvento({ ...base, lotes_ingresso: [lote(10, 100, 85)] }, AGORA)).toBe('ultimos');
    expect(situacaoEvento({ ...base, lotes_ingresso: [lote(10, 100, 100)] }, AGORA)).toBe('esgotado');
    expect(situacaoEvento({ ...base, lotes_ingresso: [] }, AGORA)).toBe('esgotado');
    expect(situacaoEvento({ ...base, status: 'cancelado' }, AGORA)).toBe('cancelado');
    expect(situacaoEvento({ ...base, status: 'encerrado' }, AGORA)).toBe('encerrado');
  });
});

describe('partesData / rotuloContagem', () => {
  it('quebra a data em dia e mês', () => {
    const p = partesData('2026-03-07T22:00:00');
    expect(p.dia).toBe('07');
    expect(p.mes).toMatch(/^MAR/);
  });
  it('lida com data inválida', () => {
    expect(partesData('xx').dia).toBe('--');
    expect(rotuloContagem('xx', AGORA)).toBeNull();
  });
  it('gera rótulos relativos', () => {
    expect(rotuloContagem(new Date(AGORA + 2 * 3600_000).toISOString(), AGORA)).toBe('Hoje');
    expect(rotuloContagem(new Date(AGORA + DIA).toISOString(), AGORA)).toBe('Amanhã');
    expect(rotuloContagem(new Date(AGORA + 5 * DIA).toISOString(), AGORA)).toBe('Em 5 dias');
    expect(rotuloContagem(new Date(AGORA + 40 * DIA).toISOString(), AGORA)).toBeNull();
    expect(rotuloContagem(new Date(AGORA - 2 * DIA).toISOString(), AGORA)).toBeNull();
  });
});

describe('normalizarSorteio', () => {
  it('converte numéricos e achata a relação da atlética', () => {
    const s = normalizarSorteio({
      id: '1',
      atletica_id: 'a',
      titulo: 'Rifa',
      subtitulo: null,
      descricao: '',
      premio_principal: 'Caixa de som',
      premios_secundarios: null as unknown as string[],
      valor_cota: '5.50' as unknown as number,
      total_cotas: '100' as unknown as number,
      cotas_vendidas: '7' as unknown as number,
      data_sorteio: '2026-12-01T20:00:00Z',
      status: 'ativo',
      destaque: false,
      imagem_url: null,
      regulamento: null,
      forma_apuracao: null,
      ganhador_nome: null,
      ganhador_bilhete: null,
      ganhador_cidade: null,
      apurado_em: null,
      criado_em: '',
      atualizado_em: '',
      atletica: [{ id: 'a', nome: 'Cinética', chave_pix: null, whatsapp: null, instagram: null, logo_url: null }],
    });
    expect(s.valor_cota).toBe(5.5);
    expect(s.total_cotas).toBe(100);
    expect(s.cotas_vendidas).toBe(7);
    expect(s.premios_secundarios).toEqual([]);
    expect(s.atletica?.nome).toBe('Cinética');
  });
});
