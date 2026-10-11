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

  it('o conteúdo principal é o alvo do link de pular para o conteúdo', () => {
    renderHome();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('o menu de celular oferece Entrar e troca o nome do botão ao abrir', () => {
    renderHome();
    const menu = screen.getByRole('navigation', { name: 'Seções da página' });
    expect(within(menu).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('as abas do veredito respondem a Home e End, e o foco acompanha', () => {
    renderHome();
    const [primeira, , ultima] = screen.getAllByRole('tab');
    primeira.focus();
    fireEvent.keyDown(primeira, { key: 'End' });
    expect(ultima).toHaveAttribute('aria-selected', 'true');
    expect(ultima).toHaveFocus();
    fireEvent.keyDown(ultima, { key: 'Home' });
    expect(primeira).toHaveAttribute('aria-selected', 'true');
    expect(primeira).toHaveFocus();
  });

  it('Esc fecha o menu de celular e devolve o foco ao botão', () => {
    renderHome();
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    fireEvent.click(botao);
    const aberto = screen.getByRole('button', { name: 'Fechar menu' });
    expect(aberto).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    const fechado = screen.getByRole('button', { name: 'Abrir menu' });
    expect(fechado).toHaveAttribute('aria-expanded', 'false');
    expect(fechado).toHaveFocus();
  });

  it('Esc sem menu aberto não faz nada', () => {
    renderHome();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
