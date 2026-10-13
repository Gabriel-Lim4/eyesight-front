# Diário de bordo — Eyesight (melhorias com apoio de IA)

Período: 08/10/2026 a 11/10/2026 · Autor do registro: Gabriel Oliveira (Desenvolvimento Back-end), com o assistente de IA (Claude Code)
como parceiro de desenvolvimento · Horários no fuso de Brasília.

> Este diário resume o que foi feito desde o primeiro pedido de melhoria até a última entrega. Cada dia lista o que foi
> decidido, o que foi construído, o que deu errado e como foi resolvido. Os documentos citados ficam em `docs/superpowers/`
> (especificações, planos e auditorias) e `docs/tcc/` (roteiros).

## Como trabalhamos (método)

Para cada melhoria seguimos o mesmo ciclo, em português e com o usuário decidindo as escolhas importantes:

1. **Brainstorm:** o assistente lê o código, diagnostica e faz uma pergunta por vez (com opções e uma recomendação).
2. **Especificação:** o desenho aprovado vira um documento (`docs/superpowers/specs/`), com decisões, o que fica de fora e critérios de sucesso.
3. **Plano de implementação:** tarefas pequenas, cada uma com os testes escritos antes do código (`docs/superpowers/plans/`).
4. **Execução com TDD:** escrever o teste, vê-lo falhar, escrever o código mínimo, ver passar; commits pequenos.
5. **Revisão final independente:** outro modelo de IA (o mais capaz disponível) lê tudo sem ter participado da escrita e lista problemas por gravidade.
6. **Uma rodada de correções:** os problemas graves e importantes são corrigidos, cada um com um teste que falha antes e passa depois; os menores ficam registrados.

Regras de segurança que o assistente seguiu o tempo todo: não enviar código ao GitHub sem o usuário (depende do token dele),
nunca mostrar chaves e segredos, não alterar o banco real sem autorização expressa naquele momento e não mexer em produção sozinho.

## Ponto de partida (08/10, quinta, 17h)

O Eyesight já existia: front em React + Vite, back em Express + Prisma com Supabase (Postgres), contas Meta Ads e Google Ads por OAuth,
métricas diárias, assistente de IA e modo de demonstração. Pedido do dia: *"use a skill de brainstorm e me ajude a melhorar o
software, tanto nas funções e usabilidade quanto no UI e UX"*.

Diagnóstico inicial do assistente: o sistema era bem construído tecnicamente, mas **falava a língua de quem já entende de
tráfego**: 8 indicadores de uma vez (CTR, CPC, CPM, ROAS…) sem dizer se estavam bons, alertas com termos técnicos, moeda exibida como
"(moeda desconhecida)", assistente de IA escondido em outra aba, primeira sessão com 4 a 5 passos manuais sem guia, sincronização só manual
e relatório apenas em CSV. Havia ainda CSS gigante (a landing tinha 4 mil linhas).

**Decisões do usuário:** prioridade para o **produto real para usuários reais** (depois a demonstração para a banca e a
qualidade técnica); público principal: **dono de pequena empresa** que roda os próprios anúncios e tem pouca familiaridade com métricas.
O pedido amplo foi dividido em 5 sub-projetos, cada um com seu ciclo completo.

---

## 08/10 (quinta) — três sub-projetos num dia

### Sub-projeto 1 · Primeiros passos (17h15 – 17h50)
- **Problema:** o novo usuário tinha de se cadastrar, entrar, ir a Contas, conectar, voltar ao painel e clicar em sincronizar.
- **Decisões:** um **cartão "Primeiros passos"** no topo do painel (não um assistente em tela cheia), com progresso **derivado dos dados reais** (conta conectada, existem métricas, última sincronização) em vez de salvo no banco; a **sincronização automática** é disparada pelo front ao voltar do OAuth.
- **Construído:** cartão com 3 passos, hook de sincronização automática (uma vez, limpa a URL), preferência "dispensado" gravada no perfil, retorno ao painel ao sair da demonstração.
- **Verificação:** back 68 testes, front 77, lint e build ok.
- **Revisão independente:** 2 problemas importantes corrigidos com teste antes/depois: o cartão "piscava" para pendente e permitia um segundo sync (risco de estourar o limite de 5/min); e o contraste do erro no tema claro.

