// Telas, temas, larguras e estados percorridos pela auditoria.
const screen = (group, id, path) => ({ id, path, group });

export const APP_SCREENS = [
  screen('app', 'app-overview', '/app'),
  screen('app', 'app-dashboard', '/app/dashboard'),
  screen('app', 'app-instagram', '/app/instagram'),
  screen('app', 'app-google', '/app/google'),
  screen('app', 'app-meta', '/app/meta'),
  screen('app', 'app-metrics', '/app/metrics'),
  screen('app', 'app-account', '/app/account'),
  screen('app', 'app-assistant', '/app/assistant'),
  screen('app', 'app-profile', '/app/profile'),
];

export const AUTH_SCREENS = [
  screen('auth', 'auth-login', '/login'),
  screen('auth', 'auth-cadastro', '/cadastro'),
  screen('auth', 'auth-esqueci-senha', '/esqueci-senha'),
  screen('auth', 'auth-cancelar-resumo', '/cancelar-resumo?t=x'),
];

export const LANDING_SCREENS = [screen('landing', 'landing-home', '/')];

export const THEMES = ['dark', 'light'];

export const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 800 },
  { id: 'mobile', width: 360, height: 740 },
];

// Estados que a simples visita não alcança, abertos por interação na Visão geral.
export const STATES = [
  { id: 'explainer', screen: 'app-overview' },
  { id: 'goals', screen: 'app-overview' },
];
