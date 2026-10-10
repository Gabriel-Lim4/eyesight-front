import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api';
import { oauthErrorMessage, startOAuth } from '../oauth';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));

describe('oauth helper', () => {
  const assign = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('location', { ...window.location, assign });
  });

  it('redirects the browser to the https authorization url', async () => {
    api.get.mockResolvedValue({ data: { url: 'https://facebook.com/x' } });
    await startOAuth('meta');
    expect(api.get).toHaveBeenCalledWith('/meta/conectar');
    expect(assign).toHaveBeenCalledWith('https://facebook.com/x');
  });

  it('rejects a non-https or missing url without redirecting', async () => {
    api.get.mockResolvedValue({ data: { url: 'http://evil.example' } });
    await expect(startOAuth('google')).rejects.toThrow('invalid_redirect');
    api.get.mockResolvedValue({ data: {} });
    await expect(startOAuth('google')).rejects.toThrow('invalid_redirect');
    expect(assign).not.toHaveBeenCalled();
  });

  it('prefers the backend error message and falls back to a default', () => {
    const erro = 'Integração ainda não configurada pelo administrador.';
    expect(oauthErrorMessage({ response: { data: { erro } } })).toBe(erro);
    expect(oauthErrorMessage(new Error('x'))).toBe('Não foi possível iniciar a autorização.');
  });
});
