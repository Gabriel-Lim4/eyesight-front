import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from '../ForgotPassword';
import AuthCallback from '../AuthCallback';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, '', '/'); });

function mount(component) { return render(<MemoryRouter>{component}</MemoryRouter>); }

describe('Email recovery', () => {
  it('uses the backend recovery endpoint and shows its generic response', async () => {
    api.post.mockResolvedValue({ data: { mensagem: 'Se o e-mail estiver cadastrado, enviamos um link.' } });
    mount(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    await screen.findByRole('status');
    expect(api.post).toHaveBeenCalledWith('/auth/esqueci-senha', { email: 'user@example.com' });
    expect(screen.queryByText('SMS')).not.toBeInTheDocument();
  });

  it('shows the actual backend error when recovery fails', async () => {
    api.post.mockRejectedValue({ response: { data: { erro: 'Aguarde alguns minutos.' } } });
    mount(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde alguns minutos.');
  });

  it('removes recovery credentials from the URL and submits the new password', async () => {
    window.history.replaceState(null, '', '/redefinir-senha#access_token=test-recovery-token&type=recovery');
    api.post.mockResolvedValue({ data: {} });
    mount(<AuthCallback recovery />);
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'new-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/redefinir-senha', { accessToken: 'test-recovery-token', novaSenha: 'new-password-123' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Senha redefinida');
  });

  it('rejects a callback without a recovery token', () => {
    mount(<AuthCallback recovery />);
    expect(screen.getByRole('alert')).toHaveTextContent('Link inválido');
    expect(screen.queryByRole('button', { name: 'Salvar senha' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
