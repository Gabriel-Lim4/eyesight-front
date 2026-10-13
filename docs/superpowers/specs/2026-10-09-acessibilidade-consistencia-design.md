# Acessibilidade e consistência do app (sub-projeto 5, parte 5a)

As partes 5b (variáveis de design e tema claro) e 5c (landing `Home.css`) terão specs próprias.

## Objetivo

Deixar o app logado e as telas de autenticação consistentes e acessíveis para usuários reais: um nome só para as metas, a fonte carregada uma vez, e uma auditoria repetível em navegador de verdade que prove contraste, rótulos, teclado e telas estreitas.

## Decisões já tomadas

- Prioridade: 5a agora; 5b e 5c depois, cada uma com sua spec.
- Verificação: Playwright + axe-core como dependências **só de desenvolvimento**, com o comando `npm run a11y`.
- Cursor customizado: `CustomCursor` nunca é montado em lugar nenhum (nenhum arquivo o importa), então não há nada a remover do app; os dois arquivos órfãos são apagados.
- Nome único: "Metas".

## Fora do escopo

- Redesenhar telas; reorganizar variáveis de cor e tema claro (5b); a landing (5c, que a auditoria só relata).
- Hospedar as fontes no próprio site (privacidade); testes com leitor de tela, zoom de 200% real e navegação por voz.
- Renomear campos ou rotas no backend (`ctrMin`, `cpaMax`, `budgetMax` e `/metricas/alertas` ficam como estão).

## Consistência

### Nome único: "Metas"
- Novo módulo `src/utils/goalsCopy.js` com os três campos e seus rótulos em linguagem simples, hoje em `GoalsForm.jsx`:
  - `cpaMax`: "Quero pagar, no máximo, por cada resultado" (dinheiro)
  - `budgetMax`: "Quero gastar, no máximo, no período" (dinheiro)
  - `ctrMin`: "Quero que pelo menos esta % de quem vê meu anúncio clique" (percentual)
  Mais os textos compartilhados: título "Suas metas", botão "Salvar metas", sucesso "Metas salvas.", erro "Não foi possível salvar as metas." e "Informe apenas números nas metas.".
- `GoalsForm.jsx` passa a importar esse módulo.
- `AnalyticsWorkspace.jsx` (análise completa): o botão "Limites de alerta" vira "Suas metas"; o título "Alertas por campanha" vira "Suas metas"; os rótulos "CTR mínimo (%)", "CPA máximo" e "Investimento máximo no período" passam a usar os rótulos acima; "Salvar limites" vira "Salvar metas". O texto de apoio passa a ser: "Com uma meta, as campanhas que passam dela aparecem em 'Campanhas que precisam de atenção'. Valores em dinheiro seguem a moeda selecionada. Deixe em branco para não usar."
- A lógica de salvar e a rota `PUT /metricas/alertas` não mudam.

### Fonte carregada uma vez
- Remover as 9 linhas `@import url('https://fonts.googleapis.com/...')` dos arquivos CSS.
- Acrescentar **um** `<link rel="stylesheet">` no `index.html` (os `preconnect` já existem), com a união dos pesos hoje usados, `display=swap`: Inter 400–800, Tomorrow 400/600/700, JetBrains Mono 400/500/600, IBM Plex Mono 400/500/600 e Space Grotesk 500/600/700 (as duas últimas só a landing usa). O navegador só baixa os arquivos de fonte que a página realmente usa, então incluir todas as famílias no CSS custa pouco.

### Limpeza
- Apagar `src/components/CustomCursor.jsx` e `src/components/CustomCursor.css`.

## Auditoria de acessibilidade

### Ferramentas
- `devDependencies`: `playwright` e `@axe-core/playwright`. Navegador: Chromium do próprio Playwright, baixado uma vez para `~/.cache/ms-playwright` (fora do projeto e do repositório).
- Script `scripts/a11y-audit.mjs` e `npm run a11y`: constrói o app (`vite build`), sobe `vite preview` em porta fixa, abre as telas e encerra o servidor. O modo demonstração dispensa login e backend: o script define `localStorage['eyesight-demo']='1'` e `localStorage['eyesight-theme']='light'|'dark'` com `context.addInitScript` antes de navegar.
- **Primeiro passo da execução é um teste mínimo** (abrir uma página e rodar o axe). Se o navegador não abrir neste Linux por falta de bibliotecas, parar e consultar o usuário antes de seguir (alternativa: verificação sem navegador mais lista de conferência para o Firefox dele).

