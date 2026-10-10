import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Instagram from '../Instagram';
import api from '../../services/api';
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
it('distinguishes missing reach from zero and requests only supported periods', async () => {
  api.get.mockImplementation(async url => ({ data: url.includes('status') ? { conectado: true } : { perfil: { username: 'example', seguidores: 0, totalPosts: 0 }, metricas: { alcance: null }, warnings: ['Permissão de alcance ausente.'] } }));
  render(<MemoryRouter><Instagram /></MemoryRouter>);
  expect(await screen.findByText('Indisponível')).toBeInTheDocument();
  expect(screen.getByText('Permissão de alcance ausente.')).toBeInTheDocument();
  expect(screen.queryByText('Taxa de engajamento')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Reels' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Período do alcance'), { target: { value: 'last_7d' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/instagram/metricas', { params: { periodo: 'last_7d' } }));
});
it('shows API failure as error rather than a falsely disconnected account', async () => {
  api.get.mockRejectedValue({ response: { data: { erro: 'Falha temporária da plataforma.' } } });
  render(<MemoryRouter><Instagram /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária da plataforma.');
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Conecte sua conta Meta' })).not.toBeInTheDocument();
});