### Sub-projeto 2 · Visão geral em linguagem simples (17h58 – ~19h)
- **Objetivo:** em menos de 10 segundos a pessoa entende "meus anúncios estão indo bem?" e "o que devo fazer?".
- **Decisões:** um **veredito** (vai bem / estável / atenção / sem base para avaliar) calculado no servidor como função pura; a **meta do usuário** tem precedência e o padrão é a comparação com o período anterior; **nada de "benchmarks de mercado"** inventados; textos em português gerados no front a partir de códigos; o modo demonstração recebe uma versão reduzida da lógica.
- **Construído:** faixa de veredito, 4 cartões em linguagem simples ("Você investiu", "Pessoas que clicaram", "Resultados", "Custo por resultado"), "O que fazer agora" com até 3 ações, formulário de metas em linguagem simples. A análise completa continua disponível.

### Sub-projeto 3, fase A · Assistente que explica (18h42 – 21h17)
- **Ideia:** botões "Explicar" ao lado do veredito, dos cartões, das razões e das ações abrem um painel lateral para conversar com a IA sobre aquele item.
- **Decisões:** o **servidor monta o contexto** (veredito e metas); o navegador só informa o que o usuário está olhando; nada é enviado sozinho, só no clique (limite de 20 por hora); a IA nunca contradiz o painel.
- **Verificação:** back 132, front 185.
- **Revisão independente:** 4 problemas importantes corrigidos (resposta de um painel descartado aparecendo em outro, requisição antiga travando as perguntas seguintes, painel reaparecendo ao voltar ao filtro, foco do teclado saindo do painel).

### A IA de verdade: troca para um provedor gratuito (21h29 – 22h35)
- O usuário perguntou se a IA e o "esqueci a senha" realmente funcionavam. Resposta honesta do assistente: os testes passam, mas usam respostas simuladas; a chave da IA estava vazia nesta máquina.
- **Erro do assistente, corrigido por ele mesmo:** ele leu só a primeira ocorrência de cada variável do `.env`, que tinha um bloco duplicado no fim; as chaves estavam preenchidas. Criou o `scripts/check-env.mjs`, que confere o `.env` sem nunca imprimir valores.
- **Decisão do usuário:** não gastar com IA. O código foi tornado **compatível com qualquer provedor no formato da OpenAI** (endereço configurável) e o usuário escolheu o **Gemini (plano gratuito)**.
- **Contratempos:** o modelo indicado inicialmente não estava mais disponível para contas novas (a própria API recomendou um mais novo) e houve "alta demanda" temporária. Depois de ajustar o `.env`, chat e análise estruturada (JSON) responderam e passaram na validação do app.

### Sub-projeto 3, fase B · Plano de ações com passos marcáveis (22h41 – 23h22)
- **Decisão central:** os cartões são **as ações que o veredito já calcula** (a IA só escreve o passo a passo, nunca inventa prioridades). A chamada só acontece ao clicar em "Ver passo a passo".
- **Construído:** de 3 a 5 passos marcáveis com progresso salvo, "Gerar de novo", plano ligado à ação (some se a ação some; volta com o progresso se reaparecer em 30 dias). Nova tabela `planos_acao` (SQL aditivo, aplicado no Supabase **só depois do "pode aplicar" do usuário**, com RLS ligado).
- **Verificação:** back 157, front 223.
- **Revisão independente:** 4 importantes corrigidos (lista relida após sincronizar, estado "gerando" preservado, geração iniciada num filtro não trava o próximo, dois pedidos simultâneos não sobrescrevem o plano) e a perda de foco do teclado.

---

## 09/10 (sexta) — rotina automática, e-mail e publicação

