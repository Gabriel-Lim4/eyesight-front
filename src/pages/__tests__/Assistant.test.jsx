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
    expect(api.post).toHaveBeenCalledWith('/ia/chat', { message: 'CTR?', conversationId: undefined, periodo: 'last_30d', stream: true }, expect.anything());
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
  it('apresenta a IA pelo nome Argos e assina as respostas com ele', async () => {
    api.post.mockResolvedValue({ data: { conversation: { id: 'c1', title: 'Oi', messages: [{ role: 'user', content: 'Oi' }, { role: 'assistant', content: 'Olá!' }] } } });
    render(<Assistant />);
    expect(screen.getByRole('heading', { level: 1, name: 'Argos' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Conversa com o Argos' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Sua pergunta')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('Sua pergunta'), { target: { value: 'Oi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Olá!');
    expect(screen.getByText('Argos', { selector: 'strong' })).toBeInTheDocument();
  });
  it('shows missing configuration honestly', async () => {
    api.get.mockResolvedValue({ data: { configured: false } });
    render(<Assistant />);
    await screen.findByText(/aguarda configuração pelo administrador/);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });
});
