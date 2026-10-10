export function saveSession(data) {
  if (data.token) localStorage.setItem('token', data.token);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  if (data.expiresAt) localStorage.setItem('expiresAt', String(data.expiresAt));
  if (['light', 'dark'].includes(data.usuario?.preferences?.theme)) {
    localStorage.setItem('eyesight-theme', data.usuario.preferences.theme);
    document.body.classList.toggle('light-mode', data.usuario.preferences.theme === 'light');
    window.dispatchEvent(new Event('eyesight-theme-change'));
  }
  if (data.usuario?.nome) {
    localStorage.setItem('userName', data.usuario.nome);
    window.dispatchEvent(new Event('eyesight-user-change'));
  }
}

export function clearSession() {
  ['token', 'refreshToken', 'expiresAt', 'userName', 'eyesight-demo'].forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event('eyesight-user-change'));
}
