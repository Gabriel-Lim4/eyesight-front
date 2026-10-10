import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExplainButton from '../ExplainButton';

describe('ExplainButton', () => {
  it('names the item it explains and calls back on click', () => {
    const onClick = vi.fn();
    render(<ExplainButton label="Custo" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Explicar: Custo' });
    expect(button).toHaveTextContent('Explicar');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('can be disabled and described by a visible note', () => {
    const onClick = vi.fn();
    render(<><p id="why">Assistente indisponível no momento.</p><ExplainButton label="Custo" onClick={onClick} disabled describedBy="why" /></>);
    const button = screen.getByRole('button', { name: 'Explicar: Custo' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Assistente indisponível no momento.');
  });
});
