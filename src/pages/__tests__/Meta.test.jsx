import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Meta from '../Meta';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <svg>{children}</svg>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
const values = spend => ({ spend, impressions: 1000, clicks: 10, ctr: 1, cpc: spend / 10, cpm: spend, conversions: 1, revenue: null, roas: null, cpa: spend });
const fixture = overrides => ({
  period: { since: '2026-09-01', until: '2026-09-30', previousSince: '2026-08-02', previousUntil: '2026-08-31' },
  currency: 'BRL', currencies: ['BRL'], hasData: true, lastSyncedAt: '2026-09-30T12:00:00Z',
  totals: values(100), currentComplete: true, previousComplete: false, changes: {}, previousTotals: null,
  daily: [{ date: '2026-09-01', complete: true, ...values(100) }],
  availableCampaigns: [{ id: 1, name: 'Campaign A' }, { id: 2, name: 'Campaign B' }],
  campaigns: [
    { id: 1, name: 'Campaign A', platform: 'meta', status: 'ACTIVE', hasData: true, complete: true, metrics: values(20) },
    { id: 2, name: 'Campaign B', platform: 'meta', status: 'PAUSED', hasData: true, complete: true, metrics: values(80) },
  ], alerts: [], warnings: [], ...overrides,
});
// Concurrent suites may render charts slowly on the shared runner.
configure({ asyncUtilTimeout: 5000 });
const mount = () => render(<MemoryRouter><Meta /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: fixture() }); });

it('displays each campaign own spend and sends period/campaign filters to analytics', async () => {
  mount();
  expect(within(await screen.findByRole('row', { name: /Campaign A/ })).getByText('R$ 20,00')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Campaign B/ })).getByText('R$ 80,00')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'last_7d' } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/metricas/analytics', expect.objectContaining({ params: expect.objectContaining({ periodo: 'last_7d', platform: 'meta' }) })));
  await screen.findByRole('row', { name: /Campaign A/ });
  fireEvent.change(screen.getByLabelText('Campanha'), { target: { value: '1' } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/metricas/analytics', expect.objectContaining({ params: expect.objectContaining({ campaignId: '1', periodo: 'last_7d', platform: 'meta' }) })));
});
it('syncs the current filter then reloads stored analytics', async () => {
  api.post.mockResolvedValue({ data: { mensagem: 'Sincronização concluída.', results: [] } });
  mount(); await screen.findByRole('row', { name: /Campaign A/ });
  fireEvent.click(screen.getByRole('button', { name: 'Sincronizar dados' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/metricas/sincronizar', { periodo: 'last_30d', platform: 'meta' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
});
it('reports errors with retry without claiming the account is disconnected', async () => {
  api.get.mockRejectedValueOnce({ response: { data: { erro: 'Serviço indisponível.' } } });
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível.');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('row', { name: /Campaign A/ })).toBeInTheDocument();
});
it('provides an honest empty state and disables export without data', async () => {
  api.get.mockResolvedValue({ data: fixture({ hasData: false, campaigns: [], daily: [] }) });
  mount(); expect(await screen.findByText('Seus resultados começam aqui')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  expect(screen.getByRole('link', { name: /Gerenciar contas/ })).toHaveAttribute('href', '/app/account');
});
it('does not turn a partial daily collection into zero or show invalid comparisons', async () => {
  api.get.mockResolvedValue({ data: fixture({ currentComplete: false, previousComplete: true, changes: { spend: 100 }, daily: [{ date: '2026-09-01', complete: false, ...values(0) }] }) });
  mount(); await screen.findByText('Histórico diário indisponível ou incompleto. Sincronize para preencher o gráfico.');
  fireEvent.click(screen.getByText('Consultar valores diários em tabela'));
  const daily = screen.getByRole('table', { name: 'Investimento por dia' });
  const row = within(daily).getByRole('row', { name: /01\/09\/2026/ });
  expect(within(row).getByText('—')).toBeInTheDocument();
  expect(within(row).queryByText('R$ 0,00')).not.toBeInTheDocument();
  expect(screen.queryByText(/100,00% vs/)).not.toBeInTheDocument();
  expect(screen.getAllByText('Sem comparação disponível')).toHaveLength(8);
});
