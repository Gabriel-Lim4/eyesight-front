import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Dashboard from '../Dashboard';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <svg>{children}</svg>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
const values = spend => ({ spend, impressions: 1000, clicks: 10, ctr: 1, cpc: spend / 10, cpm: spend, conversions: 1, revenue: null, roas: null, cpa: spend });
const analytics = (hasData, lastSyncedAt) => ({
  period: { period: 'last_30d', days: 30, since: '2026-09-01', until: '2026-09-30', previousSince: '2026-08-02', previousUntil: '2026-08-31' },
  currency: 'BRL', currencies: ['BRL'], hasData, lastSyncedAt, totals: values(100), currentComplete: true, previousComplete: false,
  changes: {}, previousTotals: null, daily: hasData ? [{ date: '2026-09-01', complete: true, ...values(100) }] : [],
  availableCampaigns: [], campaigns: hasData ? [{ id: 1, name: 'Campaign A', platform: 'meta', status: 'ACTIVE', hasData: true, complete: true, metrics: values(100) }] : [],
  alerts: [], warnings: [],
  verdict: {
    status: 'good', basis: 'comparison', indicator: 'cpa', insufficientReason: null,
    reasons: [{ code: 'cost_better', params: { indicator: 'cpa', change: -15, value: 40 } }],
    highlights: [
      { key: 'spend', value: 100, change: 2, trend: 'neutral', available: true },
      { key: 'clicks', value: 10, change: 10, trend: 'better', available: true },
      { key: 'conversions', value: 1, change: 5, trend: 'better', available: true },
      { key: 'cost', value: 100, change: -15, trend: 'better', available: true },
    ],
    actions: [{ code: 'nothing_urgent', params: {} }],
  },
});
function routes({ connected = true, analyticsFor = () => analytics(true, '2026-09-30T12:00:00Z'), me = { nome: 'Ana', preferences: {} } } = {}) {
  let analyticsCalls = 0;
  api.get.mockImplementation(async url => {
    if (url === '/meta/status') return { data: { conectado: connected, configured: true } };
    if (url === '/google/status') return { data: { conectado: false, configured: true } };
    if (url === '/auth/me') { if (!me) throw new Error('down'); return { data: { usuario: me } }; }
    if (url === '/metricas/analytics') return { data: analyticsFor(++analyticsCalls) };
    throw new Error(`unexpected ${url}`);
  });
  return () => analyticsCalls;
}
const mount = url => render(<MemoryRouter initialEntries={[url]}><Dashboard /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.post.mockResolvedValue({ data: { results: [{ platform: 'meta', success: true }] } }); });

it('syncs once after OAuth, reloads the dashboard and completes the checklist', async () => {
  const calls = routes({ analyticsFor: n => (n === 1 ? analytics(false, null) : analytics(true, '2026-09-30T12:00:00Z')) });
  mount('/app?conectado=meta');
  expect(await screen.findByText('Tudo pronto! Estes são os resultados dos seus anúncios.')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/metricas/sincronizar', { periodo: 'last_30d', platform: 'meta' });
  expect(calls()).toBe(2);
});

it('offers a manual fetch for a connected account that was never synced, without auto-syncing', async () => {
  routes({ analyticsFor: () => analytics(false, null) });
  mount('/app');
  expect(await screen.findByRole('button', { name: 'Buscar meus dados' })).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

it('keeps the dashboard working when the checklist data cannot be loaded', async () => {
  routes({ me: null });
  mount('/app');
  expect(await screen.findByRole('row', { name: /Campaign A/ })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
});

it('does not show the checklist to a user who already dismissed it', async () => {
  routes({ me: { nome: 'Ana', preferences: { onboarding: { dismissed: true } } } });
  mount('/app');
  expect(await screen.findByRole('row', { name: /Campaign A/ })).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'));
  expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
});

it('keeps the fetch step running until the dashboard reload finishes after a sync', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  routes({ analyticsFor: () => analytics(false, null) });
  const base = api.get.getMockImplementation();
  api.get.mockImplementation(async url => {
    if (url === '/metricas/analytics' && ++calls === 2) { await gate; return { data: analytics(true, '2026-09-30T12:00:00Z') }; }
    return base(url);
  });
  mount('/app?conectado=meta');
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(calls).toBe(2));
  expect(screen.queryByRole('button', { name: 'Buscar meus dados' })).not.toBeInTheDocument();
  expect(screen.getByText('Buscando suas campanhas…')).toBeInTheDocument();
  release();
  expect(await screen.findByText('Tudo pronto! Estes são os resultados dos seus anúncios.')).toBeInTheDocument();
});

it('falls back to the manual fetch button when the reload after a sync fails', async () => {
  let calls = 0;
  routes({ analyticsFor: () => analytics(false, null) });
  const base = api.get.getMockImplementation();
  api.get.mockImplementation(async url => {
    if (url === '/metricas/analytics' && ++calls === 2) throw { response: { data: { erro: 'Serviço indisponível.' } } };
    return base(url);
  });
  mount('/app?conectado=meta');
  expect(await screen.findByRole('button', { name: 'Buscar meus dados' })).toBeInTheDocument();
  expect(screen.queryByText('Buscando suas campanhas…')).not.toBeInTheDocument();
});

it('shows the plain-language overview with the full analysis collapsed', async () => {
  routes();
  mount('/app');
  expect(await screen.findByText('Seus anúncios estão melhores que os 30 dias anteriores.')).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  expect(screen.getByText('Ver análise completa').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Atualizar dados' })).toBeInTheDocument();
});
