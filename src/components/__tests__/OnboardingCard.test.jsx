import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingCard from '../OnboardingCard';
import api from '../../services/api';
import { startOAuth } from '../../services/oauth';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/oauth', () => ({ startOAuth: vi.fn(), oauthErrorMessage: error => error.message }));

const off = { conectado: false, configured: true };
const on = { conectado: true, configured: true, account_name: 'Conta' };
const retry = vi.fn();
const idle = { state: 'idle', message: '', retry };
function setup({ meta = off, google = off, preferences = {}, hasData = false, lastSyncedAt = null, sync = idle } = {}) {
  api.get.mockImplementation(async url => {
    if (url === '/meta/status') return { data: meta };
    if (url === '/google/status') return { data: google };
    if (url === '/auth/me') return { data: { usuario: { nome: 'Ana', preferences } } };
    throw new Error(`unexpected ${url}`);
  });
  return render(<MemoryRouter><OnboardingCard hasData={hasData} lastSyncedAt={lastSyncedAt} sync={sync} /></MemoryRouter>);
}
const item = title => screen.getByText(title).closest('li');
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.put.mockResolvedValue({ data: {} }); });

describe('OnboardingCard steps', () => {
  it('starts with every step pending and offers the connect buttons and the demo', async () => {
    setup();
    expect(await screen.findByRole('region', { name: 'Primeiros passos' })).toBeInTheDocument();
    expect(within(item('Conectar sua conta de anúncios')).getByText('Pendente')).toBeInTheDocument();
    expect(within(item('Buscar seus dados')).getByText('Pendente')).toBeInTheDocument();
    expect(within(item('Ver seu primeiro resultado')).getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver com dados de exemplo' })).toHaveAttribute('href', '/demo');
    fireEvent.click(screen.getByRole('button', { name: 'Conectar Meta Ads' }));
    expect(startOAuth).toHaveBeenCalledWith('meta');
  });

  it('shows the OAuth start failure as an alert', async () => {
    startOAuth.mockRejectedValue(new Error('Integração ainda não configurada pelo administrador.'));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Google Ads' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Integração ainda não configurada pelo administrador.');
  });

  it('replaces the button when the platform integration is not configured', async () => {
    setup({ meta: { conectado: false, configured: false } });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(screen.queryByRole('button', { name: 'Conectar Meta Ads' })).not.toBeInTheDocument();
    expect(screen.getByText('Integração ainda não configurada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar Google Ads' })).toBeInTheDocument();
  });

  it('offers a manual fetch when connected but never synced', async () => {
    setup({ meta: on });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(within(item('Conectar sua conta de anúncios')).getByText('Concluído')).toBeInTheDocument();
    expect(within(item('Buscar seus dados')).getByText('Pendente')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver com dados de exemplo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar meus dados' }));
    expect(retry).toHaveBeenCalledWith();
  });

  it('announces the running sync', async () => {
    setup({ meta: on, sync: { ...idle, state: 'running' } });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(within(item('Buscar seus dados')).getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Buscando suas campanhas…').closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('shows the sync error with retry and a link to the connections', async () => {
    setup({ meta: on, sync: { ...idle, state: 'error', message: 'Reconecte sua conta para continuar.' } });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(within(item('Buscar seus dados')).getByText('Com erro')).toBeInTheDocument();
    expect(screen.getByText('Reconecte sua conta para continuar.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Ver conexões' })).toHaveAttribute('href', '/app/account');
  });

  it('explains a synced account without active campaigns instead of failing', async () => {
    setup({ meta: on, lastSyncedAt: '2026-09-30T12:00:00Z', hasData: false });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(within(item('Buscar seus dados')).getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByText('Sua conta não tem campanhas com atividade neste período. Quando tiver, elas aparecem aqui.')).toBeInTheDocument();
    expect(screen.queryByText('Tudo pronto! Estes são os resultados dos seus anúncios.')).not.toBeInTheDocument();
  });

  it('reopens the steps when the account was disconnected', async () => {
    setup({ lastSyncedAt: '2026-09-30T12:00:00Z', hasData: true });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(within(item('Conectar sua conta de anúncios')).getByText('Pendente')).toBeInTheDocument();
    expect(within(item('Buscar seus dados')).queryByText('Concluído')).not.toBeInTheDocument();
  });

  it('shows a partial-success warning from the sync', async () => {
    setup({ meta: on, hasData: true, lastSyncedAt: 'x', sync: { ...idle, message: 'Reconecte sua conta para continuar.' } });
    expect(await screen.findByRole('status')).toHaveTextContent('Reconecte sua conta para continuar.');
  });
});

