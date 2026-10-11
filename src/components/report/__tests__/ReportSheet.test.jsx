import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReportSheet from '../ReportSheet';

const campaign = (id, name, platform, spend, conversions) => ({
  id, name, platform, hasData: true, metrics: { spend, clicks: 100, conversions, cpa: conversions ? spend / conversions : null },
});
const data = (overrides = {}) => ({
  currency: 'BRL', hasData: true, demo: false,
  period: { period: 'last_30d', days: 30, since: '2026-09-11', until: '2026-10-10' },
  warnings: ['Coleta parcial: nem todas as campanhas têm dados.'],
  verdict: {
    status: 'attention', basis: 'goal', indicator: 'cpa', insufficientReason: null,
    reasons: [{ code: 'cost_above_goal', params: { value: 52, goal: 40 } }],
    highlights: [
      { key: 'spend', value: 1000, change: 12, trend: 'neutral', available: true },
      { key: 'clicks', value: 500, change: -5, trend: 'worse', available: true },
      { key: 'conversions', value: 20, change: 0, trend: 'stable', available: true },
      { key: 'cost', value: 50, change: 25, trend: 'worse', available: true },
    ],
    actions: [{ code: 'campaign_over_goal', params: { campaign: 'Remarketing', value: 90, goal: 40 }, campaignId: 2 }],
  },
  changeExplanation: { indicator: 'cpa', costChange: 25, main: 'cvr', factors: [{ key: 'cvr', change: -20, share: 1 }] },
  campaigns: [campaign(1, 'Coleção', 'meta', 300, 10), campaign(2, 'Remarketing', 'meta', 700, 8), { id: 3, name: 'Sem dados', platform: 'google', hasData: false, metrics: {} }],
  ...overrides,
});
const mount = (props = {}) => render(<ReportSheet data={data()} clientName="Padaria Sol" platformLabel="Todas as plataformas" generatedAt={new Date('2026-10-11T12:00:00Z')} {...props} />);

describe('ReportSheet', () => {
  it('titles the document with the client, the platform, the period and the generation date', () => {
    mount();
    const sheet = screen.getByRole('article', { name: 'Relatório de anúncios: Padaria Sol' });
    expect(within(sheet).getByRole('heading', { level: 2, name: 'Padaria Sol' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Todas as plataformas');
    expect(sheet).toHaveTextContent('11/09/2026 a 10/10/2026');
    expect(sheet).toHaveTextContent('Gerado em 11/10/2026');
  });

  it('falls back to a generic title without a client name', () => {
    mount({ clientName: '  ' });
    expect(screen.getByRole('heading', { level: 2, name: 'Relatório de anúncios' })).toBeInTheDocument();
  });

  it('shows the verdict in words, with its reasons', () => {
    mount();
    expect(screen.getByText('Atenção')).toBeInTheDocument();
    expect(screen.getByText('Atenção: o custo por resultado está acima da sua meta.')).toBeInTheDocument();
    expect(screen.getByText(/Cada resultado custa R\$\s52,00, acima da sua meta de R\$\s40,00\./)).toBeInTheDocument();
  });

  it('lists the four numbers with the change against the previous period, never by color alone', () => {
    mount();
    const numbers = screen.getByRole('region', { name: 'Números do período' });
    expect(within(numbers).getAllByRole('term').map(term => term.textContent)).toEqual(['Você investiu', 'Pessoas que clicaram', 'Resultados', 'Custo por resultado']);
    expect(numbers).toHaveTextContent(/R\$\s1\.000,00/);
    expect(numbers).toHaveTextContent('12% mais que os 30 dias anteriores');
    expect(numbers).toHaveTextContent('piorou');
  });

  it('explains why the cost changed when the server sent an explanation', () => {
    mount();
    expect(screen.getByRole('region', { name: 'Por que o custo por resultado subiu 25%?' })).toBeInTheDocument();
    const without = render(<ReportSheet data={data({ changeExplanation: null })} clientName="X" platformLabel="Meta Ads" generatedAt={new Date()} />);
    expect(within(without.container).queryByText(/Por que o custo/)).toBeNull();
  });

  it('lists what to do now', () => {
    mount();
    const actions = screen.getByRole('region', { name: 'O que fazer agora' });
    expect(actions).toHaveTextContent("A campanha 'Remarketing' está custando R$");
  });

  it('lists campaigns with data by spend, biggest first, and skips the ones without data', () => {
    mount();
    const rows = within(screen.getByRole('table', { name: 'Campanhas do período' })).getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Remarketing', 'Coleção']);
    expect(rows[0]).toHaveTextContent('Meta Ads');
  });

  it('carries the data warnings and marks demo data as fictitious', () => {
    mount({ data: data({ demo: true }) });
    expect(screen.getByText('Coleta parcial: nem todas as campanhas têm dados.')).toBeInTheDocument();
    expect(screen.getByText(/dados fictícios de demonstração/i)).toBeInTheDocument();
  });

  it('says there is nothing to report when there is no data', () => {
    mount({ data: data({ hasData: false, verdict: null, campaigns: [] }) });
    expect(screen.getByText('Não há dados neste período para montar o relatório.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
