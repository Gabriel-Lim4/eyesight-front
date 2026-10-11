import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import { usePlans } from '../usePlans';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const filters = { periodo: 'last_30d', platform: 'all', campaignId: undefined, currency: undefined };
const ACTION = { code: 'campaign_over_goal', campaignId: 7 };
const steps = done => [{ id: 's1', text: 'Um', done }, { id: 's2', text: 'Dois', done: false }, { id: 's3', text: 'Três', done: false }];
const plan = (overrides = {}) => ({ id: 'p1', actionKey: 'campaign_over_goal:7', actionCode: 'campaign_over_goal', campaignId: 7, steps: steps(false), generatedAt: '2026-10-08T12:00:00Z', ...overrides });
const setup = (scope = filters, version = '') => renderHook(({ scope: value, version: key }) => usePlans(value, key), { initialProps: { scope, version } });
const ready = async result => { await waitFor(() => expect(result.current.ready).toBe(true)); };
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { planos: [plan()] } });
  api.post.mockResolvedValue({ data: { plano: plan({ id: 'p2', actionKey: 'campaign_low_ctr:3', actionCode: 'campaign_low_ctr', campaignId: 3 }) } });
  api.patch.mockImplementation(async (_url, body) => ({ data: { plano: plan({ steps: steps(body.done) }) } }));
});