### Sub-projeto 4, etapa 1 · Rotina diária e resumo semanal por e-mail (madrugada e tarde)
- **Problema:** nada rodava sozinho; os dados só atualizavam quando alguém abria o painel.
- **Decisões:** **opt-in** (desligado por padrão, com link de "parar de receber" que funciona sem login); agendamento por **pg_cron + pg_net** no Supabase chamando uma rota protegida do backend (o Render pode "dormir", então não se usa relógio dentro do servidor); o segredo fica no Vault; o e-mail traz o mesmo veredito do painel (últimos 7 dias), os 4 números, até 3 ações e um link.
- **Revisão independente:** 2 importantes corrigidos — uma sincronização lenta consumia todo o tempo e ninguém recebia o resumo (agora cada fase tem seu tempo: 5 min para sincronizar e 3 min para enviar) e cliques rápidos na chave do perfil deixavam tela e servidor divergentes. Um risco foi **aceito conscientemente** (queda do servidor entre a reserva e o envio pode perder ou duplicar um e-mail da semana), porque corrigir exigiria colunas novas e regras de reenvio, mais complexidade do que o risco justifica.
- **Verificação:** back 205, front 244.

### Banco, segredos e publicação (tarde)
- **Banco:** a tabela `rotina_envios` foi criada com autorização expressa do usuário; o assistente também rodou as consultas SQL do job em modo leitura contra o schema real, que nenhum teste cobria.
- **Segredos:** `JOBS_SECRET` e `UNSUBSCRIBE_SECRET` foram gerados e gravados no `.env` sem aparecer na conversa. **Incidente:** o editor reescreveu o `.env` com a versão antiga e apagou os dois valores; como ninguém os usava ainda, foram gerados novos, sem perda. Um backup do `.env` foi criado no projeto e **precisa ser apagado** depois de conferido (contém chaves).
- **Publicação:** o assistente descobriu pela própria resposta do servidor (404 na rota do job) que a versão nova do backend ainda não estava no Render; o usuário publicou e configurou os segredos (a rota passou a responder 401 sem credenciais, como esperado).
- **GitHub:** o envio pelo navegador recusava o front (limite de 100 arquivos; ele tem 131). Solução: repositório local com `git` e push pelo terminal.

### Primeiro push e agendamento (noite, 22h30 – 23h30)
- O assistente preparou o repositório (com `.env` fora do versionamento) e o push falhou por falta de credenciais no ambiente do assistente. O usuário percebeu que o repositório tinha **um ponto sobrando no nome**; depois de renomear, o push funcionou (131 arquivos, sem segredos).
- O usuário criou o segredo no Vault do Supabase; o assistente conferiu que os valores batiam (comparando hashes, sem expor), testou a rota real (202) e ativou as extensões e **os dois agendamentos diários** (acordar o backend e rodar a rotina).

---

## 09/10 a 10/10 — acessibilidade e tema (sub-projeto 5)

### 5a · Acessibilidade e consistência (noite de sexta, concluída no sábado à tarde)
- **Auditoria repetível:** `npm run a11y` (Playwright + axe-core, só em desenvolvimento). Linha de base: **56 das 64 combinações com problema bloqueante**; rolagem horizontal a 360px em todas as telas do app.
- **Correções reais:** ícones sem nome acessível, estouro de 1px no celular (causa única: uma linha de luz decorativa lateral), `autocomplete` inválido no cadastro, contraste no login e links do tema claro, área de toque da senha e foco visível da caixa de termos. "Metas" passou a ter um nome só; fonte carregada por um único link; código órfão removido.
- **Resultado:** de 56 para **0 combinações bloqueantes**; a revisão independente achou 5 importantes, todos corrigidos. 58 verificações de contraste ficaram "indecisas" (fundos com gradiente) para conferência manual.

### 5b · Variáveis de design e tema claro (sábado, 16h – 17h45)
- **Objetivo:** trocar a camada de sobrescritas do tema claro por um conjunto único de variáveis de cor **sem nenhuma mudança visível**.
- **Prova:** ferramenta que compara as cores calculadas de cada elemento, antes e depois, por tela (`npm run theme:compare`), com a regra "cada área só é aceita com zero diferenças".
- **Falha descoberta e honesta:** a comparação inicial dava "zero diferenças" mas **não provava nada nas telas de login, cadastro e esqueci-senha**, porque o tema claro não era aplicado nelas. Depois de refazer a base a partir do código original, apareceram **74 diferenças** só nessas telas; cinco regras do claro tinham sido removidas por engano e foram restauradas. Resultado final: **0 diferenças em 60 capturas**, com uma única mudança visual intencional (azul do link "Cadastre-se" escurecido para passar no contraste).

---

## 10/10 (sábado) — autonomia total e a nova landing

