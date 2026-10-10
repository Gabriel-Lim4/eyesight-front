import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActionPlan from '../ActionPlan';

const ACTION = { code: 'campaign_over_goal', campaignId: 7 };
const steps = flags => flags.map((done, index) => ({ id: `s${index + 1}`, text: `Passo ${index + 1}`, done }));
const plan = flags => ({ id: 'p1', steps: steps(flags), generatedAt: '2026-10-08T12:00:00Z' });
const makePlans = (overrides = {}) => ({ planFor: () => null, stateFor: () => 'idle', errorFor: () => '', busy: false, saveError: '', generate: vi.fn(), toggle: vi.fn(), ...overrides });
const mount = (plans, props = {}) => render(<ActionPlan action={ACTION} plans={plans} available {...props} />);

describe('ActionPlan', () => {
  it('offers the step by step when there is no plan and generates on click', () => {
    const plans = makePlans();
    mount(plans);
    fireEvent.click(screen.getByRole('button', { name: 'Ver passo a passo' }));
    expect(plans.generate).toHaveBeenCalledWith(ACTION);
  });

  it('shows progress while generating and ignores clicks', () => {
    const plans = makePlans({ stateFor: () => 'generating', busy: true });
    mount(plans);
    const button = screen.getByRole('button', { name: 'Preparando os passos…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(plans.generate).not.toHaveBeenCalled();
  });

  it('blocks the button while another action is generating', () => {
    const plans = makePlans({ busy: true });
    mount(plans);
    fireEvent.click(screen.getByRole('button', { name: 'Ver passo a passo' }));
    expect(plans.generate).not.toHaveBeenCalled();
  });

  it('lists the steps with progress, date and regenerate', () => {
    const plans = makePlans({ planFor: () => plan([true, true, false, false]) });
    mount(plans);
    expect(screen.getByText('2 de 4 passos feitos')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getByRole('checkbox', { name: 'Passo 1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Passo 3' })).not.toBeChecked();
    expect(screen.getByText(/Gerado em 08\/10/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    expect(plans.generate).toHaveBeenCalledWith(ACTION, { regenerate: true });
  });

  it('toggles a step', () => {
    const plans = makePlans({ planFor: () => plan([false, false, false]) });
    mount(plans);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Passo 2' }));
    expect(plans.toggle).toHaveBeenCalledWith('p1', 's2', true);
  });

  it('celebrates without promising results when everything is done', () => {
    mount(makePlans({ planFor: () => plan([true, true, true]) }));
    expect(screen.getByText('Tudo feito. Veja nos próximos dias se o resultado melhorou.')).toBeInTheDocument();
  });

  it('shows a retryable error', () => {
    const plans = makePlans({ stateFor: () => 'error', errorFor: () => 'Falhou feio.' });
    mount(plans);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou feio.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(plans.generate).toHaveBeenCalledWith(ACTION);
  });

  it('shows the hourly limit without a retry button', () => {
    mount(makePlans({ stateFor: () => 'limit', errorFor: () => 'Limite de 20 solicitações de IA por hora atingido.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Limite de 20');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('shows a saving error', () => {
    mount(makePlans({ planFor: () => plan([false, false, false]), saveError: 'Não foi possível salvar. Tente de novo.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
  });

  it('disables generation when the AI is unavailable but keeps existing steps usable', () => {
    const { unmount } = render(<><p id="why">Assistente indisponível no momento.</p><ActionPlan action={ACTION} plans={makePlans()} available={false} describedBy="why" /></>);
    const button = screen.getByRole('button', { name: 'Ver passo a passo' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Assistente indisponível no momento.');
    unmount();
    mount(makePlans({ planFor: () => plan([false, false, false]) }), { available: false });
    expect(screen.getByRole('checkbox', { name: 'Passo 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Gerar de novo' })).toBeDisabled();
  });

  it('renders step text as plain text', () => {
    const { container } = mount(makePlans({ planFor: () => ({ id: 'p1', generatedAt: '2026-10-08T12:00:00Z', steps: [{ id: 's1', text: '<img src=x onerror=alert(1)>', done: false }, ...steps([false, false]).map((step, i) => ({ ...step, id: `s${i + 2}` }))] }) }));
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing for actions without a plan', () => {
    for (const code of ['refresh_data', 'nothing_urgent']) {
      const { container, unmount } = render(<ActionPlan action={{ code }} plans={makePlans()} available />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('renders nothing when the plans could not be loaded', () => {
    const { container } = mount(makePlans({ failed: true }));
    expect(container).toBeEmptyDOMElement();
  });

  it('moves the keyboard focus to the first step when the plan appears', () => {
    const empty = makePlans();
    const view = render(<ActionPlan action={ACTION} plans={empty} available />);
    screen.getByRole('button', { name: 'Ver passo a passo' }).focus();
    view.rerender(<ActionPlan action={ACTION} plans={makePlans({ planFor: () => plan([false, false, false]) })} available />);
    expect(screen.getByRole('checkbox', { name: 'Passo 1' })).toHaveFocus();
  });

  it('does not take the focus when a saved plan is already there', () => {
    mount(makePlans({ planFor: () => plan([false, false, false]) }));
    expect(screen.getByRole('checkbox', { name: 'Passo 1' })).not.toHaveFocus();
  });
});
