import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmptyState from '../EmptyState';
import { FiLink } from 'react-icons/fi';

describe('EmptyState Component', () => {
  it('renders the title and description correctly', () => {
    render(
      <EmptyState
        title="Conecte sua conta"
        description="Descrição detalhada sobre a ação."
        icon={<FiLink data-testid="test-icon" />}
      />
    );

    expect(screen.getByText('Conecte sua conta')).toBeInTheDocument();
    expect(screen.getByText('Descrição detalhada sobre a ação.')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders the button if buttonText is provided', () => {
    render(
      <EmptyState
        title="Conecte sua conta"
        buttonText="Conectar"
      />
    );

    const button = screen.getByRole('button', { name: /Conectar/i });
    expect(button).toBeInTheDocument();
  });

  it('does not render the button if buttonText is not provided', () => {
    render(
      <EmptyState
        title="Conecte sua conta"
      />
    );

    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });
});
