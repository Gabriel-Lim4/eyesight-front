import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SimpleOverview from '../SimpleOverview';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { put: vi.fn(), get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const verdict = overrides => ({
  status: 'good', basis: 'comparison', indicator: 'cpa', insufficientReason: null,
  reasons: [{ code: 'cost_better', params: { indicator: 'cpa', change: -15, value: 40 } }],
  highlights: [
    { key: 'spend', value: 1000, change: 2, trend: 'neutral', available: true },
    { key: 'clicks', value: 500, change: 10, trend: 'better', available: true },
    { key: 'conversions', value: 25, change: 5, trend: 'better', available: true },
    { key: 'cost', value: 40, change: -15, trend: 'better', available: true },
  ],
  actions: [{ code: 'nothing_urgent', params: {} }], ...overrides,
});
const data = overrides => ({
  currency: 'BRL', period: { period: 'last_30d', days: 30 }, hasData: true,
  availableCampaigns: [{ id: 7, name: 'Promoção de Natal', platform: 'meta' }], verdict: verdict(), ...overrides,
});
const mount = (props = {}) => render(<MemoryRouter><SimpleOverview data={data()} filters={{ platform: 'all' }} alertSettings={{ cpaMax: 50 }} reload={vi.fn()} {...props} /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.put.mockResolvedValue({ data: {} }); api.get.mockResolvedValue({ data: { configured: true } }); api.post.mockResolvedValue({ data: { conversation: { id: 'c1', messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'Resposta da IA' }] } } }); });

