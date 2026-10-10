import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

const PLATFORMS = ['meta', 'google'];
const FALLBACK = 'Falha na sincronização. Verifique suas contas e tente novamente.';
const failures = results => (results || []).filter(item => item.success === false && item.error).map(item => item.error).join(' ');

/* Sincronização inicial: roda uma vez ao voltar do OAuth (?conectado=meta|google) e sob demanda via retry(). */
export function useAutoSync() {
  const [params, setParams] = useSearchParams();
  const [sync, setSync] = useState({ state: 'idle', message: '', reloadToken: 0 });
  const started = useRef(false);

  const retry = useCallback(async (platform = 'all') => {
    setSync(current => ({ ...current, state: 'running', message: '' }));
    try {
      const { data } = await api.post('/metricas/sincronizar', { periodo: 'last_30d', platform });
      setSync(current => ({ state: 'idle', message: failures(data?.results), reloadToken: current.reloadToken + 1 }));
    } catch (error) {
      const data = error.response?.data;
      setSync(current => ({ ...current, state: 'error', message: data?.erro || failures(data?.results) || FALLBACK }));
    }
  }, []);

  const returned = params.get('conectado');
  useEffect(() => {
    if (returned === null || started.current) return;
    started.current = true;
    const next = new URLSearchParams(params);
    next.delete('conectado');
    setParams(next, { replace: true });
    // Initial sync after OAuth populates the dashboard asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (PLATFORMS.includes(returned)) retry(returned);
  }, [returned, params, setParams, retry]);

  return { ...sync, retry };
}