Às 17h46 o usuário pediu: *"assim que terminar pode executar todos os próximos passos e melhorar a landing page com a skill de front
end… pode fazer sem medo e sem pedir minha autorização, do jeito que preferir"*. O assistente manteve as salvaguardas (nada de push,
nada em produção, nada de segredos) e **marcou o ponto anterior com a etiqueta `antes-da-landing`** para desfazer em um comando.

### 5c · Nova landing page (skill `frontend-design`)
- **Conceito:** "papel e tinta". O topo é o próprio **veredito do produto**: três abas (dentro da meta, estável, atenção) mostram a frase que o painel daria, com o aviso de valores ilustrativos. Sem cartões repetidos; fontes Bricolage Grotesque (títulos) e Inter (texto); cores de status como acento. Os números sem significado ("2 / IA / 1 painel") foram removidos e nenhuma afirmação nova foi inventada.
- **Problemas encontrados e resolvidos:** botões com texto escuro por especificidade de CSS, contraste de um texto no claro, estilos da landing antiga "vazando" para os botões do login (corrigido, com 34 diferenças visuais intencionais documentadas), menu do celular sem "Entrar", cabeçalho a 360px e link de pular sem alvo.

### Sub-projeto 4, etapa 2 · Alerta por mudança de estado
- **Decisões autônomas:** alerta por e-mail **opt-in**, só na **entrada em "atenção"**, no máximo 1 por dia e 3 dias entre alertas, primeiro dia apenas registra o estado (para não alertar sobre algo antigo), suprimido se o resumo semanal saiu na mesma rodada, sem nenhuma mudança de banco. Cancelamento por escopo (só alertas) sem login.
- **Revisão independente:** importantes corrigidos (estado antigo reaproveitado, estado gravado antes do envio, falhas de liberação silenciosas) e os da landing.
- **Verificação do dia:** back 223, front 344, lint limpo, auditoria sem bloqueios.

---

## 10/10 (noite) a 11/10 (domingo) — revisão da landing e entrega do TCC

### Revisão da landing, com skills pesquisadas
- O usuário pediu para revisar a landing e **buscar skills específicas na internet**. O assistente encontrou várias (de design visual, de texto e de movimento) e, em vez de instalar código de terceiros, **leu as regras e aplicou só as úteis**.
- **Defeitos reais corrigidos:** título colado nas listas de passos e recursos (um reset de CSS anulava a margem), linhas desalinhadas em "Recursos" e uma chamada final que deixava metade da tela vazia. A objeção "preciso criar conta para ver?" foi respondida no topo e no FAQ, com fatos que o produto já afirma.
- **Push:** o assistente não tinha credenciais; o usuário enviou pelo próprio terminal (12 commits, sem segredos).

### Brainstorm geral e foco no TCC
- O usuário pediu para pensar **tudo** que poderia existir no Eyesight para tráfego pago e campanhas. O assistente organizou ideias em 8 grupos (entender o que mudou, evitar desperdício, agir, metas e negócio, mais fontes de dados, agências, IA e produto) com valor e esforço estimados.
- **Decisão do usuário:** *"entregar o TCC bem acabado"*, com **3 semanas** de prazo. Isso cortou novos canais, ações que escrevem nas plataformas, várias contas de cliente e plano pago (viram **trabalhos futuros**) e priorizou profundidade em poucas funções, validação com pessoas reais e documentação.
- O usuário autorizou o assistente a decidir tudo e executar à noite.

