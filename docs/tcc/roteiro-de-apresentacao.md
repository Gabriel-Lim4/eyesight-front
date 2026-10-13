# Roteiro de apresentação (5 minutos) e plano B

A demonstração roda **sem login, sem conta de anúncios e sem o servidor**: os dados são fictícios e vêm do próprio navegador.
Por isso funciona mesmo com a internet ruim. Abra o site já com a demonstração carregada antes de começar.

## Antes de entrar na sala (checklist)
- [ ] Site aberto em `/demo` (ou `npm run dev` / `npm run preview` no `eyesight-front`), tela cheia, zoom 100%.
- [ ] Tema escuro (é o padrão); deixe o botão de tema à mão para mostrar o claro se perguntarem.
- [ ] Segunda aba com a página inicial (`/`) e terceira com o repositório/documentação, por precaução.
- [ ] Notificações do sistema desligadas; carregador na tomada.
- [ ] Se houver tempo: uma conta real conectada **só como bônus**; nunca depender dela.

## Roteiro (cada bloco com o que falar e o que clicar)
**0:00 – 0:40 · O problema.** Página inicial. "Quem cuida de anúncios abre o painel de cada plataforma só para montar um relatório,
e quem não é especialista não sabe se o número é bom." Mostrar o topo da página: as três abas do veredito (dentro da meta, estável, atenção).

**0:40 – 1:30 · A resposta em uma frase.** Entrar na demonstração. Mostrar o veredito: "em menos de 10 segundos, em português simples,
o sistema diz se está bom ou não e usa a **meta** do próprio usuário". Apontar os quatro números (investimento, cliques, resultados, custo por resultado).

**1:30 – 2:45 · Por que mudou? (a parte de profundidade).** Apontar o bloco "Por que o custo por resultado subiu…".
"O custo é um produto de três fatores: quanto custa aparecer, quantas pessoas clicam e quantos cliques viram resultado.
O sistema decompõe a variação, de forma exata (logaritmos), e mostra o fator principal. Aqui, duas campanhas perderam taxa de conversão."
Se perguntarem: as parcelas somam 100% e o sistema se recusa a explicar quando falta dado (poucos cliques, período incompleto).

**2:45 – 3:45 · O que fazer agora + acompanhamento.** "O que fazer agora" aponta a campanha acima da meta. Clicar em **Ver passo a passo**,
marcar o primeiro passo e mostrar o **acompanhamento**: "melhorou depois que você agiu?". Dizer que na demonstração o número é de exemplo
e que, no uso real, ele compara os dias antes e depois e avisa que outros fatores também podem ter influenciado.

**3:45 – 4:30 · O assistente e o e-mail.** (se faltar tempo, corte esta parte) Clicar em **Explicar** ao lado do veredito (resposta fixa de exemplo na demo). Mostrar, no perfil, o resumo semanal e o alerta
por e-mail (opt-in): "avisa uma vez, só quando passa para *atenção*, e há link para parar sem login".

**4:30 – 4:45 · Relatório para o cliente (bônus).** Menu **Relatório**: digitar o nome do cliente e mostrar o documento; "Imprimir ou salvar em PDF" gera uma folha limpa para entregar a quem paga pelos anúncios.

**4:45 – 5:00 · Fechamento.** Qualidade e honestidade: testes automatizados, auditoria de acessibilidade, tema claro/escuro,
IA que nunca contradiz o painel. Próximos passos (trabalhos futuros): várias contas de cliente, relatório em PDF, novos canais.

## Plano B (se algo falhar)
| Problema | O que fazer |
|---|---|
| Sem internet | `npm run preview` local; a demonstração não usa rede. |
| Site fora do ar | Usar o build local; manter o terminal pronto com o comando. |
| O bloco "Por que mudou?" não aparece | Mudar o período para **30 dias** no filtro; a história da demo foi montada para esse período. |
| Alguém pergunta de dados reais | Dizer que a demo usa dados fictícios por segurança, e que o fluxo real (OAuth Google/Meta) está implementado e coberto por testes. |
| Pergunta sobre a IA | Provedor compatível com a API da OpenAI (hoje Gemini no plano gratuito), com limite por hora e sem enviar nada sozinha. |

## Perguntas prováveis da banca (respostas curtas)
- **Por que não usar benchmarks de mercado?** Não há fonte confiável e honesta para comparar; o veredito usa a meta do usuário ou o período anterior.
- **Como garante que a IA não inventa números?** O servidor monta o contexto (veredito e metas) e a IA só explica; os números nunca vêm do navegador.
- **O acompanhamento prova que o plano funcionou?** Não; é um indício, e o texto diz isso. Prova exigiria teste controlado (A/B), listado como trabalho futuro.
- **E a privacidade?** Tokens ficam no servidor; e-mails só para quem ligou a opção; link de cancelar sem login; exclusão em cascata ao apagar o usuário.
