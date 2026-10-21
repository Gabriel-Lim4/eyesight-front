import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import { useExplainer } from '../useExplainer';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const filters = { periodo: 'last_30d', platform: 'all', campaignId: undefined, currency: undefined, startDate: undefined, endDate: undefined };
const reply = (id = 'c1', text = 'Resposta') => ({ data: { conversation: { id, messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: text }] } } });
const setup = (props = filters) => renderHook(({ scope }) => useExplainer(scope), { initialProps: { scope: props } });
const ready = async result => { await waitFor(() => expect(result.current.available).not.toBeNull()); };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.get.mockResolvedValue({ data: { configured: true } }); api.post.mockResolvedValue(reply()); });

describe('useExplainer', () => {
  it('asks the status once and exposes availability', async () => {
    const { result } = setup();
    expect(result.current.available).toBeNull();
    await ready(result);
    expect(result.current.available).toBe(true);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/ia/status');
  });
  it('is unavailable when the AI is not configured or the status fails', async () => {
    api.get.mockResolvedValueOnce({ data: { configured: false } });
    const first = setup(); await ready(first.result);
    expect(first.result.current.available).toBe(false);
    api.get.mockRejectedValueOnce(new Error('off'));
    const second = setup(); await ready(second.result);
    expect(second.result.current.available).toBe(false);
  });
  it('is always available in demo mode without asking the status', () => {
    localStorage.setItem('eyesight-demo', '1');
    const { result } = setup();
    expect(result.current.available).toBe(true);
    expect(api.get).not.toHaveBeenCalled();
  });
  it('sends the question with focus and only the defined scope keys, then keeps the conversation', async () => {
    const { result } = setup({ ...filters, campaignId: 7, currency: 'BRL' });
    await ready(result);
    act(() => result.current.open({ kind: 'card', key: 'cost' }));
    let ok;
    await act(async () => { ok = await result.current.ask('Oi'); });
    expect(ok).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/ia/chat', { message: 'Oi', focus: { kind: 'card', key: 'cost' }, periodo: 'last_30d', platform: 'all', campaignId: 7, currency: 'BRL', stream: true }, expect.objectContaining({ timeout: 55000 }));
    expect(result.current.messages).toEqual([{ role: 'user', content: 'Oi' }, { role: 'assistant', content: 'Resposta' }]);
    api.post.mockResolvedValueOnce(reply('c1', 'Outra'));
    await act(async () => { await result.current.ask('E agora?'); });
    expect(api.post.mock.calls[1][1].conversationId).toBe('c1');
    expect(result.current.messages).toHaveLength(4);
    act(() => result.current.open({ kind: 'verdict' }));
    expect(result.current.messages).toEqual([]);
    await act(async () => { await result.current.ask('Nova'); });
    expect(api.post.mock.calls[2][1].conversationId).toBeUndefined();
  });
  it('reports the limit and keeps the pending question', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 429, data: { erro: 'Limite de 20 solicitações de IA por hora atingido. Tente novamente mais tarde.' } } });
    const { result } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    let ok;
    await act(async () => { ok = await result.current.ask('Oi'); });
    expect(ok).toBe(false);
    expect(result.current.state).toBe('limit');
    expect(result.current.error).toMatch(/Limite de 20/);
    expect(result.current.pendingText).toBe('Oi');
  });
  it('reports other failures as retryable errors and keeps earlier messages', async () => {
    const { result } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    await act(async () => { await result.current.ask('Primeira'); });
    api.post.mockRejectedValueOnce(new Error('network'));
    await act(async () => { await result.current.ask('Segunda'); });
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('Não foi possível completar a solicitação. Tente novamente.');
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.pendingText).toBe('Segunda');
  });
  it('sends one request even when asked twice while sending', async () => {
    let finish;
    api.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { result } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    let first, second;
    await act(async () => { first = result.current.ask('Oi'); second = result.current.ask('Oi'); });
    expect(await second).toBe(false);
    expect(result.current.state).toBe('sending');
    await act(async () => { finish(reply()); await first; });
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('closes the panel when the scope changes', async () => {
    const { result, rerender } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    expect(result.current.focus).toEqual({ kind: 'verdict' });
    rerender({ scope: { ...filters, platform: 'meta' } });
    expect(result.current.focus).toBeNull();
  });

  it('does not let a discarded request fill or fail a newer panel', async () => {
    let finish, fail;
    api.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    const { result } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    let first;
    act(() => { first = result.current.ask('Antiga'); });
    act(() => result.current.close());
    act(() => result.current.open({ kind: 'card', key: 'cost' }));
    await act(async () => { finish(reply('old', 'Resposta antiga')); await first; });
    expect(result.current.messages).toEqual([]);
    expect(result.current.state).toBe('idle');
    let second;
    act(() => { second = result.current.ask('Nova'); });
    await act(async () => { fail({ response: { status: 500, data: { erro: 'x' } } }); await second; });
    expect(api.post.mock.calls[1][1].conversationId).toBeUndefined();
    let stale;
    api.post.mockReturnValueOnce(new Promise((_, reject) => { stale = reject; }));
    let third;
    act(() => { third = result.current.ask('Mais uma'); });
    act(() => result.current.open({ kind: 'verdict' }));
    await act(async () => { stale({ response: { status: 429, data: { erro: 'Limite' } } }); await third; });
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBe('');
  });
  it('lets a new panel ask while a discarded request is still running', async () => {
    api.post.mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    act(() => { result.current.ask('Presa'); });
    rerender({ scope: { ...filters, platform: 'meta' } });
    act(() => result.current.open({ kind: 'verdict' }));
    await act(async () => { await result.current.ask('Livre'); });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(result.current.messages).toHaveLength(2);
  });
  it('does not bring a panel back when the scope returns to the original', async () => {
    const { result, rerender } = setup(); await ready(result);
    act(() => result.current.open({ kind: 'verdict' }));
    rerender({ scope: { ...filters, platform: 'meta' } });
    expect(result.current.focus).toBeNull();
    rerender({ scope: filters });
    expect(result.current.focus).toBeNull();
  });
});
