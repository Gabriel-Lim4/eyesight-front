import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsWorkspace from '../AnalyticsWorkspace';
import api from '../../services/api';
import { GOAL_FIELDS, GOALS_COPY } from '../../utils/goalsCopy';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <svg>{children}</svg>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
const values = spend => ({ spend, impressions: 1000, clicks: 10, ctr: 1, cpc: spend / 10, cpm: spend, conversions: 1, revenue: null, roas: null, cpa: spend });
const fixture = {
  period: { since: '2026-09-01', until: '2026-09-30', previousSince: '2026-08-02', previousUntil: '2026-08-31' },
  currency: 'BRL', currencies: ['BRL'], hasData: true, lastSyncedAt: '2026-09-30T12:00:00Z',
  totals: values(100), currentComplete: true, previousComplete: false, changes: {}, previousTotals: null,
  daily: [{ date: '2026-09-01', complete: true, ...values(100) }],
  availableCampaigns: [{ id: 1, name: 'Campaign A' }],
  campaigns: [{ id: 1, name: 'Campaign A', platform: 'meta', status: 'ACTIVE', hasData: true, complete: true, metrics: values(100) }],
  alerts: [], warnings: [],
};
const mount = props => render(<MemoryRouter><AnalyticsWorkspace platform="all" {...props} /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: fixture }); });

it('reports each successful load through onData', async () => {
  const onData = vi.fn();
  mount({ onData });
  await waitFor(() => expect(onData).toHaveBeenCalledTimes(1));
  expect(onData.mock.calls[0][0]).toMatchObject({ hasData: true, lastSyncedAt: '2026-09-30T12:00:00Z' });
});

it('reloads analytics when reloadToken changes', async () => {
  const onData = vi.fn();
  const { rerender } = mount({ onData, reloadToken: 0 });
  await waitFor(() => expect(onData).toHaveBeenCalledTimes(1));
  rerender(<MemoryRouter><AnalyticsWorkspace platform="all" onData={onData} reloadToken={1} /></MemoryRouter>);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(onData).toHaveBeenCalledTimes(2));
});

it('reports a failed load through onError instead of onData', async () => {
  api.get.mockRejectedValue({ response: { data: { erro: 'Serviço indisponível.' } } });
  const onData = vi.fn(); const onError = vi.fn();
  mount({ onData, onError });
  expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível.');
  expect(onData).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledTimes(1);
});

it('works without the optional props', async () => {
  mount();
  expect(await screen.findByRole('row', { name: /Campaign A/ })).toBeInTheDocument();
});

describe('metas na análise completa', () => {
  const openGoals = async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Suas metas/ }));
  };

  it('abre o formulário com o mesmo nome e os mesmos rótulos da Visão geral', async () => {
    await openGoals();
    expect(screen.getByRole('button', { name: /Suas metas/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: GOALS_COPY.title })).toBeInTheDocument();
    for (const [, label] of GOAL_FIELDS) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: GOALS_COPY.save })).toBeInTheDocument();
    expect(screen.getByText(GOALS_COPY.help)).toBeInTheDocument();
  });

  it('salva as metas e confirma com o texto de Metas, não com o do servidor', async () => {
    api.put.mockResolvedValue({ data: { mensagem: 'Limites salvos. Os alertas aparecem no painel ao consultar as métricas.' } });
    await openGoals();
    fireEvent.change(screen.getByLabelText(GOAL_FIELDS[0][1]), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: GOALS_COPY.save }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/metricas/alertas', { ctrMin: null, cpaMax: 45, budgetMax: null }));
    expect(await screen.findByText(GOALS_COPY.saved)).toBeInTheDocument();
    expect(screen.queryByText(/Limites salvos/)).toBeNull();
  });

  it('mostra a mensagem de erro de Metas quando o servidor não explica', async () => {
    api.put.mockRejectedValue(new Error('offline'));
    await openGoals();
    fireEvent.click(screen.getByRole('button', { name: GOALS_COPY.save }));
    expect(await screen.findByRole('alert')).toHaveTextContent(GOALS_COPY.error);
  });
});

