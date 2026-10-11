import { describe, expect, it } from 'vitest';
import { explainCostChange } from '../changeMath';

const base = { impressions: 100000, clicks: 2000, spend: 4000, conversions: 100 };

describe('changeMath (cópia para a demonstração)', () => {
  it('shares sum to 1 and the conversion rate explains a cost per result increase', () => {
    const result = explainCostChange({ ...base, conversions: 60 }, base, 'cpa');
    expect(result.main).toBe('cvr');
    expect(result.factors.reduce((sum, factor) => sum + factor.share, 0)).toBeCloseTo(1, 9);
  });

  it('returns null for small changes or missing volume', () => {
    expect(explainCostChange({ ...base, spend: 4100 }, base, 'cpc')).toBeNull();
    expect(explainCostChange({ ...base, clicks: 10 }, base, 'cpc')).toBeNull();
    expect(explainCostChange(base, null, 'cpc')).toBeNull();
  });
});
