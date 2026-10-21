import { describe, it, expect, vi } from 'vitest';
import { parseEvents, streamChat } from '../chatStream';

const block = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

describe('parseEvents', () => {
  it('lê eventos completos e ignora o pedaço final ainda incompleto', () => {
    const text = block('delta', { text: 'Olá' }) + block('delta', { text: ' mundo' }) + 'event: delta\ndata: {"te';
    expect(parseEvents(text)).toEqual([{ name: 'delta', data: { text: 'Olá' } }, { name: 'delta', data: { text: ' mundo' } }]);
  });
});

describe('streamChat', () => {
  it('entrega os pedaços conforme chegam e devolve a conversa do evento final', async () => {
    const conversation = { id: 'c1', messages: [{ role: 'assistant', content: 'Olá mundo' }] };
    const full = block('delta', { text: 'Olá' }) + block('delta', { text: ' mundo' }) + block('done', { conversation, modelo: 'm' });
    const post = vi.fn(async (url, body, config) => {
      config.onDownloadProgress({ event: { target: { responseText: full.slice(0, 30) } } });
      config.onDownloadProgress({ event: { target: { responseText: full } } });
      return { data: full };
    });
    const seen = [];
    const result = await streamChat({ post }, { message: 'oi' }, { onText: text => seen.push(text) });
    expect(post.mock.calls[0][1]).toEqual({ message: 'oi', stream: true });
    expect(seen.at(-1)).toBe('Olá mundo');
    expect(result).toEqual({ conversation, modelo: 'm' });
  });

  it('aceita resposta comum em JSON (demonstração ou servidor antigo)', async () => {
    const data = { conversation: { id: 'c2', messages: [] } };
    expect(await streamChat({ post: async () => ({ data }) }, { message: 'oi' })).toEqual(data);
    expect(await streamChat({ post: async () => ({ data: JSON.stringify(data) }) }, { message: 'oi' })).toEqual(data);
  });

  it('transforma o evento de erro em um erro com a mesma forma das falhas do axios', async () => {
    const full = block('delta', { text: 'Ol' }) + block('error', { erro: 'O serviço de IA está indisponível.' });
    await expect(streamChat({ post: async () => ({ data: full }) }, { message: 'oi' }))
      .rejects.toMatchObject({ response: { data: { erro: 'O serviço de IA está indisponível.' } } });
  });

  it('erros comuns do servidor (429, 400) chegam com o corpo já lido como objeto', async () => {
    const failure = Object.assign(new Error('x'), { response: { status: 429, data: '{"erro":"Limite atingido."}' } });
    const error = await streamChat({ post: async () => { throw failure; } }, { message: 'oi' }).catch(err => err);
    expect(error.response.status).toBe(429);
    expect(error.response.data).toEqual({ erro: 'Limite atingido.' });
  });
});
