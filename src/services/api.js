import axios from 'axios';
import { clearSession, saveSession } from './session';
import { demoAdapter } from './demoApi';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});
let refreshPromise;

api.interceptors.request.use(config => {
  if (localStorage.getItem('eyesight-demo') === '1') {
    config.adapter = demoAdapter;
    delete config.headers.Authorization;
    delete config.headers.authorization;
    delete config.auth;
    return config;
  }
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response => response, async error => {
  const config = error.config;
  const isPublicAuth = /\/auth\/(login|cadastro|esqueci-senha|redefinir-senha|reenviar-verificacao|refresh)(?:[?]|$)/.test(config?.url || '');
  if (!config || error.response?.status !== 401 || isPublicAuth || error.response?.data?.acao === 'reconectar') throw error;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!config._retried && refreshToken) {
    config._retried = true;
    // Another response may have already renewed this expired token.
    const currentToken = localStorage.getItem('token');
    if (config.headers.Authorization !== `Bearer ${currentToken}`) return api(config);
    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh', { refreshToken })
          .then(({ data }) => { saveSession(data); return data; })
          .finally(() => { refreshPromise = null; });
      }
      await refreshPromise;
      return api(config);
    } catch (refreshError) {
      // A temporary outage must not erase a recoverable session.
      if (![400, 401, 403].includes(refreshError.response?.status)) throw refreshError;
    }
  }
  clearSession();
  window.location.assign('/login');
  throw error;
});

export async function logout() {
  if (localStorage.getItem('eyesight-demo') === '1') {
    localStorage.removeItem('eyesight-demo');
    return;
  }
  await api.post('/auth/logout');
  clearSession();
}

export default api;
