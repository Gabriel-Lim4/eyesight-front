# Variáveis de design e tema claro (5b): medições

## Antes (2026-10-10, código de `82eca56`)
`npm run theme:stats`:
- linhas com `body.light-mode` nos CSS do app (sem a landing): **321**
- `!important` em `Theme.css`: **69**
- linhas de CSS do app: **8.971**
- cores escritas à mão: **691** (95 valores distintos). Mais usadas: `#1e293b`×62, `#94a3b8`×57, `#3b82f6`×56, `#ffffff`×46, `#8b5cf6`×37, `#64748b`×33, `#0f172a`×26, `#fff`×20, `#334155`×16, `#1f2937`×16, `#10b981`×14, `#8d9bb3`×13.

Linha de base de cores calculadas: **60 capturas** (13 telas × 2 temas × 2 larguras + 2 estados da Visão geral × 2 temas × 2 larguras), gravadas em ~3 min, **com os estados `:hover`, `:focus-visible` e `:active` forçados** nos até 60 elementos interativos de cada tela. Duas gravações seguidas deram **zero diferença** (a captura é determinística).

## Variáveis geradas (pares medidos)

Cada variável é exatamente um par (cor no escuro → cor no claro) medido pela linha de base; "usos" soma elementos, estados e pseudo-elementos nas 60 capturas (a lateral aparece em todas as telas do app). Regerar com `npm run theme:tokens -- --write`.

62 variáveis (36 mudam com o tema, 26 são constantes); 6 já existiam em variables.css.

