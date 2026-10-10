import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Profile from '../Profile';
import api from '../../services/api';
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const user = { nome: 'Ana', email: 'ana@example.com', telefone: '', localizacao: '', preferences: {} };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); api.get.mockResolvedValue({ data: { usuario: user } }); });
it('persists contact data and announces updated name to the same tab', async () => {
  api.put.mockResolvedValue({ data: { usuario: { ...user, nome: 'Ana Silva', telefone: '123' } } });
  const listener = vi.fn(); window.addEventListener('eyesight-user-change', listener);
  render(<MemoryRouter><Profile /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Ana Silva' } });
  fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ nome: 'Ana Silva', telefone: '123' })));
  await screen.findByText('Perfil e preferência de tema salvos.');
  expect(localStorage.getItem('userName')).toBe('Ana Silva'); expect(listener).toHaveBeenCalled();
  expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly');
  expect(screen.queryByText('R$ 49/mês')).not.toBeInTheDocument();
  window.removeEventListener('eyesight-user-change', listener);
});
it('does not claim password success when the backend rejects the current password', async () => {
  api.post.mockRejectedValue({ response: { data: { erro: 'Senha atual incorreta.' } } });
  render(<MemoryRouter><Profile /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Senha atual'), { target: { value: 'wrong' } });
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'newpassword123' } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'newpassword123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta.');
});
it('shows the weekly summary section with the saved choice', async () => {
  api.get.mockResolvedValue({ data: { usuario: { ...user, preferences: { summary: { weekly: true } } } } });
  render(<MemoryRouter><Profile /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: /Resumo semanal por e-mail/ })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Receber o resumo semanal' })).toBeChecked();
});
