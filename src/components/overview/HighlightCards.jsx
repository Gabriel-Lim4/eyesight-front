import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import ExplainButton from '../explainer/ExplainButton';
import { format, formatMoney, formatPercent } from '../../utils/format';
import { CARD_COPY, previousLabel } from '../../utils/verdictCopy';
import '../../styles/Overview.css';

const WORD = { better: 'melhorou', worse: 'piorou', stable: 'igual' };

function copyFor(item, indicator) {
  if (item.key === 'conversions' && !item.available) return CARD_COPY.conversionsMissing;
  if (item.key === 'cost') return indicator === 'cpc' ? CARD_COPY.costCpc : CARD_COPY.costCpa;
  return CARD_COPY[item.key];
}

function valueFor(item, copy, ctx) {
  if (copy.value) return copy.value;
  if (item.key === 'spend' || item.key === 'cost') return formatMoney(item.value, ctx.currency);
  return format(item.value, item.key === 'conversions' ? 'decimal' : 'number');
}

function Comparison({ item, ctx }) {
  if (item.key === 'conversions' && !item.available) return null;
  if (item.trend === 'unknown' || item.change == null) return <p className="ov-compare is-unknown">Ainda sem período anterior para comparar</p>;
  const Arrow = item.trend === 'stable' ? Minus : item.change > 0 ? ArrowUp : ArrowDown;
  const text = `${formatPercent(Math.abs(item.change))} ${item.change > 0 ? 'mais' : 'menos'} que ${previousLabel(ctx.period)}`;
  return <p className={`ov-compare is-${item.trend}`}>
    <Arrow size={16} aria-hidden="true" />
    <span>{text}</span>
    {WORD[item.trend] && <strong>{WORD[item.trend]}</strong>}
  </p>;
}

function Goal({ item, indicator, basis, ctx, goals }) {
  const goal = Number(goals?.cpaMax);
  if (item.key !== 'cost' || indicator !== 'cpa' || !(goal > 0) || ctx.currency === 'UNKNOWN') return null;
  if (basis !== 'goal') return <p className="ov-goal">Sua meta: {formatMoney(goal, ctx.currency)}</p>;
  const within = item.value <= goal;
  return <p className={`ov-goal ${within ? 'is-within' : 'is-above'}`}>Sua meta: {formatMoney(goal, ctx.currency)} · {within ? 'dentro da meta' : 'acima da meta'}</p>;
}

export default function HighlightCards({ highlights, indicator, basis, ctx, goals, explain }) {
  return <ul className="ov-cards">
    {highlights.map(item => {
      const copy = copyFor(item, indicator);
      return <li className="ov-card" key={item.key}>
        <h3>{copy.title}</h3>
        <strong className="ov-value">{valueFor(item, copy, ctx)}</strong>
        <Comparison item={item} ctx={ctx} />
        <Goal item={item} indicator={indicator} basis={basis} ctx={ctx} goals={goals} />
        <p className="ov-hint">{copy.hint}</p>
        {explain && <ExplainButton label={copy.title} onClick={() => explain.open({ kind: 'card', key: item.key })} disabled={explain.disabled} describedBy={explain.describedBy} />}
      </li>;
    })}
  </ul>;
}
