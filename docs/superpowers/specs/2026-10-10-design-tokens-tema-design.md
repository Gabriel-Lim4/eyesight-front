# Variáveis de design e tema claro (sub-projeto 5, parte 5b)

A parte 5c (landing, `Home.css`) terá spec própria. A 5a (acessibilidade e consistência) já foi entregue e fornece a auditoria `npm run a11y` e o módulo de matriz de telas que esta parte reaproveita.

## Objetivo

Trocar a camada de sobrescritas do tema claro por um único conjunto de variáveis semânticas de cor, **sem nenhuma mudança visível**. O tema claro passa a ser definido só pela redefinição das variáveis, as regras das telas passam a usar `var(--…)` para cor, e a manutenção deixa de exigir achar a regra escura e a sobrescrita clara em arquivos diferentes.

## Decisões já tomadas

- Escopo da mudança visual: **nenhuma**. Cada cor continua exatamente a mesma; só muda a origem. Cores quase iguais ficam em variáveis separadas até uma decisão posterior do usuário.
- Caminho: variáveis primeiro, migração **por área**, cada área só aceita com zero diferença numa comparação de cores calculadas.
- A landing (`Home.css` e as variáveis próprias dela) fica fora.

## Situação de partida (medida em 2026-10-10)

- Quatro sistemas de variáveis com nomes que se sobrepõem: `--bg-page/--bg-container/--text-primary…` (`variables.css`), `--app-bg/--app-surface/--app-muted…` (`Theme.css`), `--bg/--surface/--text/--accent/--border` (landing) e `--ov-*` (`Overview.css`). Para o mesmo papel há valores **diferentes** no tema claro (por exemplo fundo da página `#f1f5f9` contra `#f5f7fb`; azul `#3b82f6` contra `#2563eb`).
- Linhas contendo `body.light-mode` nos CSS do app (sem a landing): **321**, das quais 293 em `Theme.css` (108 regras, pois uma regra pode ocupar várias linhas). Mais 69 `!important` em `Theme.css`, que existem para vencer a especificidade das regras originais.
- Cores escritas à mão nos CSS do app: `#3b82f6` (63), `#1e293b` (62), `#94a3b8` (56), `#ffffff` (49), `#8b5cf6` (38), `#64748b` (33), `#0f172a` (26) e outras.

## Fora do escopo

- Redesenho, mudança de tamanho, espaçamento ou fonte; a landing; remover `!important` de layout (Dashboard, Sidebar); unificar tons parecidos (decisão futura com capturas de tela).

## Rede de segurança: comparação de cores calculadas

Peça compartilhada `scripts/lib/session.mjs` (construir com `vite build`, subir `vite preview` rodando o `vite` direto pelo `node`, abrir contexto com tema e largura, simular as fontes do Google, desligar animações e transições). A auditoria de acessibilidade passa a importar essas mesmas peças, sem mudar o comportamento dela.

Comandos novos (em `package.json`):
- `npm run theme:snapshot`: grava o estado atual.
- `npm run theme:compare`: compara o estado atual com o gravado.
- `npm run theme:pairs`: gera a tabela de pares (cor no escuro → cor no claro).
- `npm run theme:stats`: conta linhas com `body.light-mode`, cores escritas à mão e linhas de CSS nos arquivos do app.

Captura:
- Telas do app e de autenticação da matriz da 5a, em tema escuro e claro, 1280×800 e 360×740, mais os dois estados da Visão geral (painel "Explicar" aberto e "Suas metas" expandida).
- Para cada elemento visível: `color`, `background-color`, `background-image`, as quatro cores de borda, `box-shadow`, `fill`, `stroke`, `text-decoration-color`, `opacity`, e as mesmas propriedades de `::before` e `::after` quando o `content` não é `none`.
- Identificação do elemento: caminho de `tag:nth-child` desde o `body`.
- Linha de base gravada **antes** de qualquer mudança de estilo, em `eyesight-front/.theme-baseline/` (ignorada pelo git, pois é grande e específica da máquina).
- Determinismo: gravar duas vezes seguidas no mesmo código deve dar zero diferença (verificado na primeira tarefa). Dados do modo demonstração que variem com o dia entram na comparação só pelas cores, e as variações de cor dependentes de dado (estado do veredito) precisam ser estáveis na janela de uma execução.

Saída de `theme:compare`: por tela/tema/largura/estado, a quantidade de elementos que mudaram e as dez primeiras diferenças (caminho, propriedade, antes → depois). Código de saída 1 se houver qualquer diferença. Um elemento presente só de um lado conta como diferença.

Limites assumidos: estados `:hover`, `:active` e `:focus` não entram; a verificação desses estados é por comparação textual das regras de cada arquivo (cada regra `:hover`/`:focus`/`:active` movida mantém o mesmo valor de cor) e pela auditoria de acessibilidade, que cobre o foco. Tamanho, espaçamento e fonte não são medidos; o estouro horizontal em 360px é coberto pela auditoria.

