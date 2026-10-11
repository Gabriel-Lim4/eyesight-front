import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Report from '../Report';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
const analytics = overrides => ({
  currency: 'BRL', hasData: true, period: { period: 'last_30d', days: 30, since: '2026-09-11', until: '2026-10-10' }, warnings: [], campaigns: [], changeExplanation: null,
  verdict: { status: 'good', basis: 'comparison', indicator: 'cpa', insufficientReason: null, reasons: [], highlights: [{ key: 'spend', value: 100, change: null, trend: 'neutral', available: true }, { key: 'clicks', value: 10, change: null, trend: 'unknown', available: true }, { key: 'conversions', value: 2, change: null, trend: 'unknown', available: true }, { key: 'cost', value: 50, change: null, trend: 'unknown', available: true }], actions: [{ code: 'nothing_urgent', params: {} }] },
  ...overrides,
});
const mount = () => render(<MemoryRouter><Report /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: analytics() }); window.print = vi.fn(); });

describe('Report page', () => {
  it('loads the last 30 days of all platforms and shows the document', async () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Relatório para o cliente' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Relatório de anúncios' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/metricas/analytics', expect.objectContaining({ params: { periodo: 'last_30d', platform: 'all' } }));
  });

  it('puts the client name in the document as you type', async () => {
    mount();
    await screen.findByRole('article');
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Padaria Sol' } });
    expect(screen.getByRole('article', { name: 'Relatório de anúncios: Padaria Sol' })).toBeInTheDocument();
  });

  it('reloads when the period or the platform changes', async () => {
    mount();
    await screen.findByRole('article');
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'last_7d' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/metricas/analytics', expect.objectContaining({ params: { periodo: 'last_7d', platform: 'all' } })));
    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'meta' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/metricas/analytics', expect.objectContaining({ params: { periodo: 'last_7d', platform: 'meta' } })));
    expect(await screen.findByText(/Meta Ads · /)).toBeInTheDocument();
  });

  it('prints through the browser, which also saves as PDF', async () => {
    mount();
    await screen.findByRole('article');
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ou salvar em PDF' }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('blocks printing while loading and explains a failure', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { erro: 'Falhou de propósito.' } } });
    mount();
    expect(screen.getByRole('button', { name: 'Imprimir ou salvar em PDF' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou de propósito.');
    expect(screen.queryByRole('article')).toBeNull();
  });
});
