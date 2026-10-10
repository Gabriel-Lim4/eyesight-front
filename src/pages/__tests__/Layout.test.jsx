import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Layout from '../Layout';

vi.mock('../../components/Sidebar', () => ({ default: () => null }));
function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
const mount = () => render(<MemoryRouter initialEntries={['/app/dashboard']}><Routes>
  <Route path="/app" element={<Layout />}><Route index element={<Where />} /><Route path="dashboard" element={<p>conteúdo</p>} /></Route>
  <Route path="*" element={<Where />} />
</Routes></MemoryRouter>);
beforeEach(() => { localStorage.clear(); localStorage.setItem('eyesight-demo', '1'); });

it('returns a logged-in user to the app when leaving the demo', () => {
  localStorage.setItem('token', 'jwt');
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Sair da demonstração' }));
  expect(screen.getByTestId('where')).toHaveTextContent('/app');
  expect(localStorage.getItem('eyesight-demo')).toBeNull();
});
it('returns a visitor to the home page when leaving the demo', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Sair da demonstração' }));
  expect(screen.getByTestId('where')).toHaveTextContent('/');
  expect(screen.getByTestId('where').textContent).toBe('/');
});