### Três funcionalidades novas (spec: `2026-10-11-diagnostico-e-acompanhamento-design.md`)
1. **"Por que mudou?"** — quando o custo por resultado (ou por clique) varia, o sistema decompõe a variação em **custo para aparecer (CPM), taxa de cliques (CTR) e taxa de conversão**. A decomposição é **exata, em logaritmos** (`Δln custo = Δln CPM − Δln CTR − Δln taxa de conversão`), e as parcelas somam 100%; uma parcela negativa indica um fator que compensou parte da variação. O sistema **se recusa a explicar** sem dados suficientes (menos de 30 cliques, períodos incompletos, variação menor que 5%). Aparece em um bloco logo abaixo do veredito, em linguagem simples.
2. **Acompanhamento do plano de ação** — cada passo concluído grava a data (`doneAt`) no JSON existente, **sem mudar o banco**; o corte é o dia do primeiro passo concluído; o sistema compara até 7 dias antes com os dias depois (mínimo de 3) e mostra "melhorou/piorou/ficou igual", sempre avisando que **outros fatores podem ter influenciado** (é indício, não prova).
3. **Gasto sem resultado** — novo motivo de **atenção** no veredito quando conversões são medidas e iguais a zero e o gasto passa de **2× a meta de custo por resultado**. Como o alerta por e-mail reage à mudança de estado do veredito, ele passa a avisar esse caso sem código novo.
- **Demonstração com história completa:** a demo ganhou uma narrativa — nos últimos 15 dias duas campanhas perdem taxa de conversão, a meta é R$ 32, a campanha pior aparece em "O que fazer agora", o plano passo a passo e o acompanhamento (ilustrativo) —, para a banca ver as três funções sem precisar de conta real.
- **Decisão adiada com justificativa:** o "ritmo do orçamento" (projeção até o fim do mês) ficou de fora, porque o limite de gasto atual vale para o período selecionado e projetá-lo exigiria uma nova configuração mensal.
- **Revisão independente (modelo mais capaz):** conferiu a matemática da decomposição (parcelas somam 100%, sinais certos, divisões por zero impossíveis), fusos, planos antigos, falhas isoladas e segurança, e encontrou **2 problemas importantes**, corrigidos com teste que falhou antes: (1) ao desmarcar o único passo concluído, o texto antigo de acompanhamento continuava na tela; (2) o dia de hoje, ainda parcial, entrava na janela "depois" e podia fazer o gasto por dia parecer menor do que era. Corrigi também 3 menores baratos (repetir o mesmo "feito" não muda mais a data do corte; frase "pelo menos o dobro da meta"; região de leitura de tela sempre montada para anunciar o acompanhamento).
- **Adiado (menores, registrados):** o plano de conta muda de números conforme o filtro de plataforma; o plano devolvido por outra aba e o PATCH vêm sem acompanhamento até a próxima leitura; uma corrida de releitura rara e não demonstrada.
- **Verificação final:** back 255 testes, front 367, lint limpo, build ok, auditoria de acessibilidade sem bloqueios e comparação de tema sem mudança de estilo em nenhum elemento já existente das telas do app (só surgem os blocos novos).

### Madrugada de 11/10 — autonomia total ("faça tudo que conseguir que melhore")
O usuário foi dormir deixando carta branca. O assistente manteve as salvaguardas (nada de push, nada em produção, nenhum segredo exposto) e escolheu o que mais ajuda o TCC:
1. **Backend versionado:** a pasta do backend não era repositório git. Foi criado um repositório **local**, depois de conferir que `.env` e `node_modules` ficam de fora e de varrer os 91 arquivos atrás de padrões de chave (nenhum encontrado). Sem remoto: o usuário decide onde publicar.
2. **Relatório para o cliente** (`/app/relatorio`): documento com o veredito, os quatro números, "por que mudou", "o que fazer agora" e a tabela das campanhas, em papel claro nos dois temas, **imprimível e salvável em PDF** pelo navegador. Sem backend novo. A auditoria de acessibilidade pegou três defeitos reais na tela nova (contraste do botão, estouro horizontal a 360px e tabela rolável sem acesso por teclado), todos corrigidos; o PDF foi gerado e inspecionado, e um segundo defeito (barra lateral saindo na impressão) foi corrigido por especificidade de CSS.
3. **Criptografia em repouso dos tokens das contas de anúncio** (AES-256-GCM): opcional e compatível. Sem a chave, nada muda; com a chave, os tokens novos são gravados cifrados (`enc:v1:…`) e os antigos em texto continuam legíveis. Erros não revelam conteúdo; chave errada ou valor adulterado falha com mensagem clara. Só passa a valer quando o usuário definir `TOKEN_ENCRYPTION_KEY` no Render.
4. **Landing:** teclas Home/End nas abas do veredito e Esc fechando o menu do celular com retorno do foco (itens que estavam na lista de pendências).
5. **Documentação técnica:** `docs/tcc/arquitetura-e-seguranca.md` (diagramas, modelo de dados, fluxos, API, tabela de segurança/LGPD com limites honestos, estratégia de testes e como rodar).
- **Revisão independente do trabalho da madrugada:** sem problemas críticos. Corrigidos: hierarquia de títulos do relatório (o bloco "Por que mudou" era h2 no meio de h3), seletores de impressão mais específicos, tag GCM de 16 bytes e IV de 12 validados no cofre, formato estrito para considerar um valor "já cifrado" e erros do cofre com status HTTP (token ilegível pede reconexão na sincronização). **Adiados:** nada migra tokens antigos para o formato cifrado (só quando a conta é reconectada; vale um script de backfill), o tratamento dos erros do cofre nos controladores do Meta e do Instagram ainda é genérico e o foco devolvido pelo Esc quando já estava em outro lugar.
- **Verificação:** back 269 testes, front 386, lint limpo, auditoria de acessibilidade sem bloqueios (agora 68 combinações).

