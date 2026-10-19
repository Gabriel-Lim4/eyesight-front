import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { fromVisible, normalizePrefs, visibleKeys } from '../../utils/kpiCatalog';

const STORAGE_KEY = 'eyesight-kpi-cards';
const SAVE_DELAY = 700;

const isDemo = () => { try { return localStorage.getItem('eyesight-demo') === '1'; } catch { return false; } };

function read(defaultVisible) {
  try { return normalizePrefs(JSON.parse(localStorage.getItem(STORAGE_KEY)), defaultVisible); }
  catch { return fromVisible(defaultVisible); }
}
function write(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* preferência opcional */ }
}

let timer;
/* Grava a escolha no perfil do usuário (back: PUT /auth/me → preferences.dashboardCards).
   Na demonstração nada é enviado; se a rede falhar, a escolha continua valendo neste navegador. */
function pushRemote(prefs) {
  if (isDemo()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    let nome = '';
    try { nome = localStorage.getItem('userName') || ''; } catch { /* sem nome não há o que enviar */ }
    if (!nome || !localStorage.getItem('token')) return;
    Promise.resolve(api.put('/auth/me', { nome, preferences: { dashboardCards: visibleKeys(prefs) } })).catch(() => {});
  }, SAVE_DELAY);
}

/* Preferência dos indicadores visíveis e da ordem.
   `remote`: também lê do perfil ao abrir (assim a escolha acompanha o usuário entre aparelhos). */
export function useKpiPrefs(defaultVisible, { remote = false } = {}) {
  const [prefs, setPrefs] = useState(() => read(defaultVisible));
  const latest = useRef(prefs);
  const touched = useRef(false);

  useEffect(() => {
    if (!remote || isDemo()) return undefined;
    let active = true;
    (async () => {
      try {
        const response = await api.get('/auth/me');
        const saved = response?.data?.usuario?.preferences?.dashboardCards;
        // se a pessoa já mexeu enquanto a resposta vinha, a escolha dela vale mais
        if (active && !touched.current && Array.isArray(saved)) {
          const next = fromVisible(saved);
          latest.current = next;
          setPrefs(next);
          write(next);
        }
      } catch { /* sem perfil: segue com o que está salvo neste navegador */ }
    })();
    return () => { active = false; };
  }, [remote]);

  const update = useCallback(change => {
    touched.current = true;
    const next = typeof change === 'function' ? change(latest.current) : change;
    if (next === latest.current) return;
    latest.current = next;
    setPrefs(next);
    write(next);
    pushRemote(next);
  }, []);

  const reset = useCallback(() => update(fromVisible(defaultVisible)), [update, defaultVisible]);

  return { prefs, update, reset };
}
