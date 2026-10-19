import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Home from '../Home';

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe('Home (landing)', () => {
  it('tem um único h1', () => {
    renderHome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('oferece os caminhos de entrada e de cadastro', () => {
    renderHome();
    expect(document.querySelector('a[href="/login"]')).toBeTruthy();
    expect(document.querySelector('a[href="/cadastro"]')).toBeTruthy();
  });
});
