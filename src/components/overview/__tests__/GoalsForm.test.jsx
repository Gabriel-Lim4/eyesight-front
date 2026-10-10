import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GoalsForm from '../GoalsForm';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { put: vi.fn() } }));
const cpa = () => screen.getByLabelText('Quero pagar, no máximo, por cada resultado');
const budget = () => screen.getByLabelText('Quero gastar, no máximo, no período');
const ctr = () => screen.getByLabelText('Quero que pelo menos esta % de quem vê meu anúncio clique');
const mount = (props = {}) => render(<GoalsForm alertSettings={{ cpaMax: 40, budgetMax: null, ctrMin: 1.5 }} currency="BRL" disabled={false} onSaved={vi.fn()} {...props} />);
beforeEach(() => { vi.clearAllMocks(); api.put.mockResolvedValue({ data: { mensagem: 'ok' } }); });

describe('GoalsForm', () => {
  it('starts collapsed under "Suas metas" and shows the saved values', () => {
    const { container } = mount();
    expect(screen.getByText('Suas metas')).toBeInTheDocument();
    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(cpa()).toHaveValue(40);
    expect(budget()).toHaveValue(null);
    expect(ctr()).toHaveValue(1.5);
  });

  it('saves numbers, turns blanks into null and reloads the overview', async () => {
    const onSaved = vi.fn();
    mount({ onSaved, alertSettings: {} });
    fireEvent.change(cpa(), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar metas' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/metricas/alertas', { ctrMin: null, cpaMax: 40, budgetMax: null }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('status')).toHaveTextContent('Metas salvas.');
  });

  it('keeps what was typed and shows the backend error when saving fails', async () => {
    api.put.mockRejectedValue({ response: { data: { erro: 'Informe limites válidos e não negativos.' } } });
    const onSaved = vi.fn();
    mount({ onSaved });
    fireEvent.change(cpa(), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar metas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe limites válidos e não negativos.');
    expect(cpa()).toHaveValue(55);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('uses a generic message when the failure has no detail', async () => {
    api.put.mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar metas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar as metas.');
  });

  it('cannot be used in demo mode', () => {
    mount({ disabled: true });
    expect(screen.getByRole('button', { name: 'Salvar metas' })).toBeDisabled();
    expect(cpa()).toBeDisabled();
    expect(screen.getByText('Na demonstração as metas não podem ser alteradas.')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
