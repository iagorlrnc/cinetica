import { describe, it, expect } from 'vitest';
import {
  calcularProgressoCotas,
  cotasRestantes,
  montarLinkWhatsapp,
  ordenarSorteios,
  sorteioAceitaParticipacao,
  validarFormularioSorteio,
  type FormularioSorteio,
} from '@/lib/sorteios';

const FORM_OK: FormularioSorteio = {
  titulo: 'Rifa do Kit',
  subtitulo: '',
  descricao: 'Ação beneficente',
  premio_principal: 'R$ 500 no Pix',
  premios_secundarios: 'Camisa\n\n  Copo  \n',
  valor_cota: '10,50',
  total_cotas: '100',
  cotas_vendidas: '5',
  data_sorteio: '2030-01-10T20:00',
  status: 'ativo',
  destaque: true,
  imagem_url: '',
  regulamento: '',
  forma_apuracao: 'Loteria Federal',
  ganhador_nome: '',
  ganhador_bilhete: '',
  ganhador_cidade: '',
};

describe('progresso e disponibilidade', () => {
  it('calcula porcentagem com limites', () => {
    expect(calcularProgressoCotas(50, 200)).toBe(25);
    expect(calcularProgressoCotas(300, 200)).toBe(100);
    expect(calcularProgressoCotas(-5, 200)).toBe(0);
    expect(calcularProgressoCotas(1, 0)).toBe(0);
  });

  it('cotasRestantes nunca é negativo', () => {
    expect(cotasRestantes({ total_cotas: 10, cotas_vendidas: 12 })).toBe(0);
  });

  it('só aceita participação se ativo, com cotas e antes da apuração', () => {
    const agora = new Date('2030-01-01T00:00:00Z');
    const base = { status: 'ativo' as const, total_cotas: 10, cotas_vendidas: 2, data_sorteio: '2030-01-10T00:00:00Z' };
    expect(sorteioAceitaParticipacao(base, agora)).toBe(true);
    expect(sorteioAceitaParticipacao({ ...base, status: 'em_breve' }, agora)).toBe(false);
    expect(sorteioAceitaParticipacao({ ...base, cotas_vendidas: 10 }, agora)).toBe(false);
    expect(sorteioAceitaParticipacao({ ...base, data_sorteio: '2029-12-01T00:00:00Z' }, agora)).toBe(false);
  });
});

describe('montarLinkWhatsapp', () => {
  it('normaliza o número e adiciona DDI', () => {
    expect(montarLinkWhatsapp('(63) 99999-1234', 'Oi')).toBe('https://wa.me/5563999991234?text=Oi');
  });
  it('retorna null para número inválido', () => {
    expect(montarLinkWhatsapp('123', 'Oi')).toBeNull();
    expect(montarLinkWhatsapp(null, 'Oi')).toBeNull();
  });
  it('codifica a mensagem', () => {
    expect(montarLinkWhatsapp('63999991234', 'a&b=c')).toContain('text=a%26b%3Dc');
  });
});

describe('ordenarSorteios', () => {
  it('prioriza ativos, depois em breve, depois encerrados (mais recente primeiro)', () => {
    const lista = [
      { id: 'e1', status: 'encerrado' as const, destaque: false, data_sorteio: '2025-01-01' },
      { id: 'a1', status: 'ativo' as const, destaque: false, data_sorteio: '2030-02-01' },
      { id: 'e2', status: 'encerrado' as const, destaque: false, data_sorteio: '2025-06-01' },
      { id: 'b1', status: 'em_breve' as const, destaque: false, data_sorteio: '2030-03-01' },
      { id: 'a2', status: 'ativo' as const, destaque: true, data_sorteio: '2030-05-01' },
    ];
    expect(ordenarSorteios(lista).map((s) => s.id)).toEqual(['a2', 'a1', 'b1', 'e2', 'e1']);
  });
});

describe('validarFormularioSorteio', () => {
  it('normaliza um formulário válido', () => {
    const r = validarFormularioSorteio(FORM_OK);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.valor_cota).toBe(10.5);
      expect(r.dados.premios_secundarios).toEqual(['Camisa', 'Copo']);
      expect(r.dados.subtitulo).toBeNull();
      expect(r.dados.apurado_em).toBeNull();
    }
  });

  it('rejeita cotas vendidas acima do total', () => {
    const r = validarFormularioSorteio({ ...FORM_OK, cotas_vendidas: '101' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.cotas_vendidas).toBeDefined();
  });

  it('exige ganhador ao encerrar', () => {
    const r = validarFormularioSorteio({ ...FORM_OK, status: 'encerrado' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.ganhador_nome).toBeDefined();
  });

  it('rejeita imagem com esquema perigoso', () => {
    const r = validarFormularioSorteio({ ...FORM_OK, imagem_url: 'javascript:alert(1)' });
    expect(r.ok).toBe(false);
  });

  it('rejeita campos obrigatórios vazios', () => {
    const r = validarFormularioSorteio({ ...FORM_OK, titulo: 'a', premio_principal: '', total_cotas: '0', cotas_vendidas: '0', data_sorteio: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['data_sorteio', 'premio_principal', 'titulo', 'total_cotas']);
  });
});