### Matriz
- Telas do app em demo: `/app`, `/app/dashboard`, `/app/instagram`, `/app/google`, `/app/meta`, `/app/metrics`, `/app/account`, `/app/assistant`, `/app/profile`.
- Telas públicas: `/login`, `/cadastro`, `/esqueci-senha`, `/cancelar-resumo?t=x`. A landing `/` é auditada e apenas relatada.
- Temas escuro e claro × larguras 1280×800 e 360×740.
- Estados extras: painel "Explicar" aberto na Visão geral e a seção "Suas metas" expandida.

### Verificações por combinação
1. Regras do axe-core com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` e `wcag22aa` (contraste, rótulos, nomes de botões e links, papéis e marcos, ordem de títulos, texto alternativo).
2. Rolagem horizontal em 360px: `document.documentElement.scrollWidth` não pode exceder a largura da janela.
3. Indicador de foco: percorrer até 60 paradas de Tab; cada elemento focado deve ter contorno (`outline-style` diferente de `none` e largura > 0) ou sombra (`box-shadow` diferente de `none`) visível.
4. Área de toque de 44px: botões, campos e links fora de texto corrido com altura e largura menores que 44px são **avisos**, não falhas.

### Saída
- Tabela no terminal agrupada por tela, tema e largura (regra, gravidade, número de elementos) e arquivo JSON com os seletores, gravado fora do repositório (`.gitignore` do frontend ignora `a11y-report.json`).
- Código de saída 1 se houver problema `serious` ou `critical` nas telas do app ou nas telas públicas de autenticação, ou se houver rolagem horizontal ou elemento sem indicador de foco nessas telas. Landing e avisos de área de toque nunca falham o comando.

### Conferência manual (continua sendo do usuário)
Leitor de tela (NVDA ou VoiceOver) em Visão geral e Perfil; zoom de 200% do navegador; navegação só por teclado do login até a Visão geral; um e-mail do resumo semanal lido num cliente de e-mail.

## Regra para corrigir o que a auditoria achar

- **Entra na correção:** tudo que for `serious` ou `critical` nas telas do app e de autenticação, nos dois temas e nas duas larguras; rolagem horizontal em 360px; elementos focáveis sem indicador de foco.
- **Vira pendência registrada** (com contagem por tela): gravidade `moderate`/`minor`, avisos de área de toque e tudo da landing.
- As correções mantêm o visual atual: ajustar cores só o mínimo para atingir o contraste (4,5:1 texto normal; 3:1 texto grande e componentes de interface), nos arquivos de tema existentes, sem criar variáveis novas (isso é a 5b).
- Causa comum que gere muitas ocorrências é corrigida na causa. Se uma correção exigir mudar o desenho de uma tela, parar e consultar o usuário.

## Testes

- Nomes: os testes que citam "Limites de alerta", "Alertas por campanha" e "Salvar limites" são atualizados; um teste novo garante que `GoalsForm` e o formulário de `AnalyticsWorkspace` usam os mesmos rótulos de `goalsCopy.js` para as três metas.
- Fonte: teste de leitura de arquivos garante que nenhum `.css` contém `fonts.googleapis.com` e que `index.html` tem o `<link>` com as cinco famílias.
- Limpeza: teste garante que não resta referência a `CustomCursor` em `src`.
- Acessibilidade: para cada componente alterado, testes com Testing Library de nome acessível, papel e foco; cada correção encontrada pela auditoria ganha um teste que falhava antes sempre que o problema for testável em jsdom. Contraste e foco visual só se provam pela própria auditoria (de erro para limpa).
- Auditoria final: `npm run a11y` sem problemas bloqueantes; suíte completa, lint e build verdes; revisão independente.

## Ordem de entrega

1. Preparação: `npm ci`, dependências de desenvolvimento, teste mínimo do navegador, script `a11y` e a primeira auditoria completa, registrada como linha de base.
2. Consistência: "Metas" nos dois formulários, carga única da fonte e remoção do `CustomCursor`.
3. Correções de acessibilidade guiadas pela linha de base, em uma ou duas rodadas de auditoria.
4. Verificação final, revisão independente e lista de pendências.