describe('usePlans', () => {
  it('loads the plans with only the defined scope keys and finds them by action', async () => {
    const { result } = setup();
    expect(result.current.ready).toBe(false);
    await ready(result);
    expect(api.get).toHaveBeenCalledWith('/ia/planos', { params: { periodo: 'last_30d', platform: 'all' } });
    expect(result.current.planFor(ACTION).id).toBe('p1');
    expect(result.current.planFor({ code: 'campaign_low_ctr', campaignId: 3 })).toBeNull();
    expect(result.current.planFor({ code: 'budget_exceeded' })).toBeNull();
  });

  it('is ready with no plans when the list cannot be loaded', async () => {
    api.get.mockRejectedValueOnce(new Error('no table'));
    const { result } = setup();
    await ready(result);
    expect(result.current.planFor(ACTION)).toBeNull();
    expect(result.current.failed).toBe(true);
  });

  it('generates a plan with the scope and keeps it', async () => {
    const { result } = setup({ ...filters, campaignId: 3 });
    await ready(result);
    let ok;
    await act(async () => { ok = await result.current.generate({ code: 'campaign_low_ctr', campaignId: 3 }); });
    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/ia/planos', { action: { code: 'campaign_low_ctr', campaignId: 3 }, regenerate: false, periodo: 'last_30d', platform: 'all', campaignId: 3 }, { timeout: 55000 });
    expect(result.current.planFor({ code: 'campaign_low_ctr', campaignId: 3 }).id).toBe('p2');
    expect(result.current.stateFor({ code: 'campaign_low_ctr', campaignId: 3 })).toBe('idle');
  });

  it('regenerates and replaces the plan of the same action', async () => {
    const { result } = setup(); await ready(result);
    api.post.mockResolvedValueOnce({ data: { plano: plan({ steps: [{ id: 's1', text: 'Novo', done: false }, { id: 's2', text: 'Novo 2', done: false }, { id: 's3', text: 'Novo 3', done: false }] }) } });
    await act(async () => { await result.current.generate(ACTION, { regenerate: true }); });
    expect(api.post.mock.calls[0][1].regenerate).toBe(true);
    expect(result.current.planFor(ACTION).steps[0].text).toBe('Novo');
  });

  it('reports the hourly limit and other failures per action', async () => {
    const { result } = setup(); await ready(result);
    api.post.mockRejectedValueOnce({ response: { status: 429, data: { erro: 'Limite de 20 solicitações de IA por hora atingido. Tente novamente mais tarde.' } } });
    const other = { code: 'budget_exceeded' };
    let ok;
    await act(async () => { ok = await result.current.generate(other); });
    expect(ok).toBe(false);
    expect(result.current.stateFor(other)).toBe('limit');
    expect(result.current.errorFor(other)).toMatch(/Limite de 20/);
    api.post.mockRejectedValueOnce(new Error('network'));
    await act(async () => { await result.current.generate(other); });
    expect(result.current.stateFor(other)).toBe('error');
    expect(result.current.errorFor(other)).toBe('Não foi possível completar a solicitação. Tente novamente.');
    expect(result.current.stateFor(ACTION)).toBe('idle');
  });

  it('runs one generation at a time', async () => {
    let finish;
    api.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { result } = setup(); await ready(result);
    let first, second;
    await act(async () => { first = result.current.generate({ code: 'budget_exceeded' }); second = result.current.generate({ code: 'campaign_low_ctr', campaignId: 3 }); });
    expect(await second).toBe(false);
    expect(result.current.busy).toBe(true);
    expect(result.current.stateFor({ code: 'budget_exceeded' })).toBe('generating');
    await act(async () => { finish({ data: { plano: plan({ id: 'p3', actionKey: 'budget_exceeded:-', actionCode: 'budget_exceeded', campaignId: null }) } }); await first; });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);
  });

  it('toggles a step at once and confirms it with the server answer', async () => {
    const { result } = setup(); await ready(result);
    let pending;
    act(() => { pending = result.current.toggle('p1', 's1', true); });
    expect(result.current.planFor(ACTION).steps[0].done).toBe(true);
    await act(async () => { await pending; });
    expect(api.patch).toHaveBeenCalledWith('/ia/planos/p1/passos/s1', { done: true });
    expect(result.current.planFor(ACTION).steps[0].done).toBe(true);
    expect(result.current.saveError).toBe('');
  });

  it('reverts the step and explains when saving fails', async () => {
    api.patch.mockRejectedValueOnce(new Error('network'));
    const { result } = setup(); await ready(result);
    let ok;
    await act(async () => { ok = await result.current.toggle('p1', 's1', true); });
    expect(ok).toBe(false);
    expect(result.current.planFor(ACTION).steps[0].done).toBe(false);
    expect(result.current.saveError).toBe('Não foi possível salvar. Tente de novo.');
  });

  it('rereads the list when a concluded step has a date, to bring the follow-up, and keeps the old one meanwhile', async () => {
    const followUp = { status: 'waiting', since: '2026-10-09', daysAfter: 0, daysNeeded: 3 };
    api.get.mockResolvedValue({ data: { planos: [plan({ followUp })] } });
    api.patch.mockResolvedValueOnce({ data: { plano: plan({ steps: [{ id: 's1', text: 'Um', done: true, doneAt: '2026-10-09T10:00:00Z' }, ...steps(false).slice(1)], followUp: null }) } });
    const { result } = setup(); await ready(result);
    await act(async () => { await result.current.toggle('p1', 's1', true); });
    expect(result.current.planFor(ACTION).followUp).toEqual(followUp);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('drops the follow-up when the last concluded step is unchecked', async () => {
    const followUp = { status: 'ready', metric: 'cpa', since: '2026-10-03', daysBefore: 7, daysAfter: 6, before: 50, after: 40, changePct: -20, result: 'better' };
    api.get.mockResolvedValue({ data: { planos: [plan({ steps: [{ id: 's1', text: 'Um', done: true, doneAt: '2026-10-03T10:00:00Z' }, ...steps(false).slice(1)], followUp })] } });
    api.patch.mockResolvedValueOnce({ data: { plano: plan({ steps: steps(false), followUp: null }) } });
    const { result } = setup(); await ready(result);
    expect(result.current.planFor(ACTION).followUp).toEqual(followUp);
    await act(async () => { await result.current.toggle('p1', 's1', false); });
    expect(result.current.planFor(ACTION).followUp).toBeNull();
  });

  it('does not reread the list when the answer carries no concluded date', async () => {
    const { result } = setup(); await ready(result);
    await act(async () => { await result.current.toggle('p1', 's1', true); });
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('keeps the last choice when the same step is toggled twice quickly', async () => {
    const { result } = setup(); await ready(result);
    await act(async () => { await Promise.all([result.current.toggle('p1', 's1', true), result.current.toggle('p1', 's1', false)]); });
    expect(api.patch.mock.calls.map(call => call[1].done)).toEqual([true, false]);
    expect(result.current.planFor(ACTION).steps[0].done).toBe(false);
  });

  it('drops plans and late answers when the scope changes', async () => {
    let finish;
    api.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = setup(); await ready(result);
    let pending;
    act(() => { pending = result.current.generate({ code: 'budget_exceeded' }); });
    rerender({ scope: { ...filters, platform: 'meta' } });
    expect(result.current.planFor(ACTION)).toBeNull();
    await ready(result);
    await act(async () => { finish({ data: { plano: plan({ id: 'late', actionKey: 'budget_exceeded:-', actionCode: 'budget_exceeded', campaignId: null }) } }); await pending; });
    expect(result.current.planFor({ code: 'budget_exceeded' })).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('reloads the list when the action is no longer on the panel', async () => {
    const { result } = setup(); await ready(result);
    api.post.mockRejectedValueOnce({ response: { status: 404, data: { erro: 'Esta ação não está mais no painel.' } } });
    await act(async () => { await result.current.generate({ code: 'campaign_low_ctr', campaignId: 3 }); });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('reloads the list when the verdict actions change and keeps what it was showing', async () => {
    const { result, rerender } = setup(); await ready(result);
    api.get.mockResolvedValueOnce({ data: { planos: [plan(), plan({ id: 'p9', actionKey: 'budget_exceeded:-', actionCode: 'budget_exceeded', campaignId: null })] } });
    rerender({ scope: filters, version: 'campaign_over_goal:7|budget_exceeded:-' });
    await waitFor(() => expect(result.current.planFor({ code: 'budget_exceeded' })?.id).toBe('p9'));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(result.current.ready).toBe(true);
  });

  it('keeps the plans it has when a reload fails', async () => {
    const { result, rerender } = setup(); await ready(result);
    api.get.mockRejectedValueOnce(new Error('offline'));
    rerender({ scope: filters, version: 'x' });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(result.current.planFor(ACTION).id).toBe('p1');
    expect(result.current.failed).toBe(false);
  });

  it('keeps the generation error visible after the list reloads (action gone from the panel)', async () => {
    const { result } = setup(); await ready(result);
    api.post.mockRejectedValueOnce({ response: { status: 404, data: { erro: 'Esta ação não está mais no painel.' } } });
    const stale = { code: 'campaign_low_ctr', campaignId: 3 };
    await act(async () => { await result.current.generate(stale); });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.stateFor(stale)).toBe('error');
    expect(result.current.errorFor(stale)).toBe('Esta ação não está mais no painel.');
  });

  it('does not let a generation from another scope block the current one', async () => {
    api.post.mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = setup(); await ready(result);
    act(() => { result.current.generate({ code: 'budget_exceeded' }); });
    rerender({ scope: { ...filters, platform: 'meta' }, version: '' });
    await ready(result);
    let ok;
    await act(async () => { ok = await result.current.generate({ code: 'campaign_low_ctr', campaignId: 3 }); });
    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledTimes(2);
  });
});
