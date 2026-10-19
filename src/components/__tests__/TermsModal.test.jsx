import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TermsModal from '../TermsModal';

describe('TermsModal', () => {
  it('abre como diálogo nomeado, com as duas abas e o índice de seções', () => {
    render(<TermsModal onAccept={() => {}} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Termos de Uso e Privacidade' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent.trim())).toEqual(['Termos de Uso do Eyesight', 'Política de Privacidade do Eyesight']);
    expect(within(dialog).getByRole('tab', { selected: true })).toHaveTextContent('Termos de Uso');
    expect(within(screen.getByRole('navigation', { name: 'Seções deste documento' })).getAllByRole('button')).toHaveLength(14);
  });

  it('troca para a Política de Privacidade e atualiza o índice', () => {
    render(<TermsModal onAccept={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /Política de Privacidade/ }));
    expect(screen.getByRole('tab', { name: /Política de Privacidade/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('navigation', { name: 'Seções deste documento' })).getAllByRole('button')).toHaveLength(11);
    expect(screen.getByRole('heading', { level: 3, name: /Política de Privacidade/ })).toBeInTheDocument();
  });

  it('"Li e concordo" aceita e "Fechar", o X e a tecla Esc só fecham', () => {
    const onAccept = vi.fn(), onClose = vi.fn();
    render(<TermsModal onAccept={onAccept} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Li e concordo/ }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    screen.getAllByRole('button', { name: 'Fechar' }).forEach(button => fireEvent.click(button));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('destaca os campos ainda não preenchidos, como o e-mail de contato', () => {
    render(<TermsModal onAccept={() => {}} onClose={() => {}} />);
    expect(screen.getAllByText(/\[e-mail de contato do projeto\]/).length).toBeGreaterThan(0);
  });
});
