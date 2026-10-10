import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import NextActions from '../NextActions';

const ctx = { currency: 'BRL', period: { period: 'last_30d', days: 30 } };
const mount = actions => render(<MemoryRouter><NextActions actions={actions} ctx={ctx} /></MemoryRouter>);

describe('NextActions', () => {
  it('titles the section and lists each action as text', () => {
    mount([{ code: 'enable_conversion_tracking', params: {} }, { code: 'refresh_data', params: { lastSyncedAt: '2026-10-06T12:00:00Z' } }]);
    expect(screen.getByRole('heading', { name: 'O que fazer agora' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Ative o acompanhamento de conversões na plataforma para ver quanto cada resultado custa.')).toBeInTheDocument();
  });

  it('offers the assistant only for campaign actions', () => {
    mount([{ code: 'campaign_without_results', params: { campaign: 'Teste B', spend: 800 }, campaignId: 7 }, { code: 'nothing_urgent', params: {} }]);
    const [campaign, calm] = screen.getAllByRole('listitem');
    expect(within(campaign).getByRole('link', { name: 'Perguntar ao assistente' })).toHaveAttribute('href', '/app/assistant');
    expect(within(calm).queryByRole('link')).toBeNull();
  });

  it('renders campaign names as plain text, never as markup', () => {
    const { container } = mount([{ code: 'campaign_without_results', params: { campaign: '<img src=x onerror=alert(1)>', spend: 10 }, campaignId: 1 }]);
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('replaces the assistant link by an explain button when asked to', () => {
    const open = vi.fn();
    render(<MemoryRouter><NextActions ctx={ctx} explain={{ open }} actions={[{ code: 'campaign_without_results', params: { campaign: 'Teste B', spend: 800 }, campaignId: 7 }, { code: 'refresh_data', params: { lastSyncedAt: null } }]} /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
    const [campaign, refresh] = screen.getAllByRole('listitem');
    fireEvent.click(within(campaign).getByRole('button'));
    expect(open).toHaveBeenLastCalledWith({ kind: 'action', code: 'campaign_without_results', campaignId: 7 });
    fireEvent.click(within(refresh).getByRole('button'));
    expect(open).toHaveBeenLastCalledWith({ kind: 'action', code: 'refresh_data' });
  });

  it('shows the step by step button only for actions that can have a plan, and only when plans are provided', () => {
    const plans = { ready: true, failed: false, planFor: () => null, stateFor: () => 'idle', errorFor: () => '', busy: false, saveError: '', generate: vi.fn(), toggle: vi.fn() };
    const actions = [{ code: 'campaign_without_results', params: { campaign: 'Teste B', spend: 800 }, campaignId: 7 }, { code: 'refresh_data', params: { lastSyncedAt: null } }, { code: 'nothing_urgent', params: {} }];
    const { unmount } = render(<MemoryRouter><NextActions ctx={ctx} actions={actions} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Ver passo a passo' })).toBeNull();
    unmount();
    render(<MemoryRouter><NextActions ctx={ctx} actions={actions} plans={plans} aiAvailable /></MemoryRouter>);
    const buttons = screen.getAllByRole('button', { name: 'Ver passo a passo' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(plans.generate).toHaveBeenCalledWith({ code: 'campaign_without_results', campaignId: 7 });
  });
});