describe('overview mode', () => {
  const withVerdict = overrides => ({ ...fixture, verdict: { status: 'good', basis: 'comparison', indicator: 'cpa', insufficientReason: null, reasons: [], highlights: [], actions: [] }, ...overrides });
  const summary = ctx => <p>resumo {String(ctx.data.hasData)}</p>;
  const mountOverview = (overview = summary) => render(<MemoryRouter><AnalyticsWorkspace platform="all" overview={overview} /></MemoryRouter>);
  const detailsEl = () => screen.getByText('Ver análise completa').closest('details');
  beforeEach(() => { localStorage.clear(); api.get.mockResolvedValue({ data: withVerdict() }); });

  it('shows the summary first, the plain controls, and the full analysis collapsed', async () => {
    mountOverview();
    expect(await screen.findByText('resumo true')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar dados' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sincronizar dados' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Suas metas/ })).toBeNull();
    expect(detailsEl()).not.toHaveAttribute('open');
    expect(detailsEl().contains(screen.getByLabelText('Período'))).toBe(false);
    for (const inside of [screen.getByLabelText('Plataforma'), screen.getByLabelText('Campanha'), screen.getByRole('button', { name: 'Exportar CSV' }), screen.getByText('Evolução diária')]) {
      expect(detailsEl().contains(inside)).toBe(true);
    }
    expect(screen.getByText('resumo true').compareDocumentPosition(detailsEl()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('refreshes the data from the plain button and reloads', async () => {
    api.post.mockResolvedValue({ data: { mensagem: 'ok', results: [] } });
    mountOverview();
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar dados' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/metricas/sincronizar', { periodo: 'last_30d', platform: 'all' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('remembers whether the full analysis was opened', async () => {
    const { unmount } = mountOverview();
    await screen.findByText('resumo true');
    detailsEl().open = true;
    fireEvent(detailsEl(), new Event('toggle'));
    expect(localStorage.getItem('eyesight-advanced-open')).toBe('1');
    unmount();
    mountOverview();
    await screen.findByText('resumo true');
    expect(detailsEl()).toHaveAttribute('open');
  });

  it('still works when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    mountOverview();
    expect(await screen.findByText('resumo true')).toBeInTheDocument();
    detailsEl().open = true;
    expect(() => fireEvent(detailsEl(), new Event('toggle'))).not.toThrow();
    vi.restoreAllMocks();
  });

  it('lets the summary reload the data', async () => {
    mountOverview(ctx => <button onClick={ctx.reload}>recarregar</button>);
    fireEvent.click(await screen.findByRole('button', { name: 'recarregar' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('opens the full analysis when the API sent no verdict', async () => {
    api.get.mockResolvedValue({ data: fixture });
    mountOverview();
    await screen.findByText('resumo true');
    expect(detailsEl()).toHaveAttribute('open');
  });

  it('keeps the empty state and, inside the opened block, the filters that can undo it', async () => {
    api.get.mockResolvedValue({ data: withVerdict({ hasData: false, campaigns: [], daily: [] }) });
    mountOverview();
    expect(await screen.findByText('Seus resultados começam aqui')).toBeInTheDocument();
    expect(screen.queryByText(/resumo/)).toBeNull();
    expect(detailsEl()).toHaveAttribute('open');
    expect(detailsEl().contains(screen.getByLabelText('Plataforma'))).toBe(true);
  });

  it('keeps the filters reachable after a filter returns an error', async () => {
    mountOverview();
    await screen.findByText('resumo true');
    api.get.mockRejectedValue({ response: { data: { erro: 'Serviço indisponível.' } } });
    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'google' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível.');
    expect(detailsEl()).toHaveAttribute('open');
    expect(screen.getByLabelText('Plataforma')).toHaveValue('google');
  });

  it('keeps the same block mounted and open across reloads', async () => {
    mountOverview(ctx => <button onClick={() => ctx.reload()}>recarregar</button>);
    await screen.findByRole('button', { name: 'recarregar' });
    const before = detailsEl();
    before.open = true;
    fireEvent(before, new Event('toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'recarregar' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: 'recarregar' });
    expect(detailsEl()).toBe(before);
    expect(detailsEl()).toHaveAttribute('open');
  });

  it('shows the message passed to reload as a status', async () => {
    mountOverview(ctx => <button onClick={() => ctx.reload('Metas salvas.')}>salvar</button>);
    fireEvent.click(await screen.findByRole('button', { name: 'salvar' }));
    expect(await screen.findByText('Metas salvas.')).toBeInTheDocument();
    expect(screen.getByText('Metas salvas.')).toHaveAttribute('role', 'status');
  });

  it('does not remember toggles made while the block is forced open', async () => {
    api.get.mockResolvedValue({ data: fixture });
    mountOverview();
    await screen.findByText('resumo true');
    detailsEl().open = false;
    fireEvent(detailsEl(), new Event('toggle'));
    expect(localStorage.getItem('eyesight-advanced-open')).toBeNull();
  });
});
