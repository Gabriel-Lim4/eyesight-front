import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import api, { logout } from '../api';

function unauthorized(config, data = {}) {
  throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, { status: 401, data, config });
}
const success = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data });
beforeEach(() => { localStorage.clear(); });
describe('session renewal', () => {
  it('renews parallel expired requests only once and retries with rotated token', async () => {
    localStorage.setItem('token', 'old'); localStorage.setItem('refreshToken', 'refresh-old');
    let refreshes = 0;
    api.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') { refreshes++; await new Promise(resolve => setTimeout(resolve, 10)); return success(config, { token: 'new', refreshToken: 'refresh-new' }); }
      if (config.headers.Authorization === 'Bearer old') return unauthorized(config);
      return success(config, { ok: true });
    };
    const results = await Promise.all([api.get('/auth/me'), api.get('/metricas/geral')]);
    expect(refreshes).toBe(1); expect(results.every(result => result.data.ok)).toBe(true);
    expect(localStorage.getItem('refreshToken')).toBe('refresh-new');
  });
  it('platform reauthorization does not destroy the Eyesight session', async () => {
    localStorage.setItem('token', 'valid');
    api.defaults.adapter = config => unauthorized(config, { acao: 'reconectar' });
    await expect(api.get('/meta/campanhas')).rejects.toThrow();
    expect(localStorage.getItem('token')).toBe('valid');
  });
  it('temporary refresh outage preserves credentials', async () => {
    localStorage.setItem('token', 'old'); localStorage.setItem('refreshToken', 'refresh-old');
    api.defaults.adapter = async config => {
      if (config.url === '/auth/refresh') throw new axios.AxiosError('Network unavailable', 'ERR_NETWORK', config);
      return unauthorized(config);
    };
    await expect(api.get('/auth/me')).rejects.toThrow('Network unavailable');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-old');
  });
  it('leaving demonstration preserves the signed-in real account', async () => {
    localStorage.setItem('eyesight-demo', '1'); localStorage.setItem('token', 'real');
    const adapter = vi.fn(); api.defaults.adapter = adapter;
    await logout();
    expect(adapter).not.toHaveBeenCalled(); expect(localStorage.getItem('token')).toBe('real');
    expect(localStorage.getItem('eyesight-demo')).toBeNull();
  });
});
