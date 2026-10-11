import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChangeExplainer from '../ChangeExplainer';

const ctx = { currency: 'BRL', period: { period: 'last_30d', days: 30 } };
const explanation = { indicator: 'cpa', costChange: 25, main: 'cvr', factors: [{ key: 'cvr', change: -20, share: 0.7 }, { key: 'cpm', change: 8, share: 0.3 }] };

describe('ChangeExplainer', () => {
  it('renders nothing without an explanation', () => {
    const { container } = render(<ChangeExplainer explanation={null} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the section and lists the main reason first', () => {
    render(<ChangeExplainer explanation={explanation} ctx={ctx} />);
    const region = screen.getByRole('region', { name: 'Por que o custo por resultado subiu 25%?' });
    const items = region.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('O principal motivo: Menos cliques viraram resultado');
    expect(items[1]).toHaveTextContent('Também contribuiu: Seus anúncios ficaram mais caros de mostrar');
    expect(region).toHaveTextContent('Comparado com os 30 dias anteriores');
  });
});
