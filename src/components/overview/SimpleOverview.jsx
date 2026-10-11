import ExplainerPanel from '../explainer/ExplainerPanel';
import { STATE_COPY } from '../explainer/explainerCopy';
import { useExplainer } from '../explainer/useExplainer';
import { usePlans } from '../plans/usePlans';
import ChangeExplainer from './ChangeExplainer';
import GoalsForm from './GoalsForm';
import HighlightCards from './HighlightCards';
import NextActions from './NextActions';
import VerdictBanner from './VerdictBanner';
import '../../styles/Overview.css';

function isDemo() {
  try { return localStorage.getItem('eyesight-demo') === '1'; } catch { return false; }
}

const PLATFORM = { all: 'Todas as plataformas', meta: 'Meta Ads', google: 'Google Ads' };

/* Visão geral em linguagem simples; plugada no AnalyticsWorkspace pela prop `overview`. */
export default function SimpleOverview({ data, filters, alertSettings, reload }) {
  const { verdict } = data;
  const explainer = useExplainer(filters);
  const actionsVersion = (verdict?.actions ?? []).map(action => `${action.code}:${action.campaignId ?? '-'}`).join('|');
  const plans = usePlans(filters, actionsVersion);
  if (!verdict) return <p className="ov-fallback" role="status">Não foi possível montar o resumo agora.</p>;
  const ctx = { currency: data.currency, period: data.period };
  const campaign = data.availableCampaigns?.find(item => String(item.id) === String(filters.campaignId));
  const currency = data.currencies?.length > 1 ? ` · ${data.currency === 'UNKNOWN' ? 'moeda não identificada' : data.currency}` : '';
  const scopeLabel = `${PLATFORM[filters.platform] || PLATFORM.all} · ${campaign ? campaign.name : 'todas as campanhas'}${currency}`;
  const demo = isDemo();
  const explain = explainer.available === null ? null : { open: explainer.open, disabled: !explainer.available, describedBy: explainer.available ? undefined : 'ov-ai-unavailable' };
  return <>
    {explainer.available === false && <p id="ov-ai-unavailable" className="ex-note" role="status">{STATE_COPY.unavailable}</p>}
    <VerdictBanner verdict={verdict} scopeLabel={scopeLabel} ctx={ctx} explain={explain} />
    <ChangeExplainer explanation={data.changeExplanation} ctx={ctx} />
    {data.currency === 'UNKNOWN' && <p className="ov-warning">Não conseguimos identificar a moeda da sua conta.</p>}
    <HighlightCards highlights={verdict.highlights} indicator={verdict.indicator} basis={verdict.basis} ctx={ctx} goals={{ cpaMax: alertSettings?.cpaMax }} explain={explain} />
    <NextActions actions={verdict.actions} ctx={ctx} explain={explain} plans={plans} aiAvailable={explainer.available !== false} />
    <GoalsForm alertSettings={alertSettings} currency={data.currency} disabled={demo} onSaved={() => reload('Metas salvas.')} />
    {explainer.focus && <ExplainerPanel focus={explainer.focus} messages={explainer.messages} pendingText={explainer.pendingText} state={explainer.state} error={explainer.error} onAsk={explainer.ask} onClose={explainer.close} />}
  </>;
}
