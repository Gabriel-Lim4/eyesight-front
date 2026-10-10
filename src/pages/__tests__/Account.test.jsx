import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Account from '../Account';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
function Probe() { const { pathname, search } = useLocation(); return <p data-testid="where">{pathname}{search}</p>; }
const mount = url => render(<MemoryRouter initialEntries={[url]}><Routes>
  <Route path="/app/account" element={<Account />} /><Route path="/app" element={<Probe />} />
</Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.get.mockResolvedValue({ data: { conectado: false, configured: true } }); });

it.each(['meta', 'google'])('sends the user to the dashboard after a successful %s connection', async platform => {
  mount(`/app/account?${platform}=conectado`);
  expect(await screen.findByTestId('where')).toHaveTextContent(`/app?conectado=${platform}`);
});
it('keeps the account page and its message for other callback results', async () => {
  mount('/app/account?meta=negado');
  expect(await screen.findByText('Autorização cancelada. Conecte novamente quando desejar.')).toBeInTheDocument();
  expect(screen.queryByTestId('where')).not.toBeInTheDocument();
});
