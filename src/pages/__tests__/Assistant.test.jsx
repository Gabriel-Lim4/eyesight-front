import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Assistant from '../Assistant';
import api from '../../services/api';
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); Element.prototype.scrollIntoView = vi.fn();
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/ia/status' ? { configured: true, model: 'gpt-4o-mini', automatic: false } : url === '/metricas/campanhas' ? { campanhas: [{ pk_id_campanha: 42, nome_campanha: 'Campanha real' }] } : url === '/ia/conversas' ? { conversas: [] } : { analises: [] } }));
});
describe('Assistant', () => {
  it('sends real chat route and continues returned conversation', async () => {
    api.post.mockResolvedValue({ data: { conversation: { id: 'conversation-1', title: 'CTR?', messages: [{ role: 'user', content: 'CTR?' }, { role: 'assistant', content: 'Resposta com métricas.' }] } } });
    render(<Assistant />);
    await waitFor(() => expect(screen.getByLabelText('Sua pergunta')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('Sua pergunta'), { target: { value: 'CTR?' } });
    fireEvent.keyDown(screen.getByLabelText('Sua pergunta'), { key: 'Enter', shiftKey: true });
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Resposta com métricas.');
    expect(api.post).toHaveBeenCalledWith('/ia/chat', { message: 'CTR?', conversationId: undefined, periodo: 'last_30d' }, expect.anything());
    fireEvent.change(screen.getByLabelText('Sua pergunta'), { target: { value: 'E CPC?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/ia/chat', expect.objectContaining({ conversationId: 'conversation-1' }), expect.anything()));
    await waitFor(() => expect(screen.getByLabelText('Sua pergunta')).not.toBeDisabled());
  }, 15000);
  it('analyzes the selected campaign instead of a fixed ID', async () => {
    api.post.mockResolvedValue({ data: { analise: { id: 1, texto: 'Análise válida', sugestao: 'Experimento', score_desempenho: 62 } } });
    render(<Assistant />);
    await screen.findByRole('option', { name: 'Campanha real' });
    fireEvent.change(screen.getByLabelText('Campanha'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar análise' }));
    await screen.findByText('Análise válida');
    expect(api.post).toHaveBeenCalledWith('/ia/analisar/42', { periodo: 'last_30d' }, expect.anything());
  });
  it('shows missing configuration honestly', async () => {
    api.get.mockResolvedValue({ data: { configured: false } });
    render(<Assistant />);
    await screen.findByText(/aguarda configuração pelo administrador/);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });
});
