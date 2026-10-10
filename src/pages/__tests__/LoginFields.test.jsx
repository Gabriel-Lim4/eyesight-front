import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Login from '../Login';

vi.mock('../../services/api', () => ({ default: { post: vi.fn(), get: vi.fn() }, logout: vi.fn() }));
beforeEach(() => { localStorage.clear(); });

it('usa valores válidos de autocomplete nos campos de senha do cadastro', () => {
  const { container } = render(<MemoryRouter initialEntries={['/login?cadastro=1']}><Login /></MemoryRouter>);
  const fields = [...container.querySelectorAll('input[type="password"], input[autocomplete*="password"]')];
  expect(fields.length).toBeGreaterThanOrEqual(2);
  for (const field of fields) expect(['new-password', 'current-password']).toContain(field.getAttribute('autocomplete'));
});
