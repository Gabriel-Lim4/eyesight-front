# Diário de bordo — Front-end do Eyesight: do dia 13/10 a 19/10

Autor do registro: Gabriel Oliveira, com o assistente de IA (Claude Code) · Horários no fuso de Brasília.

> **De onde vem a comparação.** O "front antigo" é o estado publicado em `Gabriel-Lim4/eyesight-front` no commit `0584351`
> (13/10, 19:04), que fechou o ciclo do diário principal (`diario-de-bordo.md`). O "front atual" é o commit `d9c2992`
> (19/10, 19:26). A cópia nova nasceu na pasta `eyesight/frontend` (17/10) **sem histórico de commits**, então o que mudou
> entre 13/10 e 19/10 foi reconstruído **comparando os arquivos** dos dois estados, e não dia a dia. Onde o texto diz
> "o código mostra", a afirmação vem dessa comparação; nada foi conferido olhando as telas no navegador.

## Resumo em números

| | Antigo (13/10) | Atual (19/10) |
|---|---|---|
| Arquivos alterados | — | 68 (≈ 10 mil linhas a mais, ≈ 3 mil a menos) |
| Testes do front | 386 | **410** (52 arquivos) |
| Lint / build | limpos | limpos |
| `Home.jsx` (landing) | 516 linhas | 976 linhas |
| `Sidebar.jsx` | 182 linhas | 213 linhas |
| `Profile.jsx` | 91 linhas | 145 linhas |
| `Login.jsx` | 502 linhas | 479 linhas |
| Folhas de estilo novas | — | 12 (`Landing`, `Polish`, `KpiBoard`, `TermsModal`, `AuthRefresh`, `AssistantRefresh`, `ProfilePro`, `Controls`, e outras) |

---

## 1. Painel de métricas: de cartões fixos para um quadro que o usuário monta

**Antes.** A tela de análises mostrava uma lista fixa de indicadores, desenhada com um `map` sobre a lista de métricas,
todos sempre à mostra, na mesma ordem.

**Agora.** O componente `KpiBoard` substitui essa lista (na visão completa, não na simples). O usuário:
- escolhe quais indicadores aparecem, entre dez: ROAS, CTR, CPA, CPC, CPM, investimento, valor de conversões, conversões,
  cliques e impressões;
- reordena e restaura o padrão;
- vê, em cada um, para onde a seta aponta quando o resultado melhora. O catálogo (`kpiCatalog.js`) diz, por indicador,
  se "subir é bom", "descer é bom" ou "sem juízo de valor" (investimento).

Há dois conjuntos padrão: um para a visão geral (`roas, ctr, cpc, cpm, impressões, receita`, porque os quatro cartões do
resumo já cobrem investimento, cliques, resultados e custo) e outro para a visão completa (oito indicadores).
A escolha é salva no perfil do usuário (campo `dashboardCards`), o que obrigou o backend a aceitar esse campo.

**Por quê.** Quem anuncia só em um canal não precisa de CPM, e quem vende precisa do ROAS à frente. Deixar o usuário
decidir reduz ruído sem tirar nada de quem quer tudo.

**Testes que nasceram junto:** `kpiCatalog.test.js` (37 linhas) e `KpiBoard.test.jsx` (130 linhas).

## 2. Termos de uso: de inexistentes para um modal organizado

**Antes.** O cadastro tinha o checkbox de aceite, mas não havia um texto de termos para abrir.

**Agora.** Há um texto próprio (`src/content/terms.txt`, 249 linhas, "última atualização: 14 de outubro de 2026") que
descreve o Eyesight como projeto acadêmico de TCC, o que o sistema faz e os direitos e deveres de quem o usa. O leitor
`parseTerms.js` transforma o texto em seções numeradas, e o `TermsModal` as exibe. No Login, o link dos termos abre o
modal e o botão "Li e concordo" marca a caixa e fecha a janela.

**Testes:** `TermsModal.test.jsx` e `parseTerms.test.js`.

## 3. Assistente de IA: de "Assistente de campanhas" para o Argos

**Antes.** Título genérico ("Assistente de campanhas"), mensagens como "Carregando assistente e histórico…" e a resposta
assinada como "Eyesight".

