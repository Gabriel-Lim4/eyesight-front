import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import SummarySettings from '../SummarySettings';

vi.mock('../../../services/api', () => ({ default: { put: vi.fn(), post: vi.fn() } }));
const mount = (props = {}) => render(<SummarySettings weekly={false} nome="Ana" {...props} />);
const box = () => screen.getByRole('checkbox', { name: 'Receber o resumo semanal' });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.put.mockResolvedValue({ data: {} }); api.post.mockResolvedValue({ data: {} }); });

describe('SummarySettings', () => {
  it('starts as the profile says and explains what the e-mail brings', () => {
    mount();
    expect(screen.getByRole('heading', { name: /Resumo semanal por e-mail/ })).toBeInTheDocument();
    expect(screen.getByText(/Toda segunda-feira, um e-mail com como estão seus anúncios/)).toBeInTheDocument();
    expect(box()).not.toBeChecked();
  });

  it('starts checked when the profile already has it on', () => {
    mount({ weekly: true });
    expect(box()).toBeChecked();
  });

  it('turns the summary on and off through the profile and says so', async () => {
    mount();
    fireEvent.click(box());
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', { nome: 'Ana', preferences: { summary: { weekly: true } } }));
    expect(await screen.findByText('Resumo semanal ligado.')).toBeInTheDocument();
    expect(box()).toBeChecked();
    fireEvent.click(box());
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/auth/me', { nome: 'Ana', preferences: { summary: { weekly: false } } }));
    expect(await screen.findByText('Resumo semanal desligado.')).toBeInTheDocument();
  });

  it('reverts the box and warns when saving fails', async () => {
    api.put.mockRejectedValueOnce(new Error('offline'));
    mount();
    fireEvent.click(box());
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(box()).not.toBeChecked();
  });

  it('sends an example to the account e-mail', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar um exemplo para mim' }));
    expect(await screen.findByText('Enviamos um exemplo para o e-mail da sua conta.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/resumo/teste');
  });

  it('explains each failure of the example in plain words', async () => {
    mount();
    const send = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar um exemplo para mim' }));
    api.post.mockRejectedValueOnce({ response: { status: 429, data: { erro: 'Você já pediu exemplos demais. Tente de novo em até 1 hora.' } } });
    send();
    expect(await screen.findByRole('alert')).toHaveTextContent('Você já pediu exemplos demais');
    api.post.mockRejectedValueOnce({ response: { status: 503, data: { erro: 'x' } } });
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('O envio de e-mail ainda não está configurado.'));
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { erro: 'x' } } });
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ainda não há dados para montar o resumo.'));
  });

  it('offers to try again after an unexpected failure', async () => {
    mount();
    api.post.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar um exemplo para mim' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Enviamos um exemplo para o e-mail da sua conta.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('ignores clicks while an example is being sent', async () => {
    let finish;
    api.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    mount();
    const button = screen.getByRole('button', { name: 'Enviar um exemplo para mim' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    finish({ data: {} });
    await screen.findByText('Enviamos um exemplo para o e-mail da sua conta.');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('is read-only in the demo', () => {
    localStorage.setItem('eyesight-demo', '1');
    mount();
    expect(box()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar um exemplo para mim' })).toBeDisabled();
    expect(screen.getByText('Indisponível na demonstração.')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('saves one change at a time and ignores clicks while saving', async () => {
    let finish;
    api.put.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    mount();
    fireEvent.click(box());
    fireEvent.click(box());
    fireEvent.click(box());
    expect(box()).toHaveAttribute('aria-disabled', 'true');
    expect(api.put).toHaveBeenCalledTimes(1);
    finish({ data: {} });
    expect(await screen.findByText('Resumo semanal ligado.')).toBeInTheDocument();
    expect(box()).toHaveAttribute('aria-disabled', 'false');
    expect(box()).toBeChecked();
  });

  it('rolls back to the last confirmed value when saving fails', async () => {
    api.put.mockRejectedValueOnce(new Error('offline'));
    mount({ weekly: true });
    fireEvent.click(box());
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(box()).toBeChecked();
  });
});
