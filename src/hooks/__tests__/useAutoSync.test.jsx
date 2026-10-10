import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { useAutoSync } from '../useAutoSync';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));
const wrapper = url => ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
const setup = url => renderHook(() => ({ sync: useAutoSync(), search: useLocation().search }), { wrapper: wrapper(url) });
beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: { results: [{ platform: 'meta', success: true }] } }); });

describe('useAutoSync', () => {
  it('syncs once after returning from OAuth and cleans the url', async () => {
    const { result } = setup('/app?conectado=meta');
    await waitFor(() => expect(result.current.sync.reloadToken).toBe(1));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/metricas/sincronizar', { periodo: 'last_30d', platform: 'meta' });
    expect(result.current.sync.state).toBe('idle');
    expect(result.current.search).toBe('');
  });

  it('does not sync again when the page is mounted again with the clean url', async () => {
    const first = setup('/app?conectado=meta');
    await waitFor(() => expect(first.result.current.sync.reloadToken).toBe(1));
    first.unmount();
    setup('/app');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it.each(['x', '<script>', 'all'])('ignores the invalid value %s and cleans the url', async value => {
    const { result } = setup(`/app?conectado=${encodeURIComponent(value)}`);
    await waitFor(() => expect(result.current.search).toBe(''));
    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.sync.state).toBe('idle');
  });

  it('does nothing without the return parameter', () => {
    const { result } = setup('/app');
    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.sync).toMatchObject({ state: 'idle', message: '', reloadToken: 0 });
  });

  it('reports the backend error and recovers on retry', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { erro: 'Aguarde um minuto antes de sincronizar novamente.' } } });
    const { result } = setup('/app?conectado=google');
    await waitFor(() => expect(result.current.sync.state).toBe('error'));
    expect(result.current.sync.message).toBe('Aguarde um minuto antes de sincronizar novamente.');
    await act(() => result.current.sync.retry());
    expect(api.post).toHaveBeenLastCalledWith('/metricas/sincronizar', { periodo: 'last_30d', platform: 'all' });
    expect(result.current.sync.state).toBe('idle');
    expect(result.current.sync.reloadToken).toBe(1);
  });

  it('falls back to the per-platform errors when every platform fails', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { results: [{ success: false, error: 'Reconecte sua conta para continuar.' }] } } });
    const { result } = setup('/app?conectado=meta');
    await waitFor(() => expect(result.current.sync.state).toBe('error'));
    expect(result.current.sync.message).toBe('Reconecte sua conta para continuar.');
  });

  it('uses a generic message when the failure carries no detail', async () => {
    api.post.mockRejectedValueOnce(new Error('network'));
    const { result } = setup('/app?conectado=meta');
    await waitFor(() => expect(result.current.sync.state).toBe('error'));
    expect(result.current.sync.message).toBe('Falha na sincronização. Verifique suas contas e tente novamente.');
  });

  it('treats a partial success as success but keeps the warning', async () => {
    api.post.mockResolvedValueOnce({ data: { results: [
      { platform: 'meta', success: true },
      { platform: 'google', success: false, error: 'Reconecte sua conta para continuar.' },
    ] } });
    const { result } = setup('/app?conectado=meta');
    await waitFor(() => expect(result.current.sync.reloadToken).toBe(1));
    expect(result.current.sync.state).toBe('idle');
    expect(result.current.sync.message).toBe('Reconecte sua conta para continuar.');
  });
});
