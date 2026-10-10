import { describe, expect, it } from 'vitest';
import { format, formatMoney, formatPercent } from '../format';

const plain = text => text.replace(/\s/g, ' ');

describe('format', () => {
  it('keeps the existing workspace output', () => {
    expect(plain(format(1234.5, 'money', 'BRL'))).toBe('R$ 1.234,50');
    expect(format(10, 'money', 'UNKNOWN')).toBe('10,00 (moeda desconhecida)');
    expect(format(1234.5, 'number')).toBe('1.235');
    expect(format(2.5, 'percent')).toBe('2,50%');
    expect(format(3, 'ratio')).toBe('3,00x');
    expect(format(null)).toBe('—');
    expect(format(NaN)).toBe('—');
  });
});

describe('formatMoney', () => {
  it('formats known currencies and hides the unknown-currency suffix', () => {
    expect(plain(formatMoney(1234.5, 'BRL'))).toBe('R$ 1.234,50');
    expect(formatMoney(10, 'UNKNOWN')).toBe('10,00');
  });
  it('returns a dash for missing values', () => {
    expect(formatMoney(undefined, 'BRL')).toBe('—');
    expect(formatMoney(null, 'BRL')).toBe('—');
    expect(formatMoney(Infinity, 'BRL')).toBe('—');
  });
});

describe('formatPercent', () => {
  it('rounds to at most one decimal by default', () => {
    expect(formatPercent(15)).toBe('15%');
    expect(formatPercent(4.96)).toBe('5%');
    expect(formatPercent(12.34)).toBe('12,3%');
  });
  it('accepts a custom number of digits and guards invalid values', () => {
    expect(formatPercent(4.96, 0)).toBe('5%');
    expect(formatPercent(12.34, 2)).toBe('12,34%');
    expect(formatPercent(NaN)).toBe('—');
    expect(formatPercent(null)).toBe('—');
  });
});
