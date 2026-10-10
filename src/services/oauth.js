import api from './api';

/* Inicia a autorização OAuth da plataforma e leva o navegador até ela. */
export async function startOAuth(platform) {
  const { data } = await api.get(`/${platform}/conectar`);
  if (!data.url || !/^https:\/\//.test(data.url)) throw new Error('invalid_redirect');
  window.location.assign(data.url);
}

export function oauthErrorMessage(error) {
  return error?.response?.data?.erro || 'Não foi possível iniciar a autorização.';
}