describe('SimpleOverview', () => {
  it('composes the verdict, the four cards, the next actions and the goals', () => {
    mount();
    expect(screen.getByRole('region', { name: 'Como estão seus anúncios' })).toBeInTheDocument();
    expect(screen.getByText('Seus anúncios estão melhores que os 30 dias anteriores.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Você investiu', 'Pessoas que clicaram', 'Resultados', 'Custo por resultado']);
    expect(screen.getByRole('heading', { name: 'O que fazer agora' })).toBeInTheDocument();
    expect(screen.getByText('Suas metas')).toBeInTheDocument();
    expect(screen.getByText(/Sua meta: R\$\s50,00/)).toBeInTheDocument();
    expect(screen.queryByText(/dentro da meta|acima da meta/)).toBeNull();
  });

  it('explains why the cost changed only when the server sent an explanation', () => {
    const explanation = { indicator: 'cpa', costChange: 25, main: 'cvr', factors: [{ key: 'cvr', change: -20, share: 1 }] };
    const { unmount } = mount({ data: data({ changeExplanation: explanation }) });
    expect(screen.getByRole('region', { name: 'Por que o custo por resultado subiu 25%?' })).toBeInTheDocument();
    unmount();
    mount({ data: data({ changeExplanation: null }) });
    expect(screen.queryByText(/Por que o custo/)).toBeNull();
  });

  it('shows whether the cost is within the goal when the verdict judged by goal', () => {
    mount({ data: data({ verdict: verdict({ basis: 'goal', reasons: [{ code: 'cost_within_goal', params: { value: 40, goal: 50 } }] }) }) });
    expect(screen.getByText(/dentro da meta/)).toBeInTheDocument();
  });

  it('labels the scope by platform and campaign', () => {
    const { unmount } = mount();
    expect(screen.getByText('Todas as plataformas · todas as campanhas')).toBeInTheDocument();
    unmount();
    mount({ filters: { platform: 'meta', campaignId: '7' } });
    expect(screen.getByText('Meta Ads · Promoção de Natal')).toBeInTheDocument();
  });

  it('degrades to a short message when there is no verdict', () => {
    mount({ data: data({ verdict: null }) });
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível montar o resumo agora.');
    expect(screen.queryByRole('region', { name: 'Como estão seus anúncios' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('warns once about an unknown currency without repeating it on the values', () => {
    mount({ data: data({ currency: 'UNKNOWN' }) });
    expect(screen.getAllByText('Não conseguimos identificar a moeda da sua conta.')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/moeda desconhecida/);
  });

  it('reloads the overview after saving goals and asks for a visible confirmation', async () => {
    const reload = vi.fn();
    mount({ reload });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar metas' }));
    await waitFor(() => expect(reload).toHaveBeenCalledWith('Metas salvas.'));
  });

  it('names the currency in the scope when the account has several', () => {
    mount({ data: data({ currencies: ['BRL', 'USD'], currency: 'USD' }) });
    expect(screen.getByText('Todas as plataformas · todas as campanhas · USD')).toBeInTheDocument();
  });

  it('still renders when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => mount()).not.toThrow();
    expect(screen.getByRole('region', { name: 'Como estão seus anúncios' })).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('disables the goals in demo mode', () => {
    localStorage.setItem('eyesight-demo', '1');
    mount();
    expect(screen.getByRole('button', { name: 'Salvar metas' })).toBeDisabled();
    expect(within(screen.getByText('Suas metas').closest('details')).getByText('Na demonstração as metas não podem ser alteradas.')).toBeInTheDocument();
  });

  it('shows no explain button until the AI status is known, then enables them', async () => {
    let finish;
    api.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    mount();
    expect(screen.queryByRole('button', { name: /^Explicar/ })).toBeNull();
    finish({ data: { configured: true } });
    expect(await screen.findByRole('button', { name: 'Explicar: Como estão seus anúncios' })).toBeEnabled();
  });

  it('disables the buttons and explains why once when the AI is not configured', async () => {
    api.get.mockResolvedValue({ data: { configured: false } });
    mount();
    const buttons = await screen.findAllByRole('button', { name: /^Explicar/ });
    buttons.forEach(button => expect(button).toBeDisabled());
    expect(screen.getAllByText('Assistente indisponível no momento.')).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleDescription('Assistente indisponível no momento.');
  });

  it('opens the panel for the verdict, asks a suggested question and shows the answer', async () => {
    mount({ filters: { platform: 'all', periodo: 'last_30d' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Explicar: Como estão seus anúncios' }));
    const dialog = screen.getByRole('dialog', { name: 'Como estão seus anúncios' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'O que devo fazer primeiro?' }));
    expect(await within(dialog).findByText('Resposta da IA')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ia/chat', { message: 'O que devo fazer primeiro?', focus: { kind: 'verdict' }, platform: 'all', periodo: 'last_30d' }, { timeout: 55000 });
  });

  it('closes the panel when the filters change', async () => {
    const props = { data: data(), alertSettings: { cpaMax: 50 }, reload: vi.fn() };
    const view = render(<MemoryRouter><SimpleOverview {...props} filters={{ platform: 'all' }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Explicar: Como estão seus anúncios' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    view.rerender(<MemoryRouter><SimpleOverview {...props} filters={{ platform: 'meta' }} /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows no explain button when there is no verdict', async () => {
    mount({ data: data({ verdict: null }) });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /^Explicar/ })).toBeNull();
  });

  const withAction = overrides => ({ data: data({ verdict: verdict({ actions: [{ code: 'enable_conversion_tracking', params: {} }] }) }), ...overrides });
  const routeGet = planos => api.get.mockImplementation(async url => {
    if (url === '/ia/planos') return planos();
    return { data: { configured: true } };
  });
  const stored = (done = false) => ({ id: 'p1', actionKey: 'enable_conversion_tracking:-', actionCode: 'enable_conversion_tracking', campaignId: null, generatedAt: '2026-10-08T12:00:00Z',
    steps: [{ id: 's1', text: 'Abra as configurações', done }, { id: 's2', text: 'Ative as conversões', done: false }, { id: 's3', text: 'Confira em alguns dias', done: false }] });

  it('generates a step by step for an action and lets the user tick a step', async () => {
    routeGet(async () => ({ data: { planos: [] } }));
    api.post.mockResolvedValue({ data: { plano: stored() } });
    api.patch.mockResolvedValue({ data: { plano: stored(true) } });
    mount(withAction({ filters: { platform: 'all', periodo: 'last_30d' } }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver passo a passo' }));
    expect(await screen.findByRole('checkbox', { name: 'Abra as configurações' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ia/planos', { action: { code: 'enable_conversion_tracking' }, regenerate: false, platform: 'all', periodo: 'last_30d' }, { timeout: 55000 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Abra as configurações' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/ia/planos/p1/passos/s1', { done: true }));
    expect(screen.getByText('1 de 3 passos feitos')).toBeInTheDocument();
  });

  it('shows a saved plan right away', async () => {
    routeGet(async () => ({ data: { planos: [stored(true)] } }));
    mount(withAction());
    expect(await screen.findByText('1 de 3 passos feitos')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Abra as configurações' })).toBeChecked();
  });

  it('keeps the whole overview and hides the plan area when the plans cannot be loaded', async () => {
    routeGet(async () => { throw new Error('table missing'); });
    mount(withAction());
    await screen.findByRole('button', { name: 'Explicar: Como estão seus anúncios' });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ia/planos', expect.anything()));
    expect(screen.getByRole('region', { name: 'Como estão seus anúncios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que fazer agora' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver passo a passo' })).toBeNull();
  });

  it('reloads the plans when the filters change', async () => {
    routeGet(async () => ({ data: { planos: [] } }));
    const props = { ...withAction(), alertSettings: { cpaMax: 50 }, reload: vi.fn() };
    const view = render(<MemoryRouter><SimpleOverview {...props} filters={{ platform: 'all' }} /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Ver passo a passo' });
    view.rerender(<MemoryRouter><SimpleOverview {...props} filters={{ platform: 'meta' }} /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ia/planos', { params: { platform: 'meta' } }));
  });

  it('reloads the plans when the verdict actions change after a sync or a goal change', async () => {
    let calls = 0;
    api.get.mockImplementation(async url => {
      if (url !== '/ia/planos') return { data: { configured: true } };
      calls++;
      return { data: { planos: calls > 1 ? [stored(true)] : [] } };
    });
    const props = { alertSettings: { cpaMax: 50 }, reload: vi.fn(), filters: { platform: 'all' } };
    const first = withAction();
    const view = render(<MemoryRouter><SimpleOverview {...props} data={first.data} /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Ver passo a passo' });
    const next = data({ verdict: verdict({ actions: [{ code: 'enable_conversion_tracking', params: {} }, { code: 'nothing_urgent', params: {} }] }) });
    view.rerender(<MemoryRouter><SimpleOverview {...props} data={next} /></MemoryRouter>);
    expect(await screen.findByText('1 de 3 passos feitos')).toBeInTheDocument();
  });
});
