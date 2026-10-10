import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { STATE_COPY } from './explainerCopy';

const SCOPE_KEYS = ['periodo', 'startDate', 'endDate', 'platform', 'campaignId', 'currency'];

function isDemo() {
  try { return localStorage.getItem('eyesight-demo') === '1'; } catch { return false; }
}

const scopeOf = filters => Object.fromEntries(SCOPE_KEYS.filter(key => filters?.[key] != null && filters[key] !== '').map(key => [key, filters[key]]));

/* Estado do painel "Explicar". O painel só vale para o recorte em que foi aberto. */
export function useExplainer(filters) {
  const scope = scopeOf(filters);
  const scopeKey = JSON.stringify(scope);
  const demo = isDemo();
  const [configured, setConfigured] = useState(null);
  const [panel, setPanel] = useState(null);
  const inFlight = useRef(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (demo) return undefined;
    let active = true;
    api.get('/ia/status')
      .then(({ data }) => { if (active) setConfigured(Boolean(data?.configured)); })
      .catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, [demo]);

  // O painel só vale para o recorte em que foi aberto: ao mudar o recorte ele é descartado de vez.
  if (panel && panel.scopeKey !== scopeKey) setPanel(null);
  const current = panel && panel.scopeKey === scopeKey ? panel : null;
  const open = focus => setPanel({ id: ++nextId.current, focus, scopeKey, messages: [], pendingText: '', conversationId: null, state: 'idle', error: '' });
  const close = () => setPanel(null);

  const ask = async text => {
    const message = String(text ?? '').trim();
    if (!current || !message || inFlight.current === current.id) return false;
    inFlight.current = current.id;
    const base = current;
    setPanel(value => (value?.id === base.id ? { ...value, state: 'sending', pendingText: message, error: '' } : value));
    try {
      const { data } = await api.post('/ia/chat', { message, focus: base.focus, conversationId: base.conversationId || undefined, ...scope }, { timeout: 55000 });
      const answer = data?.conversation?.messages?.at(-1)?.content ?? '';
      setPanel(value => (value?.id === base.id
        ? { ...value, messages: [...value.messages, { role: 'user', content: message }, { role: 'assistant', content: answer }], pendingText: '', conversationId: data?.conversation?.id ?? null, state: 'idle' }
        : value));
      return true;
    } catch (err) {
      setPanel(value => (value?.id === base.id ? { ...value, state: err.response?.status === 429 ? 'limit' : 'error', error: err.response?.data?.erro || STATE_COPY.fallbackError } : value));
      return false;
    } finally {
      if (inFlight.current === base.id) inFlight.current = null;
    }
  };

  return {
    available: demo ? true : configured,
    focus: current?.focus ?? null,
    messages: current?.messages ?? [],
    pendingText: current?.pendingText ?? '',
    state: current?.state ?? 'idle',
    error: current?.error ?? '',
    open, close, ask,
  };
}
