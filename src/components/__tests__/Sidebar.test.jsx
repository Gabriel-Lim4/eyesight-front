import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import Sidebar from '../Sidebar';

beforeEach(() => { localStorage.clear(); localStorage.setItem('eyesight-demo', '1'); });

it('esconde das tecnologias assistivas os ícones que só enfeitam o texto ao lado', () => {
  const { container } = render(<MemoryRouter initialEntries={['/app']}><Sidebar /></MemoryRouter>);
  const unnamed = [...container.querySelectorAll('svg[role="img"]')].filter(svg => svg.getAttribute('aria-hidden') !== 'true' && !svg.getAttribute('aria-label') && !svg.querySelector('title'));
  expect(unnamed).toHaveLength(0);
});