## Variáveis

### Origem dos valores
`theme:pairs` cruza a captura escura e a clara e lista cada par `(valor no escuro → valor no claro)` por classe de propriedade (texto, fundo, borda, sombra, preenchimento/traço), com a contagem de elementos e exemplos de caminho. Cada par frequente vira uma variável com **nome de papel**; pares raros usam variável local do componente. A tabela resultante é registrada em `docs/superpowers/audits/2026-10-10-tokens-pares.md`.

### Vocabulário
Base: `variables.css`. Nomes existentes mantidos: `--bg-page`, `--bg-container`, `--bg-input`, `--border-color`, `--text-primary`, `--text-secondary`, `--accent-blue`, `--accent-purple`, `--gradient-btn`, `--gradient-left`. Os valores `--app-*` hoje em `Theme.css` migram para `variables.css` sob nomes de papel (sem alterar valores). Papéis esperados a partir das cores mais repetidas: fundo elevado, fundo discreto, borda discreta, texto discreto, texto sobre destaque, azul para texto, violeta de destaque, sucesso, alerta, erro e anel de foco. `--ov-good/--ov-stable/--ov-attention/--ov-unknown` passam a `--status-good/--status-stable/--status-attention/--status-unknown`. Se dois sistemas tiverem valores diferentes para o mesmo papel, ficam **duas variáveis**, com o sufixo que distingue o papel (nunca um valor é alterado para unificar).

### Mecanismo
- Todas as variáveis de cor são definidas só em `variables.css`: valores escuros em `:root`, valores claros em `body.light-mode`.
- Nos arquivos de tela, cor é sempre `var(--…)`. Uma regra `body.light-mode …` em arquivo de tela só é aceita quando o tema claro muda algo que **não** é cor (estrutura, imagem, forma de sombra); essas exceções ficam ao lado do componente e entram na lista de exceções do documento de pares.
- `Theme.css` fica só com o que é do tema em si: base do `body`, botão de alternar tema e transição de cor.

### Regra de substituição
Trocar uma cor escrita à mão por variável **somente se** o valor escuro for idêntico ao da variável **e** a sobrescrita clara correspondente (se houver) for idêntica ao valor claro da variável. Caso contrário, usar uma variável mais específica.

## Ordem de migração (uma área por vez; commit local por área)

1. Ferramentas e linha de base (módulo compartilhado, `snapshot`, `compare`, `pairs`, `stats`); gravar duas vezes e conferir zero diferença.
2. Definir as variáveis em `variables.css` sem usá-las ainda; `compare` continua com zero diferença.
3. Área A: `Overview`, `Onboarding`, `Explainer`, `Plans`, `Summary`, `Identity`.
4. Área B: `Login`, `Layout`.
5. Área C, uma por vez: `Dashboard`, `Sidebar`, `Profile`, `Account`, `Meta`, `Google`, `Instagram`, `Metrics`, `AnalyticsWorkspace`.
6. Limpeza de `Theme.css` e remoção dos sistemas de variáveis antigos sem uso (`--app-*`, `--ov-*`).

Entre áreas: `theme:compare` com zero diferença em **todas** as telas, `npm run a11y` com 0 bloqueantes, suíte, lint e build.

## Testes

- Vitest para as funções puras (módulos `scripts/theme/*.mjs`): diferença encontrada e sua localização; ordem estável dos elementos; valores iguais não geram diferença; elemento presente só de um lado; agrupamento de pares escuro→claro com contagem; separação por classe de propriedade.
- Teste de estrutura por leitura de arquivos: fora de `variables.css` e da lista de exceções, nenhum CSS de tela usa `body.light-mode` para cor; `Theme.css` não define variáveis de cor; todo `var(--x)` usado nos CSS do app tem definição em `variables.css`.
- A prova visual é a própria comparação de cores calculadas.

## Medição do resultado

`theme:stats` registra antes e depois: linhas com `body.light-mode` nos CSS do app (321 hoje), cores escritas à mão com variável equivalente (meta: zero), `!important` em `Theme.css` (69 hoje) e linhas dos CSS do app. O resultado vai para `docs/superpowers/audits/2026-10-10-tokens-pares.md`.

## Riscos e como são tratados

- Estados `:hover/:active/:focus` fora da captura: comparação textual por arquivo (ver acima).
- Cores próximas permanecem separadas, o que alonga a lista; unificação de tons é decisão futura.
- Captura não determinística por causa de animações ou de dados do demo: animações e transições são desligadas e a primeira tarefa só segue se duas gravações seguidas forem idênticas.
- Regressão por cascata (mudar a ordem ou a especificidade de regras): detectada pela comparação em todas as telas após cada área; se aparecer, o commit da área é desfeito.

## Entrega

Spec (este arquivo), plano em `docs/superpowers/plans/`, execução na modalidade que o usuário escolher, commits locais por área e revisão final independente. Nenhum `push`.
