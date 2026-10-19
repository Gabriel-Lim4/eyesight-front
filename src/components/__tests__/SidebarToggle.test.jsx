import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  beforeEach(() => localStorage.clear());

  it('abre e fecha ao clicar na logo, sem botão de seta', () => {
    const { container } = render(<MemoryRouter><Sidebar /></MemoryRouter>);
    const aside = container.querySelector('aside');
    expect(container.querySelector('.sidebar-toggle')).toBeNull();
    expect(aside.className).not.toContain('sidebar-collapsed');
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }));
    expect(aside.className).toContain('sidebar-collapsed');
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));
    expect(aside.className).not.toContain('sidebar-collapsed');
  });
});
