import { describe, expect, it } from 'vitest';
import { parseTerms } from '../parseTerms';
import termsText from '../../content/terms.txt?raw';

const SAMPLE = `TERMOS DE USO DO EYESIGHT

Última atualização: 14 de outubro de 2026

Texto de abertura.


1. QUEM SOMOS

1.1. Primeira cláusula que continua
na linha de baixo.

1.2. Segunda cláusula:
- item um;
- item dois
  com continuação.

========================================================================

POLÍTICA DE PRIVACIDADE DO EYESIGHT

2. QUAIS DADOS

Um parágrafo sem número.
`;

describe('parseTerms', () => {
  it('separa os dois documentos e lê título, data e abertura', () => {
    const [terms, policy] = parseTerms(SAMPLE);
    expect(terms.title).toBe('Termos de Uso do Eyesight');
    expect(terms.updated).toBe('14 de outubro de 2026');
    expect(terms.intro).toEqual([{ type: 'text', text: 'Texto de abertura.' }]);
    expect(policy.title).toBe('Política de Privacidade do Eyesight');
  });

  it('monta seções, cláusulas e listas, juntando linhas de continuação', () => {
    const [terms] = parseTerms(SAMPLE);
    expect(terms.sections).toHaveLength(1);
    expect(terms.sections[0]).toMatchObject({ number: '1', title: 'Quem Somos' });
    const [first, second, list] = terms.sections[0].blocks;
    expect(first).toEqual({ type: 'clause', number: '1.1', text: 'Primeira cláusula que continua na linha de baixo.' });
    expect(second).toEqual({ type: 'clause', number: '1.2', text: 'Segunda cláusula:' });
    expect(list).toEqual({ type: 'list', items: ['item um;', 'item dois com continuação.'] });
  });

  it('aceita parágrafo sem número dentro de uma seção', () => {
    const [, policy] = parseTerms(SAMPLE);
    expect(policy.sections[0].blocks).toEqual([{ type: 'text', text: 'Um parágrafo sem número.' }]);
  });

  it('lê o arquivo real: 2 documentos, 14 e 11 seções, nenhuma seção vazia', () => {
    const docs = parseTerms(termsText);
    expect(docs).toHaveLength(2);
    expect(docs.map(doc => doc.sections.length)).toEqual([14, 11]);
    docs.forEach(doc => doc.sections.forEach(section => expect(section.blocks.length).toBeGreaterThan(0)));
    expect(docs[0].updated).toMatch(/2026/);
  });

  it('não perde nenhuma cláusula numerada do texto original', () => {
    const original = (termsText.match(/^\d+\.\d+\./gm) || []).length;
    const parsed = parseTerms(termsText).flatMap(doc => doc.sections.flatMap(section => section.blocks)).filter(block => block.type === 'clause').length;
    expect(parsed).toBe(original);
  });

  it('texto vazio não quebra', () => {
    expect(parseTerms('')).toEqual([]);
  });
});
