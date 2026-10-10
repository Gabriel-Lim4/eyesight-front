import { useState, useEffect, useCallback } from 'react';

const readTheme = () => typeof window !== 'undefined' && localStorage.getItem('eyesight-theme') === 'light';

export function useTheme() {
  const [lightMode, updateState] = useState(readTheme);
  useEffect(() => {
    const sync = () => {
      const light = readTheme();
      document.body.classList.toggle('light-mode', light);
      updateState(light);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('eyesight-theme-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('eyesight-theme-change', sync);
    };
  }, []);

  const setLightMode = useCallback(value => {
    const next = typeof value === 'function' ? value(readTheme()) : Boolean(value);
    localStorage.setItem('eyesight-theme', next ? 'light' : 'dark');
    document.body.classList.toggle('light-mode', next);
    window.dispatchEvent(new CustomEvent('eyesight-theme-change', { detail: { lightMode: next } }));
  }, []);
  const toggleTheme = useCallback(() => setLightMode(value => !value), [setLightMode]);
  return { lightMode, toggleTheme, setLightMode };
}
export default useTheme;
