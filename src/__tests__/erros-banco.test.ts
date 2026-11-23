import { describe, expect, it } from 'vitest';
import { ehErroPermissao, traduzirErroBanco } from '@/lib/errosBanco';

describe('traduzirErroBanco', () => {
  it('explica bloqueio de RLS (diretor sem atlética)', () => {
    const err = { code: '42501', message: 'new row violates row-level security policy for table "store_products"' };
    expect(ehErroPermissao(err)).toBe(true);
    expect(traduzirErroBanco(err)).toMatch(/permissão/);
  });

  it('reconhece RLS só pela mensagem', () => {
    expect(ehErroPermissao({ message: 'new row violates row-level security policy for table "eventos"' })).toBe(true);
  });

  it('traduz duplicidade, obrigatório, check e chave estrangeira', () => {
    expect(traduzirErroBanco({ code: '23505', message: 'duplicate key value violates unique constraint "eventos_slug_key"' })).toMatch(/nome/);
    expect(traduzirErroBanco({ code: '23502', message: 'null value in column "titulo" violates not-null constraint' })).toMatch(/titulo/);
    expect(traduzirErroBanco({ code: '23514', message: 'violates check constraint' })).toMatch(/fora do permitido/);
    expect(traduzirErroBanco({ code: '23503', message: 'violates foreign key constraint' })).toMatch(/ligado/);
  });

  it('avisa sobre banco desatualizado', () => {
    expect(traduzirErroBanco({ code: 'PGRST204', message: "Could not find the 'x' column" })).toMatch(/migra/);
    expect(traduzirErroBanco({ code: 'PGRST205' })).toMatch(/migra/);
  });

  it('cai numa mensagem útil para erros desconhecidos ou vazios', () => {
    expect(traduzirErroBanco({ message: 'algo estranho' }, 'salvar o evento')).toBe('Não foi possível salvar o evento: algo estranho');
    expect(traduzirErroBanco({})).toMatch(/Tente novamente/);
    expect(traduzirErroBanco(null)).toMatch(/Tente novamente/);
  });
});