### Documentação de apoio ao TCC
- `docs/tcc/roteiro-teste-de-usabilidade.md` — roteiro, tarefas, SEQ e SUS, planilha de resultados.
- `docs/tcc/roteiro-de-apresentacao.md` — roteiro de 5 minutos, plano B e perguntas prováveis da banca.
- `docs/tcc/arquitetura-e-seguranca.md` — arquitetura, dados, segurança, testes e como rodar.
- Este diário de bordo.

---

## Balanço

| Sub-projeto | Entrega | Testes ao final |
|---|---|---|
| 1 Primeiros passos | Cartão, sync automático | back 68 · front 77 |
| 2 Visão geral simples | Veredito e cartões | — |
| 3A Explicador | Painel "Explicar" | back 132 · front 185 |
| 3B Plano de ações | Passos marcáveis | back 157 · front 223 |
| 4.1 Rotina e resumo | E-mail semanal + agendamento | back 205 · front 244 |
| 5a Acessibilidade | 56 → 0 bloqueios | front 273 |
| 5b Tema por variáveis | 0 diferenças / 60 capturas | front 327 |
| 5c Landing + 4.2 alertas | Nova landing, alerta por estado | back 223 · front 344 |
| TCC: diagnóstico e acompanhamento | 3 funções + demo | back 255 · front 367 |
| Madrugada: relatório, cofre de tokens, backend no git | Relatório em PDF, criptografia opcional | back 269 · front 386 |

## Lições aprendidas
- **Provar o que se afirma:** a primeira comparação de tema "passava" sem medir o tema claro nas telas de autenticação; só uma base refeita revelou 74 diferenças. Uma verificação que nunca falha não verifica nada.
- **Ler o arquivo inteiro:** um bloco duplicado no `.env` levou a uma conclusão errada, corrigida depois com uma ferramenta que não imprime valores.
- **Revisão independente compensa:** em todas as etapas ela achou problemas reais (corridas entre requisições, foco do teclado, estado gravado antes do envio).
- **Decidir com honestidade:** riscos aceitos e itens adiados ficam registrados (especificações e este diário), em vez de escondidos.
- **IA com limites:** a IA só explica números calculados pelo servidor, nunca sozinha e com limite por hora; as funções novas de diagnóstico são determinísticas e testáveis, sem IA.

## Pendências e próximos passos
- **Do usuário:** variáveis secretas no Render, chave e domínio verificado do Resend, ligar e testar o resumo semanal e os alertas, apagar o backup do `.env` na raiz do projeto depois de conferido, conferir à mão o contraste (verificações "indecisas"), leitor de tela e zoom de 200%.
- **Para a banca:** aplicar o roteiro de usabilidade com 3 a 5 pessoas e registrar os resultados.
- **Trabalhos futuros:** várias contas de clientes, relatório em PDF, novos canais (TikTok, LinkedIn), ações dentro das plataformas, ritmo do orçamento, teste A/B de campanhas, plano pago.
- **Backend:** agora há um repositório git **local** (sem remoto); crie o repositório no GitHub e publique pelo seu terminal quando quiser.
- **Segurança:** definir `TOKEN_ENCRYPTION_KEY` no Render para ligar a criptografia dos tokens (guarde a chave: perdê-la obriga a reconectar as contas) e restringir o CORS ao endereço do front.
