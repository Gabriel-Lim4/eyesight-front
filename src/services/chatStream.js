/* Chat da IA com resposta em fluxo (SSE). Usa o próprio axios (XHR) para manter login, renovação de token e demonstração:
   onDownloadProgress devolve o texto acumulado, e cada evento completo ("delta", "done", "error") vira um passo. */

export function parseEvents(text) {
  const events = [];
  for (const block of String(text).split('\n\n')) {
    const name = /^event: (.+)$/m.exec(block)?.[1];
    const raw = /^data: (.+)$/m.exec(block)?.[1];
    if (!name || !raw) continue;
    try { events.push({ name, data: JSON.parse(raw) }); } catch { /* evento cortado no meio: chega completo no próximo progresso */ }
  }
  return events;
}

const textOf = events => events.filter(event => event.name === 'delta').map(event => event.data.text).join('');

export async function streamChat(client, payload, { onText, timeout = 55000 } = {}) {
  const config = {
    timeout,
    responseType: 'text',
    onDownloadProgress: progress => {
      const text = progress?.event?.target?.responseText;
      if (typeof text === 'string' && onText) onText(textOf(parseEvents(text)));
    },
  };
  let data;
  try { ({ data } = await client.post('/ia/chat', { ...payload, stream: true }, config)); } catch (err) {
    // Com responseType "text" o corpo de um erro comum chega como texto.
    if (typeof err.response?.data === 'string') { try { err.response.data = JSON.parse(err.response.data); } catch { /* mantém o texto */ } }
    throw err;
  }
  if (data && typeof data === 'object') return data;
  const events = parseEvents(data);
  const failed = events.find(event => event.name === 'error');
  if (failed) throw Object.assign(new Error(failed.data.erro), { response: { data: { erro: failed.data.erro } } });
  const done = events.find(event => event.name === 'done');
  if (done) return done.data;
  try { return JSON.parse(data); } catch { throw new Error('Resposta inválida do servidor.'); }
}
