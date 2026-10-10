import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ExplainerPanel from '../ExplainerPanel';

const base = { focus: { kind: 'card', key: 'cost' }, messages: [], pendingText: '', state: 'idle', error: '', onAsk: vi.fn().mockResolvedValue(true), onClose: vi.fn() };
const mount = (props = {}) => render(<ExplainerPanel {...base} onAsk={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} {...props} />);

describe('ExplainerPanel', () => {
  it('is a named modal dialog with the focus on the panel', () => {
    mount();
    const dialog = screen.getByRole('dialog', { name: 'Custo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
  });
  it('closes with Escape, the close button and the backdrop', () => {
    const onClose = vi.fn();
    const { container } = mount({ onClose });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
    fireEvent.click(container.querySelector('.ex-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
  it('returns the focus to the element that had it before opening', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>origem</button>{open && <ExplainerPanel {...base} onClose={() => setOpen(false)} />}</>;
    }
    render(<Host />);
    const origin = screen.getByRole('button', { name: 'origem' });
    origin.focus();
    fireEvent.click(origin);
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
    expect(origin).toHaveFocus();
  });
  it('keeps Tab inside the panel', () => {
    mount();
    const first = screen.getByRole('button', { name: 'Fechar painel' });
    const last = screen.getByLabelText('Ou escreva sua pergunta');
    last.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
  it('offers the suggested questions and sends the clicked one', () => {
    const onAsk = vi.fn().mockResolvedValue(true);
    mount({ onAsk });
    expect(screen.getAllByRole('button', { name: /\?$/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Como baixar esse custo?' }));
    expect(onAsk).toHaveBeenCalledWith('Como baixar esse custo?');
  });
  it('limits the free text and blocks empty questions', () => {
    mount();
    const box = screen.getByLabelText('Ou escreva sua pergunta');
    expect(box).toHaveAttribute('maxlength', '2000');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    fireEvent.change(box, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });
  it('clears the box after a successful answer and keeps it after a failure', async () => {
    const onAsk = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mount({ onAsk });
    const box = screen.getByLabelText('Ou escreva sua pergunta');
    fireEvent.change(box, { target: { value: 'Minha dúvida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith('Minha dúvida'));
    expect(box).toHaveValue('Minha dúvida');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(box).toHaveValue(''));
  });
  it('disables the controls while sending and announces it', () => {
    const onAsk = vi.fn();
    mount({ state: 'sending', pendingText: 'Oi', onAsk });
    const suggestion = screen.getByRole('button', { name: 'Como baixar esse custo?' });
    expect(suggestion).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(suggestion);
    expect(onAsk).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getByText('Pensando…')).toBeInTheDocument();
    expect(screen.getByText('Oi')).toBeInTheDocument();
    expect(screen.getByText('Pensando…').closest('[aria-live="polite"]')).not.toBeNull();
  });
  it('explains the hourly limit without offering to retry', () => {
    mount({ state: 'limit', error: 'Limite de 20 solicitações de IA por hora atingido. Tente novamente mais tarde.', pendingText: 'Oi' });
    expect(screen.getByRole('alert')).toHaveTextContent('Limite de 20 solicitações');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });
  it('offers to retry the pending question after an error', () => {
    const onAsk = vi.fn().mockResolvedValue(true);
    mount({ state: 'error', error: 'Falhou.', pendingText: 'Oi', onAsk });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onAsk).toHaveBeenCalledWith('Oi');
  });
  it('renders answers as plain text', () => {
    const { container } = mount({ messages: [{ role: 'user', content: 'Oi' }, { role: 'assistant', content: '<img src=x onerror=alert(1)>' }] });
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps the keyboard focus on the clicked suggestion while sending', () => {
    const props = { ...base, onAsk: vi.fn(), onClose: vi.fn() };
    const view = render(<ExplainerPanel {...props} />);
    const suggestion = screen.getByRole('button', { name: 'Como baixar esse custo?' });
    suggestion.focus();
    view.rerender(<ExplainerPanel {...props} state="sending" pendingText="Como baixar esse custo?" />);
    expect(screen.getByRole('button', { name: 'Como baixar esse custo?' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Como baixar esse custo?' })).toHaveAttribute('aria-disabled', 'true');
  });
});