describe('OnboardingCard completion', () => {
  it('celebrates, suggests the other platform and persists the dismissal', async () => {
    setup({ meta: on, hasData: true, lastSyncedAt: '2026-09-30T12:00:00Z' });
    expect(await screen.findByText('Tudo pronto! Estes são os resultados dos seus anúncios.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conectar Google Ads também' })).toHaveAttribute('href', '/app/account');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', { nome: 'Ana', preferences: { onboarding: { dismissed: true } } }));
  });

  it('suggests Meta when only Google is connected', async () => {
    setup({ google: on, hasData: true, lastSyncedAt: 'x' });
    expect(await screen.findByRole('link', { name: 'Conectar Meta Ads também' })).toBeInTheDocument();
  });

  it('does not suggest anything when both platforms are connected', async () => {
    setup({ meta: on, google: on, hasData: true, lastSyncedAt: 'x' });
    await screen.findByText('Tudo pronto! Estes são os resultados dos seus anúncios.');
    expect(screen.queryByRole('link', { name: /também/ })).not.toBeInTheDocument();
  });

  it('hides the card even when saving the dismissal fails', async () => {
    api.put.mockRejectedValue(new Error('offline'));
    setup({ meta: on, hasData: true, lastSyncedAt: 'x' });
    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('OnboardingCard visibility', () => {
  it('renders nothing when it was already dismissed', async () => {
    const { container } = setup({ preferences: { onboarding: { dismissed: true } } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when a status request fails', async () => {
    api.get.mockImplementation(async url => {
      if (url === '/meta/status') throw new Error('down');
      return { data: url === '/auth/me' ? { usuario: { nome: 'Ana', preferences: {} } } : off };
    });
    const { container } = render(<MemoryRouter><OnboardingCard hasData={false} lastSyncedAt={null} sync={idle} /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/meta/status'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing until the dashboard data is known', async () => {
    const { container } = setup({ hasData: null });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing and calls nothing in demo mode', () => {
    localStorage.setItem('eyesight-demo', '1');
    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('OnboardingCard weekly summary offer', () => {
  const done = { meta: on, hasData: true, lastSyncedAt: '2026-10-06T12:00:00Z' };
  it('offers the weekly summary after the first result and turns it on', async () => {
    setup(done);
    expect(await screen.findByText('Quer receber um resumo toda segunda-feira?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ligar o resumo semanal' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', { nome: 'Ana', preferences: { summary: { weekly: true } } }));
    expect(await screen.findByText('Resumo ligado. Você pode desligar em Meu perfil.')).toBeInTheDocument();
    expect(screen.queryByText('Quer receber um resumo toda segunda-feira?')).toBeNull();
  });
  it('does not offer it when it is already on or before the first result', async () => {
    setup({ ...done, preferences: { summary: { weekly: true } } });
    await screen.findByText('Tudo pronto! Estes são os resultados dos seus anúncios.');
    expect(screen.queryByText('Quer receber um resumo toda segunda-feira?')).toBeNull();
  });
  it('does not offer it before the first result', async () => {
    setup({ meta: on, hasData: false });
    await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(screen.queryByText('Quer receber um resumo toda segunda-feira?')).toBeNull();
  });
  it('keeps the offer when saving fails', async () => {
    api.put.mockRejectedValueOnce(new Error('offline'));
    setup(done);
    fireEvent.click(await screen.findByRole('button', { name: 'Ligar o resumo semanal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ligar agora. Tente de novo em Meu perfil.');
    expect(screen.getByRole('button', { name: 'Ligar o resumo semanal' })).toBeInTheDocument();
  });
});
