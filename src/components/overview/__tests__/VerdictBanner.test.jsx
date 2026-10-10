import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VerdictBanner from '../VerdictBanner';

const ctx = { currency: 'BRL', period: { period: 'last_30d', days: 30 } };
const verdict = (status, extra = {}) => ({ status, basis: 'comparison', indicator: 'cpa', insufficientReason: null, reasons: [], highlights: [], actions: [], ...extra });
const mount = (v, scopeLabel = 'Meta Ads · todas as campanhas') => render(<VerdictBanner verdict={v} scopeLabel={scopeLabel} ctx={ctx} />);

describe('VerdictBanner', () => {
  it('is a live region with a title and the scope', () => {
    mount(verdict('good'));
    const region = screen.getByRole('region', { name: 'Como estão seus anúncios' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(within(region).getByText('Meta Ads · todas as campanhas')).toBeInTheDocument();
  });

  it.each([
    ['good', 'Seus anúncios estão melhores que os 30 dias anteriores.'],
    ['stable', 'Seus anúncios estão estáveis em relação aos 30 dias anteriores.'],
  ])('shows the %s headline', (status, text) => {
    mount(verdict(status));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('shows the attention headline and its reasons', () => {
    mount(verdict('attention', { basis: 'goal', reasons: [{ code: 'cost_above_goal', params: { value: 52, goal: 40 } }] }));
    expect(screen.getByText('Atenção: o custo por resultado está acima da sua meta.')).toBeInTheDocument();
    expect(screen.getByText(/Cada resultado custa R\$\s52,00, acima da sua meta de R\$\s40,00\./)).toBeInTheDocument();
  });

  it('explains why there is no verdict', () => {
    mount(verdict('insufficient', { basis: 'none', insufficientReason: 'low_volume' }));
    expect(screen.getByText('Poucos dados para avaliar ainda. Os números abaixo já aparecem.')).toBeInTheDocument();
  });

  it('marks the status with a hidden icon and a visible text label, never color alone', () => {
    const { container } = mount(verdict('attention', { basis: 'goal', reasons: [{ code: 'cost_above_goal', params: { value: 52, goal: 40 } }] }));
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('offers to explain the verdict and each reason only when asked to', () => {
    const open = vi.fn();
    const v = verdict('attention', { basis: 'goal', reasons: [{ code: 'cost_above_goal', params: { value: 80, goal: 50 } }, { code: 'ctr_below_min', params: { ctr: 0.5, min: 1 } }] });
    const { unmount } = render(<VerdictBanner verdict={v} scopeLabel="x" ctx={ctx} />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    render(<VerdictBanner verdict={v} scopeLabel="x" ctx={ctx} explain={{ open }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explicar: Como estão seus anúncios' }));
    expect(open).toHaveBeenLastCalledWith({ kind: 'verdict' });
    const [first, second] = within(screen.getByRole('list')).getAllByRole('listitem');
    fireEvent.click(within(first).getByRole('button'));
    expect(open).toHaveBeenLastCalledWith({ kind: 'reason', code: 'cost_above_goal' });
    fireEvent.click(within(second).getByRole('button'));
    expect(open).toHaveBeenLastCalledWith({ kind: 'reason', code: 'ctr_below_min' });
  });
});
