import { previousLabel } from '../../utils/verdictCopy';
import { explanationLines, explanationTitle } from '../../utils/changeCopy';
import '../../styles/Overview.css';

const PREFIX = { main: 'O principal motivo: ', also: 'Também contribuiu: ', offset: 'Ajudou a compensar: ' };

/* "Por que mudou?": mostra qual fator moveu o custo, em linguagem simples. Some quando não há dado suficiente. */
export default function ChangeExplainer({ explanation, ctx, level = 2 }) {
  const Heading = `h${level}`;
  const lines = explanationLines(explanation);
  if (!lines.length) return null;
  return <section className="ov-why" role="region" aria-labelledby="ov-why-title">
    <Heading id="ov-why-title">{explanationTitle(explanation)}</Heading>
    <ul>
      {lines.map(line => <li key={line.kind + line.text} className={`is-${line.kind}`}>{PREFIX[line.kind]}{line.text}</li>)}
    </ul>
    <p className="ov-why-note">Comparado com {previousLabel(ctx.period)}. Os fatores são partes do custo: o preço para aparecer, a taxa de cliques e a taxa de conversão.</p>
  </section>;
}