**Agora.** O assistente tem nome e voz: **Argos**. O título, o subtítulo ("Seu analista de campanhas: lê as métricas
sincronizadas e aponta os próximos passos"), a mensagem de carregamento ("Acordando o Argos…"), o aviso de
indisponibilidade, o rótulo da conversa, o texto de boas-vindas, o campo de pergunta e a assinatura das respostas foram
reescritos. A lógica não mudou; mudou a personalidade do produto. Ganhou também uma folha de estilo própria
(`AssistantRefresh.css`, 316 linhas).

## 4. Landing page: de uma página linear para uma narrativa de venda

**Antes (516 linhas).** Dez seções com classes `lp-*`: topo, comparação, demonstração, como funciona, uma faixa,
sobre, funcionalidades, FAQ, chamada final e equipe.

**Agora (976 linhas).** As mesmas dez seções, mais uma nova, em outra ordem e com outro desenho:
`hero2` (topo), `comparison`, **`personas`** (nova), `demo`, `how-it-works`, `about`, `features`, `faq`, `cta-banner` e
`team`. A página cresceu quase 90% e ganhou uma folha de estilo dedicada (`Landing.css`, 1.422 linhas) além do
`Home.css`, que passou a ter 3.558 linhas alteradas. O teste da landing (`Home.test.jsx`) foi reescrito para a nova
estrutura.

## 5. Autenticação: telas novas, mesma lógica, mais acessibilidade

**Login e cadastro.** O arquivo ficou ligeiramente menor (502 → 479 linhas) apesar de ter mais recursos: novo layout
(`AuthRefresh.css`), botão **Voltar** dentro do painel colorido, escolha entre modo claro e escuro direto na tela e o
modal de termos. O novo `LoginLayout.test.jsx` cobre esses quatro comportamentos.

**Recuperar senha.** Folha de estilo própria (`ForgotPassword.css`).

**Correções feitas hoje sobre essa tela** (achadas na revisão):
- rótulos ligados aos campos (antes o leitor de tela anunciava campos sem nome);
- "Esqueceu a senha?", "Cadastre-se" e "Entrar" eram `span` clicáveis, inalcançáveis pelo teclado; agora recebem foco e
  respondem a Enter e Espaço;
- a mensagem de erro passou a ser anunciada (`role="alert"`);
- o medidor de força da senha aparecia também no login, mostrando "Fraca" em vermelho para quem só ia entrar; agora só
  aparece no cadastro.

## 6. Barra lateral: mesma ideia, nova forma de abrir e fechar

**Antes (182 linhas).** O menu já recolhia e já lembrava a escolha no navegador (`eyesight-sidebar-collapsed`), já mostrava
o nome do usuário e a etiqueta "Demonstração". Para expandir havia um botão próprio ("Expandir menu"), além do "Sair" e do
atalho "Ver perfil".

**Agora (213 linhas).** O que mudou é a interação e o visual: **clicar na logo abre e fecha o menu, sem botão de seta**
(o teste `SidebarToggle.test.jsx` cobre isso), e a folha de estilo foi quase toda reescrita (`Sidebar.css`, ≈ 1.450 linhas
alteradas). A persistência da escolha, o nome e a etiqueta de demonstração já existiam e foram mantidos.

## 7. Perfil: de formulário simples para "Meu perfil"

**Antes (91 linhas).** Uma página com título, nome, e-mail, telefone, localização, tema, o resumo por e-mail e um bloco
"Contas conectadas".

**Agora (145 linhas).** Cabeçalho "Meu perfil — seus dados, aparência e segurança da conta", um cartão-resumo com o nome
da pessoa, a seção "Dados pessoais", o seletor de **tema** (claro/escuro) como grupo de botões acessível, a seção
**Alterar senha**, o resumo por e-mail e o atalho de "Contas conectadas". Folha de estilo nova: `ProfilePro.css`.
Os campos continuam com o `autoComplete` certo (nome, telefone, cidade) e ficam desativados na demonstração.

## 8. Base visual: tokens e polimento

O arquivo `variables.css` ganhou um conjunto de **tokens de design** que valem nos dois temas (espaçamento em grade de
4/8 px, entre outros) e respeita `prefers-reduced-motion` (animações quase eliminadas para quem pede menos movimento).
`Polish.css` (554 linhas) e `Controls.css` (65) concentram acabamento e controles. `Theme.css` e `index.css` foram
revisados. Ícones novos (`favicon` em cinco tamanhos, `apple-touch-icon`) e as logos do Google Ads (versão clara e
escura) entraram.

## 9. Conexão com o servidor

**Antes.** `baseURL = VITE_API_URL || 'http://localhost:3333'`: se a variável faltasse em produção, o site tentaria
falar com `localhost`.

**Agora.** `VITE_API_URL ?? (produção ? '' : 'http://localhost:3333')`: em produção, sem a variável, o site chama a API
no **mesmo endereço**, que é o desenho do deploy em um serviço só (`render.yaml`). Em desenvolvimento nada muda.

**Logout (correção de hoje).** Antes, se o servidor falhasse, a sessão ficava salva no navegador e a próxima pessoa do
computador continuava logada. Agora a sessão local é apagada de qualquer jeito (`try/finally`).

---

## O que deu errado e como foi resolvido

- **Rotas internas abertas.** Na cópia nova, o `App.jsx` tinha perdido a `RotaProtegida`, deixando todas as telas de
  `/app` visíveis sem login (os dados continuavam protegidos pelo servidor, mas a interface aparecia). A revisão
  independente achou; a proteção foi restaurada, mantendo a entrada pelo modo demonstração. O resultado final é igual
  ao comportamento do front antigo nesse ponto.
- **Sem repositório git.** Por não estar em git, a pasta nova impediu o `/security-review`. A revisão geral
  (`/code-review`, nível alto) cobriu o front e o backend.

## Verificação de hoje

- `npm run lint`: limpo · `npm test`: **410 testes, 52 arquivos, todos passando** · `npm run build`: ok.
- Varredura por padrões de chave antes do commit: nada encontrado. `.env` e `node_modules` não foram enviados.
- Publicado em `Gabriel-Lim4/eyesight-front` (`main`), commit `d9c2992`, sem force.

## Limites e pendências

- **Não vi as telas.** A comparação é de código, testes e build. Falta abrir o site (claro e escuro, celular) e conferir
  contraste, foco e zoom de 200%, como o diário principal já pedia.
- **Nome sobrescrito.** O `useKpiPrefs` manda o nome guardado no navegador a cada alteração de KPI; se a pessoa mudou o
  nome em outro lugar, o antigo pode voltar. Não foi corrigido.
- **Auditoria de acessibilidade e comparação de tema** (`a11y-report.json`, `.theme-baseline`): não foram refeitas para as
  telas novas. Vale rodar de novo antes da banca.
- **Evolução dia a dia** entre 13/10 e 19/10 não está registrada em commits; este documento é a reconstrução possível.