| variável | escuro | claro | usos |
|---|---|---|---|
| `--text-primary` | `#ffffff` | `#0f172a` | 16152 |
| `--text-secondary` | `#94a3b8` | `#64748b` | 14190 |
| `--c-000000` | `#000000` | `#000000` | 9313 |
| `--border-color` | `#1e293b` | `#e2e8f0` | 6205 |
| `--text-nav` | `#8291a8` | `#111827` | 5528 |
| `--text-body` | `#ffffff` | `#111827` | 3343 |
| `--c-1e293b--d9e2ef` | `#1e293b` | `#d9e2ef` | 2126 |
| `--c-ffffff` | `#ffffff` | `#ffffff` | 1632 |
| `--text-nav-muted` | `#8291a8` | `#64748b` | 1360 |
| `--accent-blue` | `#3b82f6` | `#3b82f6` | 1184 |
| `--bg-container` | `#0b1120` | `#ffffff` | 748 |
| `--c-8291a8--2563eb` | `#8291a8` | `#2563eb` | 680 |
| `--status-stable` | `#93c5fd` | `#1d4ed8` | 648 |
| `--c-94a3b8` | `#94a3b8` | `#94a3b8` | 552 |
| `--bg-field` | `#020617` | `#ffffff` | 520 |
| `--c-cdd9ff--2563eb` | `#cdd9ff` | `#2563eb` | 360 |
| `--c-93c5fd--7c3aed` | `#93c5fd` | `#7c3aed` | 360 |
| `--c-cbd5e1--64748b` | `#cbd5e1` | `#64748b` | 330 |
| `--c-1e293b` | `#1e293b` | `#1e293b` | 288 |
| `--c-rgba-148-163-184-0_28` | `rgba(148, 163, 184, 0.28)` | `rgba(148, 163, 184, 0.28)` | 264 |
| `--c-2563eb` | `#2563eb` | `#2563eb` | 262 |
| `--c-f8fafc` | `#f8fafc` | `#f8fafc` | 250 |
| `--status-good` | `#34d399` | `#047857` | 232 |
| `--c-94a3b8--111827` | `#94a3b8` | `#111827` | 220 |
| `--bg-active` | `transparent` | `#f1f5f9` | 208 |
| `--c-cdd9ff--1d4ed8` | `#cdd9ff` | `#1d4ed8` | 180 |
| `--bg-input` | `#020617` | `#f8fafc` | 168 |
| `--c-3b82f6--1d4ed8` | `#3b82f6` | `#1d4ed8` | 160 |
| `--c-d9714a--2563eb` | `#d9714a` | `#2563eb` | 150 |
| `--c-334155--d9e2ef` | `#334155` | `#d9e2ef` | 132 |
| `--c-e2e8f0--64748b` | `#e2e8f0` | `#64748b` | 110 |
| `--c-0b1120` | `#0b1120` | `#0b1120` | 100 |
| `--c-rgba-59-130-246-0_25` | `rgba(59, 130, 246, 0.25)` | `rgba(59, 130, 246, 0.25)` | 96 |
| `--c-cdd9ff--111827` | `#cdd9ff` | `#111827` | 90 |
| `--c-rgba-59-130-246-0_45` | `rgba(59, 130, 246, 0.45)` | `rgba(59, 130, 246, 0.45)` | 88 |
| `--c-94a3b8--d9e2ef` | `#94a3b8` | `#d9e2ef` | 77 |
| `--c-ffffff--d9e2ef` | `#ffffff` | `#d9e2ef` | 77 |
| `--c-020617` | `#020617` | `#020617` | 64 |
| `--bg-app` | `#04070f` | `#eef2f8` | 44 |
| `--c-transparent--d9e2ef` | `transparent` | `#d9e2ef` | 44 |
| `--c-1e293b--ffffff` | `#1e293b` | `#ffffff` | 33 |
| `--c-e2e8f0` | `#e2e8f0` | `#e2e8f0` | 30 |
| `--c-rgba-59-130-246-0_08` | `rgba(59, 130, 246, 0.08)` | `rgba(59, 130, 246, 0.08)` | 26 |
| `--c-rgba-217-113-74-0_25--rgba-124-58-237-0_18` | `rgba(217, 113, 74, 0.25)` | `rgba(124, 58, 237, 0.18)` | 24 |
| `--c-rgba-147-51-234-0_2` | `rgba(147, 51, 234, 0.2)` | `rgba(147, 51, 234, 0.2)` | 24 |
| `--c-rgba-59-130-246-0_3` | `rgba(59, 130, 246, 0.3)` | `rgba(59, 130, 246, 0.3)` | 24 |
| `--c-0b1120--rgba-255-255-255-0_96` | `#0b1120` | `rgba(255, 255, 255, 0.96)` | 22 |
| `--c-10b981` | `#10b981` | `#10b981` | 22 |
| `--c-1b2436--d9e2ef` | `#1b2436` | `#d9e2ef` | 22 |
| `--c-rgba-59-130-246-0_55` | `rgba(59, 130, 246, 0.55)` | `rgba(59, 130, 246, 0.55)` | 16 |
| `--c-9ca3af` | `#9ca3af` | `#9ca3af` | 12 |
| `--c-rgba-59-130-246-0_05` | `rgba(59, 130, 246, 0.05)` | `rgba(59, 130, 246, 0.05)` | 12 |
| `--c-ffffff--64748b` | `#ffffff` | `#64748b` | 11 |
| `--c-334155--ffffff` | `#334155` | `#ffffff` | 11 |
| `--c-1b2436` | `#1b2436` | `#1b2436` | 11 |
| `--c-transparent--ffffff` | `transparent` | `#ffffff` | 8 |
| `--c-rgba-217-113-74-0_1--transparent` | `rgba(217, 113, 74, 0.1)` | `transparent` | 6 |
| `--c-04070f` | `#04070f` | `#04070f` | 6 |
| `--c-rgba-147-51-234-0_04` | `rgba(147, 51, 234, 0.04)` | `rgba(147, 51, 234, 0.04)` | 6 |
| `--c-rgba-59-130-246-0_1` | `rgba(59, 130, 246, 0.1)` | `rgba(59, 130, 246, 0.1)` | 6 |
| `--c-rgba-255-255-255-0_04` | `rgba(255, 255, 255, 0.04)` | `rgba(255, 255, 255, 0.04)` | 6 |
| `--c-rgba-0-0-0-0_45` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.45)` | 2 |

---

## Depois (2026-10-10, fim da 5b)

| Medida | Antes | Depois |
|---|---|---|
| Cores escritas à mão nos CSS do app | 691 (95 valores) | **0** |
| Linhas com `body.light-mode` (sem a landing) | 321 | 307 |
| `!important` em `Theme.css` | 69 | 60 |
| Linhas de CSS do app | 8.971 | 9.155 |
| Variáveis de cor definidas | 10 (`variables.css`) + 8 (`--app-*`) + 4 (`--ov-*`) em três lugares | **240** nomes, todos em `variables.css` (pares medidos, constantes e as 10 originais) |
| Sistemas de variáveis do app | 3 (`--bg-*/--text-*`, `--app-*`, `--ov-*`) | **1** (`--app-*` e `--ov-*` aposentados) |

Verificações do estado final: `theme:compare` **zero diferença em 60 capturas** (inclui `:hover`, `:focus-visible` e `:active` forçados); `npm run a11y` **0 de 64 bloqueantes** (58 verificações de contraste indecisas, como antes); 327 testes, lint e build verdes.

### Desvio em relação à spec
A spec previa eliminar a camada de sobrescritas `body.light-mode`. Isso **não é mecanicamente seguro**. Das 551 declarações de cor dessa camada, só 32% têm uma declaração original com o mesmo seletor e a mesma propriedade; 14% diferem pela família da propriedade; 17% têm o seletor, mas a regra original não declara aquela cor; e 38% não têm nenhuma regra original com aquele seletor (o tema claro foi escrito como uma "pele" separada). Para essa maioria, remover a sobrescrita exigiria reescrever o escuro de componentes inteiros, sem como provar neutralidade onde o demo não renderiza.

Desfecho adotado: (1) sobrescritas com par exato (e por família de propriedade) viraram variáveis do par e foram removidas; (2) **toda** outra cor virou variável constante (mesmo valor nos dois temas, neutro por construção), inclusive dentro das sobrescritas que ficaram; (3) as sobrescritas sem contraparte permanecem **isoladas em `Theme.css`**, só com `var()`. A landing (`Home.css` e o bloco `body.light-mode .home` de `Theme.css`) não foi tocada.

### Defeitos da ferramenta que a comparação de cores expôs (todos corrigidos antes de chegar ao app)
1. Ao achar o fim de uma regra, o leitor de CSS não pulava comentários: um parêntese ou aspa solto num comentário fazia perder o resto do arquivo (`Dashboard.css` lia 5 de 229 regras).
2. O nome da propriedade era contaminado por um comentário anterior à declaração.
3. Uma sobrescrita era removida quando só **uma** das regras originais que ela cobre era emparelhada, deixando outra sem o valor claro.
4. Várias sobrescritas para o mesmo elemento: removia só a que coincidia com a vencedora, deixando uma `!important` mais antiga que passava a vencer.
5. Remover uma sobrescrita (principalmente `!important`) mudava o resultado de regras irmãs que ela vencia por especificidade (`:hover`, modificadores). Regra adotada: nunca emparelhar nem remover quando a vencedora é `!important` ou quando há regra com estado na mesma propriedade.

### Achados da limpeza
- `Plans.css` usava `var(--ov-good, <reserva>)`: remover `--ov-good` faria o tema claro cair no verde do escuro numa tela que o demo não renderiza (a comparação não veria). Corrigido, e o teste de estrutura agora exige que toda variável usada esteja definida **mesmo com valor de reserva**.
- `Sidebar.css` usava `var(--gradient-brand, …)`, variável que nunca existiu: sempre valia a reserva. Trocada pela reserva (neutro).

### O que a comparação não prova (conferência manual)
Estados que o demo não renderiza (erro, vazio, carregando, modais, plano concluído) e a landing. Para o que foi **tokenizado como constante** a neutralidade vale por construção; para os poucos **pares removidos** a prova é a comparação nas telas renderizadas.

## Correção posterior (reparo da prova de neutralidade)

- A captura clara das telas de autenticação não aplicava a classe `light-mode` (a rota não lê o tema salvo), então a comparação anterior não provava nada para login, cadastro e esqueci-senha no claro. Corrigido em `scripts/lib/session.mjs`, com guarda (`themesWithoutEffect`) que falha se claro e escuro forem idênticos numa tela.
- Linha de base refeita a partir do código original (commit 82eca56) em worktree separado. A comparação revelou 74 diferenças só nessas telas (fundo do cartão e do painel, fundo dos campos, cor do `.register`, hover de `.fp-tab-btn`), causadas por sobrescritas removidas pelo codemod nas áreas A e B. Todas restauradas como variáveis constantes; resultado: **zero diferença em 60 capturas**.
- Única mudança visual intencional: `.register span` no tema claro passa de `#3b82f6` para `#2563eb` (contraste 4,5:1; a auditoria, agora realmente medindo o claro, apontava violação serious). Auditoria: nenhum problema bloqueante no app e na autenticação.
- Pendências conhecidas: `COLOR_PROPS` não cobre `filter`, `scrollbar-color` e `stop-color`; sobrescritas não são removidas quando o vencedor é `!important` ou há regra de estado.

## 5c — landing (decisões tomadas sem consulta, a pedido do usuário)

- `Home.jsx` e `Home.css` reescritos (tag git `antes-da-landing` volta ao visual anterior). Direção: o hero é o veredito do produto (frases reais de `verdictCopy.js`, valores ilustrativos e avisados como tal), sem cartões, acento = cores de status. Fonte de títulos: Bricolage Grotesque.
- Textos de produto preservados (FAQ, passos, recursos, equipe); removidos os números "2 / IA / 1 painel" por não informarem nada. Seletor global `.btn-login` da landing antiga vazava para o login: corrigido, o que muda 34 detalhes visuais nas telas de autenticação (botão com texto branco no claro; hover mantém o degradê). Mudança aceita.
- `Theme.css` perdeu o bloco da landing; `Sidebar.css` perdia `var(--surface)` (só existia na landing): trocado pela cor de reserva que já valia.
- Auditoria: landing 0 violações nos 4 cenários; app e autenticação sem bloqueantes.
