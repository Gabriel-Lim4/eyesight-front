import { CircleCheck, CircleHelp, Minus, TriangleAlert } from 'lucide-react';
import ExplainButton from '../explainer/ExplainButton';
import { headline, reasonText } from '../../utils/verdictCopy';
import '../../styles/Overview.css';

const STATUS = {
  good: { label: 'Vai bem', Icon: CircleCheck },
  stable: { label: 'Estável', Icon: Minus },
  attention: { label: 'Atenção', Icon: TriangleAlert },
  insufficient: { label: 'Sem base para avaliar', Icon: CircleHelp },
};

export default function VerdictBanner({ verdict, scopeLabel, ctx, explain }) {
  const { label, Icon } = STATUS[verdict.status] || STATUS.insufficient;
  const reasons = (verdict.reasons || []).map(reason => ({ code: reason.code, text: reasonText(reason, ctx) })).filter(reason => reason.text);
  return <section className={`ov-verdict is-${verdict.status}`} role="region" aria-labelledby="ov-verdict-title" aria-live="polite">
    <div className="ov-verdict-head">
      <Icon className="ov-verdict-icon" size={28} aria-hidden="true" />
      <div>
        <h2 id="ov-verdict-title">Como estão seus anúncios</h2>
        <span className="ov-status-label">{label}</span>
      </div>
      {explain && <ExplainButton label="Como estão seus anúncios" onClick={() => explain.open({ kind: 'verdict' })} disabled={explain.disabled} describedBy={explain.describedBy} />}
    </div>
    <p className="ov-headline">{headline(verdict, ctx)}</p>
    {scopeLabel && <p className="ov-scope">{scopeLabel}</p>}
    {reasons.length > 0 && <ul className="ov-reasons">{reasons.map(({ code, text }) => <li key={text}>
      <span>{text}</span>
      {explain && <ExplainButton label={text} onClick={() => explain.open({ kind: 'reason', code })} disabled={explain.disabled} describedBy={explain.describedBy} />}
    </li>)}</ul>}
  </section>;
}
