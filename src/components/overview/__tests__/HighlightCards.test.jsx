import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HighlightCards from '../HighlightCards';

const ctx = { currency: 'BRL', period: { period: 'last_30d', days: 30 } };
const cards = (overrides = {}) => [
  { key: 'spend', value: 1000, change: 8, trend: 'neutral', available: true },
  { key: 'clicks', value: 500, change: 10, trend: 'better', available: true },
  { key: 'conversions', value: 25, change: 5, trend: 'better', available: true },
  { key: 'cost', value: 40, change: -15, trend: 'better', available: true },
].map(card => ({ ...card, ...(overrides[card.key] || {}) }));
const mount = (props = {}) => render(<HighlightCards highlights={cards()} indicator="cpa" basis="goal" ctx={ctx} goals={{}} {...props} />);
const card = title => screen.getByText(title).closest('li');

describe('HighlightCards', () => {
  it('lists the four cards in order with their plain-language hints', () => {
    mount();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    ['Você investiu', 'Pessoas que clicaram', 'Resultados', 'Custo por resultado'].forEach((title, index) => expect(within(items[index]).getByText(title)).toBeInTheDocument());
    expect(screen.getByText('Quanto você pagou, em média, por cada resultado.')).toBeInTheDocument();
  });

  it('describes improvements in words and never colors spend as good or bad', () => {
    mount();
    expect(within(card('Custo por resultado')).getByText('15% menos que os 30 dias anteriores')).toBeInTheDocument();
    expect(within(card('Custo por resultado')).getByText(/melhorou/i)).toBeInTheDocument();
    const spend = card('Você investiu');
    expect(within(spend).getByText('8% mais que os 30 dias anteriores')).toBeInTheDocument();
    expect(within(spend).queryByText(/melhorou|piorou/i)).toBeNull();
  });

  it('says worse and equal explicitly', () => {
    mount({ highlights: cards({ clicks: { change: -12, trend: 'worse' }, conversions: { change: 1, trend: 'stable' } }) });
    expect(within(card('Pessoas que clicaram')).getByText(/piorou/i)).toBeInTheDocument();
    expect(within(card('Resultados')).getByText(/igual/i)).toBeInTheDocument();
  });

  it('does not invent a comparison when there is no previous period', () => {
    mount({ highlights: cards({ clicks: { change: null, trend: 'unknown' }, conversions: { change: null, trend: 'unknown' }, cost: { change: null, trend: 'unknown' } }) });
    expect(within(card('Pessoas que clicaram')).getByText('Ainda sem período anterior para comparar')).toBeInTheDocument();
    expect(within(card('Pessoas que clicaram')).queryByText(/melhorou|piorou|igual/i)).toBeNull();
  });

  it('shows "Não registrado" when conversions are not tracked', () => {
    mount({ highlights: cards({ conversions: { value: null, change: null, trend: 'unknown', available: false } }) });
    const item = card('Resultados');
    expect(within(item).getByText('Não registrado')).toBeInTheDocument();
    expect(within(item).getByText(/Sua conta ainda não mede vendas ou contatos/)).toBeInTheDocument();
  });

  it('switches the cost card to cost per click', () => {
    mount({ indicator: 'cpc' });
    expect(screen.getByText('Custo por clique')).toBeInTheDocument();
    expect(screen.getByText('Quanto você paga, em média, cada vez que alguém clica.')).toBeInTheDocument();
    expect(screen.queryByText('Custo por resultado')).toBeNull();
  });

  it('shows the goal and whether the cost is within it', () => {
    const { unmount } = mount({ goals: { cpaMax: 50 } });
    expect(within(card('Custo por resultado')).getByText(/Sua meta: R\$\s50,00/)).toBeInTheDocument();
    expect(within(card('Custo por resultado')).getByText(/dentro da meta/)).toBeInTheDocument();
    unmount();
    mount({ goals: { cpaMax: 30 } });
    expect(within(card('Custo por resultado')).getByText(/acima da meta/)).toBeInTheDocument();
  });

  it('shows the goal but no verdict-like state when the verdict did not judge by goal', () => {
    mount({ goals: { cpaMax: 50 }, basis: 'none' });
    const item = card('Custo por resultado');
    expect(within(item).getByText(/Sua meta: R\$\s50,00/)).toBeInTheDocument();
    expect(within(item).queryByText(/dentro da meta|acima da meta/)).toBeNull();
  });

  it('does not show a money goal for cost per click or an unknown currency', () => {
    const { unmount } = mount({ indicator: 'cpc', goals: { cpaMax: 30 } });
    expect(screen.queryByText(/Sua meta/)).toBeNull();
    unmount();
    mount({ ctx: { ...ctx, currency: 'UNKNOWN' }, goals: { cpaMax: 30 } });
    expect(screen.queryByText(/Sua meta/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/moeda desconhecida/);
  });

  it('offers one explain button per card only when asked to', () => {
    const open = vi.fn();
    const { unmount } = mount();
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    mount({ explain: { open } });
    const items = screen.getAllByRole('listitem');
    items.forEach(item => fireEvent.click(within(item).getByRole('button')));
    expect(open.mock.calls.map(call => call[0])).toEqual(['spend', 'clicks', 'conversions', 'cost'].map(key => ({ kind: 'card', key })));
  });
});
