import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '../Login';

vi.mock('../../services/api', () => ({ default: { post: vi.fn(), get: vi.fn() }, logout: vi.fn() }));
const mount = (path = '/login') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/" element={<p>Página inicial</p>} /><Route path="/login" element={<Login />} /></Routes></MemoryRouter>);
beforeEach(() => { localStorage.clear(); document.body.className = ''; });

describe('Login e Cadastro', () => {
  it('o botão Voltar fica dentro do painel colorido e leva à página inicial', () => {
    const { container } = mount();
    const panel = container.querySelector('.left-side');
    const back = within(panel).getByRole('button', { name: /Voltar/ });
    expect(container.querySelectorAll('.btn-voltar-home')).toHaveLength(0);
    fireEvent.click(back);
    expect(screen.getByText('Página inicial')).toBeInTheDocument();
  });

  it('permite escolher entre modo claro e escuro, no login e no cadastro', () => {
    for (const path of ['/login', '/login?cadastro=1']) {
      document.body.className = ''; localStorage.clear();
      const { container, unmount } = mount(path);
      const toggle = within(container.querySelector('.left-side')).getByRole('button', { name: 'Ativar modo claro' });
      fireEvent.click(toggle);
      expect(document.body).toHaveClass('light-mode');
      expect(localStorage.getItem('eyesight-theme')).toBe('light');
      fireEvent.click(within(container.querySelector('.left-side')).getByRole('button', { name: 'Ativar modo escuro' }));
      expect(document.body).not.toHaveClass('light-mode');
      unmount();
    }
  });

  it('a logo tem texto alternativo e o link dos termos abre o modal organizado', () => {
    mount('/login?cadastro=1');
    expect(screen.getByAltText('Eyesight Logo')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Termos de Uso e Privacidade'));
    const dialog = screen.getByRole('dialog', { name: 'Termos de Uso e Privacidade' });
    expect(within(dialog).getAllByRole('tab')).toHaveLength(2);
  });

  it('"Li e concordo" marca a caixa de aceite e fecha o modal', () => {
    mount('/login?cadastro=1');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByText('Termos de Uso e Privacidade'));
    fireEvent.click(screen.getByRole('button', { name: /Li e concordo/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
