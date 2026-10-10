import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Home from '../Home';

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe('Home (landing)', () => {
  it('abre com o veredito de atenção e mostra o que fazer', () => {
    renderHome();
    const painel = screen.getByRole('tabpanel');
    expect(within(painel).getByText(/Atenção: o custo por resultado está acima da sua meta/)).toBeInTheDocument();
    expect(within(painel).getByText(/O que fazer/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Atenção' })).toHaveAttribute('aria-selected', 'true');
  });

  it('troca o veredito de exemplo ao escolher outro estado', () => {
    renderHome();
    fireEvent.click(screen.getByRole('tab', { name: 'Dentro da meta' }));
    const painel = screen.getByRole('tabpanel');
    expect(within(painel).getByText('Seus anúncios estão dentro da sua meta.')).toBeInTheDocument();
    expect(within(painel).getByText('Nada urgente por enquanto. Continue acompanhando.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Atenção' })).toHaveAttribute('aria-selected', 'false');
  });

  it('avisa que o exemplo usa dados de demonstração', () => {
    renderHome();
    expect(screen.getByText(/Exemplo com dados de demonstração/)).toBeInTheDocument();
  });

  it('as perguntas frequentes abrem e fecham, ligadas à resposta', () => {
    renderHome();
    const pergunta = screen.getByRole('button', { name: /Os dados são atualizados em tempo real/ });
    expect(pergunta).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pergunta);
    expect(pergunta).toHaveAttribute('aria-expanded', 'true');
    const resposta = document.getElementById(pergunta.getAttribute('aria-controls'));
    expect(resposta).toHaveTextContent(/não são dados em tempo real/);
    fireEvent.click(pergunta);
    expect(pergunta).toHaveAttribute('aria-expanded', 'false');
  });

  it('tem um único h1 e os links de entrada e cadastro', () => {
    renderHome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Entrar/ })[0]).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: /Cadastrar/ })[0]).toHaveAttribute('href', '/cadastro');
  });

  it('o menu de celular abre e fecha com aria-expanded', () => {
    renderHome();
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
  });
});
