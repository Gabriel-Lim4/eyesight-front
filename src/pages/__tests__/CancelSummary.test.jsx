import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import CancelSummary from '../CancelSummary';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));
const mount = url => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/cancelar-resumo" element={<CancelSummary />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: {} }); });

describe('CancelSummary', () => {
  it('asks first and does nothing until the button is pressed', () => {
    mount('/cancelar-resumo?t=abc');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Parar de receber o resumo semanal?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('cancels with the token on click and confirms', async () => {
    mount('/cancelar-resumo?t=abc');
    fireEvent.click(screen.getByRole('button', { name: 'Parar de receber' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Pronto. Você não receberá mais o resumo semanal. Para voltar a receber, ligue em Meu perfil.');
    expect(api.post).toHaveBeenCalledWith('/resumo/cancelar', { token: 'abc' });
    expect(screen.queryByRole('button', { name: 'Parar de receber' })).toBeNull();
  });

  it('tells the person when the link is invalid or expired', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 400, data: { erro: 'x' } } });
    mount('/cancelar-resumo?t=bad');
    fireEvent.click(screen.getByRole('button', { name: 'Parar de receber' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este link não é válido ou expirou. Entre no app e desligue o resumo em Meu perfil.');
  });

  it('offers to try again when the server is unreachable', async () => {
    api.post.mockRejectedValueOnce(new Error('network'));
    mount('/cancelar-resumo?t=abc');
    fireEvent.click(screen.getByRole('button', { name: 'Parar de receber' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível cancelar agora. Tente de novo.');
    expect(screen.getByRole('button', { name: 'Parar de receber' })).toBeInTheDocument();
  });

  it('shows the invalid-link notice and no button without a token', () => {
    mount('/cancelar-resumo');
    expect(screen.getByRole('alert')).toHaveTextContent('Este link não é válido ou expirou. Entre no app e desligue o resumo em Meu perfil.');
    expect(screen.queryByRole('button', { name: 'Parar de receber' })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('for an alerts link, asks about alerts and cancels only the alerts', async () => {
    mount('/cancelar-resumo?t=abc&e=alertas');
    expect(screen.getByRole('heading', { level: 1, name: 'Parar de receber os alertas?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Parar de receber' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Pronto. Você não receberá mais os alertas. Para voltar a receber, ligue em Meu perfil.');
    expect(api.post).toHaveBeenCalledWith('/resumo/cancelar', { token: 'abc', escopo: 'alertas' });
  });
});
