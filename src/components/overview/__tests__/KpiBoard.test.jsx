import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import KpiBoard from '../KpiBoard';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
const data = {
  currency: 'BRL', currentComplete: true, previousComplete: true,
  totals: { roas: 4.2, ctr: 1.8, cpc: 1.5, cpm: 22, impressions: 120000, revenue: 9000, spend: 2000, clicks: 900, conversions: 40, cpa: 50 },
  changes: { roas: 12.5, ctr: -3, cpc: 8, cpm: 0.1, impressions: 5, revenue: 10 },
  daily: [{ date: '2026-09-01', complete: true, roas: 3 }, { date: '2026-09-02', complete: true, roas: 4.2 }],
};
const DEFAULTS = ['roas', 'ctr', 'cpc'];
const mount = (props = {}) => render(<KpiBoard data={data} defaultVisible={DEFAULTS} {...props} />);
const names = () => screen.getAllByRole('listitem').map(item => within(item).getByText(/^(ROAS|CTR|CPC|CPM|CPA|Investimento|Cliques|Conversões|Impressões|Valor de conversões)$/).textContent);

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); api.put.mockResolvedValue({ data: {} }); api.get.mockResolvedValue({ data: {} }); });
afterEach(() => vi.useRealTimers());

describe('KpiBoard', () => {
  it('mostra só os indicadores escolhidos, com valor e comparação', () => {
    mount();
    expect(names()).toEqual(['ROAS', 'CTR', 'CPC']);
    expect(screen.getByText('4,20x')).toBeInTheDocument();
    expect(screen.getByText('12,5% vs. período anterior')).toBeInTheDocument();
  });

  it('colore a variação pelo que é bom: custo que sobe é pior, retorno que sobe é melhor', () => {
    mount();
    const cards = screen.getAllByRole('listitem');
    expect(within(cards[0]).getByText(/12,5%/).closest('p')).toHaveClass('is-better');
    expect(within(cards[2]).getByText(/8%/).closest('p')).toHaveClass('is-worse');
  });

  it('diz que não há comparação quando o período anterior está incompleto', () => {
    mount({ data: { ...data, previousComplete: false } });
    expect(screen.getAllByText('Sem comparação disponível')).toHaveLength(3);
  });

  it('personalizar mostra todos os indicadores; ocultar tira do painel e a escolha fica salva', () => {
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('3 de 10 indicadores no painel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar CTR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar CPM' }));
    fireEvent.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(names()).toEqual(['ROAS', 'CPC', 'CPM']);
    unmount();
    mount();
    expect(names()).toEqual(['ROAS', 'CPC', 'CPM']);
  });

  it('reordena pelos botões de mover (alternativa ao arrastar) e avisa a tecnologia assistiva', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover ROAS para frente' }));
    fireEvent.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(names()).toEqual(['CTR', 'ROAS', 'CPC']);
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    expect(screen.getByRole('button', { name: 'Mover CTR para trás' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('ROAS movido para a posição 2 de 10.');
  });

  it('reordena arrastando um cartão sobre outro', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    const cards = screen.getAllByRole('listitem');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(cards[2], { dataTransfer });
    fireEvent.dragEnter(screen.getAllByRole('listitem')[0]);
    fireEvent.dragEnd(screen.getAllByRole('listitem')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(names()).toEqual(['CPC', 'ROAS', 'CTR']);
  });

  it('restaura o padrão', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar ROAS' }));
    fireEvent.click(screen.getByRole('button', { name: /Restaurar padrão/ }));
    fireEvent.click(screen.getByRole('button', { name: /Concluir/ }));
    expect(names()).toEqual(['ROAS', 'CTR', 'CPC']);
  });

  it('com tudo oculto, convida a escolher indicadores', () => {
    mount({ defaultVisible: [] });
    expect(screen.getByText('Nenhum indicador no painel.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Escolher indicadores/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });

  it('grava a escolha no perfil (com atraso) quando há sessão real', () => {
    vi.useFakeTimers();
    localStorage.setItem('token', 'jwt'); localStorage.setItem('userName', 'Ana');
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar CTR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar CPC' }));
    expect(api.put).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/auth/me', { nome: 'Ana', preferences: { dashboardCards: ['roas'] } });
  });

  it('na demonstração a escolha fica só no navegador', () => {
    vi.useFakeTimers();
    localStorage.setItem('eyesight-demo', '1'); localStorage.setItem('token', 'jwt'); localStorage.setItem('userName', 'Ana');
    mount({ remote: true });
    fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar CTR' }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(api.put).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('com remote, usa a escolha guardada no perfil ao abrir', async () => {
    api.get.mockResolvedValue({ data: { usuario: { preferences: { dashboardCards: ['cpm', 'roas'] } } } });
    mount({ remote: true });
    expect(await screen.findByText('CPM')).toBeInTheDocument();
    expect(names()).toEqual(['CPM', 'ROAS']);
  });

  it('se o perfil não responde, segue com o padrão', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    mount({ remote: true });
    await act(async () => {});
    expect(names()).toEqual(['ROAS', 'CTR', 'CPC']);
  });
});
