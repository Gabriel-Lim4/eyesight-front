import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dashboard from '../Dashboard';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <svg>{children}</svg>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('eyesight-demo', '1');
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-04T15:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

it('works in demo mode: verdict, four cards, disabled goals and no onboarding card', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(await screen.findByRole('region', { name: 'Como estão seus anúncios' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Você investiu', 'Pessoas que clicaram', 'Resultados', 'Custo por resultado']);
  expect(screen.getByRole('button', { name: 'Salvar metas' })).toBeDisabled();
  expect(screen.queryByRole('region', { name: 'Primeiros passos' })).toBeNull();
});

it('lets the demo user open the explainer and read the fixed example answer', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Explicar: Como estão seus anúncios' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'O que devo fazer primeiro?' }));
  expect(await within(dialog).findByText(/texto de exemplo da demonstração/)).toBeInTheDocument();
});

it('shows no step by step button in the demo, whose only action is "nothing urgent"', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByRole('region', { name: 'Como estão seus anúncios' });
  expect(screen.getByRole('heading', { name: 'O que fazer agora' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver passo a passo' })).toBeNull();
});
