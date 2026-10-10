import { Link } from 'react-router-dom';
import ExplainButton from '../explainer/ExplainButton';
import ActionPlan from '../plans/ActionPlan';
import { actionText } from '../../utils/verdictCopy';
import '../../styles/Overview.css';

export default function NextActions({ actions, ctx, explain, plans, aiAvailable = true }) {
  return <section className="ov-actions" aria-labelledby="ov-actions-title">
    <h2 id="ov-actions-title">O que fazer agora</h2>
    <ul>
      {actions.map(action => <li key={`${action.code}-${action.campaignId ?? ''}`}>
        <span>{actionText(action, ctx)}</span>
        {explain
          ? <ExplainButton label={actionText(action, ctx)} onClick={() => explain.open({ kind: 'action', code: action.code, ...(action.campaignId != null ? { campaignId: action.campaignId } : {}) })} disabled={explain.disabled} describedBy={explain.describedBy} />
          : action.campaignId != null && <Link to="/app/assistant">Perguntar ao assistente</Link>}
        {plans && <ActionPlan action={{ code: action.code, ...(action.campaignId != null ? { campaignId: action.campaignId } : {}) }} plans={plans} available={aiAvailable} describedBy={explain?.describedBy} />}
      </li>)}
    </ul>
  </section>;
}
