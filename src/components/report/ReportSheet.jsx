import ChangeExplainer from '../overview/ChangeExplainer';
import { format, formatMoney, formatPercent } from '../../utils/format';
import { CARD_COPY, actionText, headline, previousLabel, previousLabelTo, reasonText } from '../../utils/verdictCopy';
import '../../styles/Report.css';

const STATUS = { good: 'Vai bem', stable: 'Estável', attention: 'Atenção', insufficient: 'Sem base para avaliar' };
const PLATFORM = { meta: 'Meta Ads', google: 'Google Ads' };
const WORD = { better: 'melhorou', worse: 'piorou' };
const day = value => (value ? value.split('-').reverse().join('/') : '');

function cardCopy(item, indicator) {
  if (item.key === 'conversions' && !item.available) return CARD_COPY.conversionsMissing;
  if (item.key === 'cost') return indicator === 'cpc' ? CARD_COPY.costCpc : CARD_COPY.costCpa;
  return CARD_COPY[item.key];
}

function cardValue(item, copy, ctx) {
  if (copy.value) return copy.value;
  if (item.key === 'spend' || item.key === 'cost') return formatMoney(item.value, ctx.currency);
  return format(item.value, item.key === 'conversions' ? 'decimal' : 'number');
}

function changeText(item, ctx) {
  if (item.key === 'conversions' && !item.available) return '';
  if (item.trend === 'unknown' || item.change == null) return 'Sem período anterior para comparar.';
  if (item.trend === 'stable') return `Igual ${previousLabelTo(ctx.period)}.`;
  const text = `${formatPercent(Math.abs(item.change))} ${item.change > 0 ? 'mais' : 'menos'} que ${previousLabel(ctx.period)}`;
  return WORD[item.trend] ? `${text}: ${WORD[item.trend]}.` : `${text}.`;
}

/* Documento do relatório para o cliente: só apresentação, sem busca de dados nem estado. */
export default function ReportSheet({ data, clientName = '', platformLabel, generatedAt = new Date() }) {
  const name = clientName.trim();
  const title = name || 'Relatório de anúncios';
  const { verdict } = data;
  const ctx = { currency: data.currency, period: data.period };
  const campaigns = (data.campaigns || []).filter(campaign => campaign.hasData).sort((a, b) => b.metrics.spend - a.metrics.spend).slice(0, 10);
  const ready = data.hasData && verdict;
  return <article className="rp-sheet" aria-label={name ? `Relatório de anúncios: ${name}` : 'Relatório de anúncios'}>
    <header className="rp-head">
      <h2>{title}</h2>
      <p>{platformLabel} · {day(data.period.since)} a {day(data.period.until)} · Gerado em {generatedAt.toLocaleDateString('pt-BR')}</p>
      {data.demo && <p className="rp-demo">Relatório com dados fictícios de demonstração.</p>}
    </header>
    {!ready && <p className="rp-empty">Não há dados neste período para montar o relatório.</p>}
    {ready && <>
      <section className="rp-section" aria-labelledby="rp-verdict">
        <h3 id="rp-verdict">Como estão os anúncios</h3>
        <p className="rp-status">{STATUS[verdict.status] || STATUS.insufficient}</p>
        <p className="rp-headline">{headline(verdict, ctx)}</p>
        <ul>{verdict.reasons.map(reason => ({ code: reason.code, text: reasonText(reason, ctx) })).filter(reason => reason.text).map(reason => <li key={reason.text}>{reason.text}</li>)}</ul>
      </section>
      <section className="rp-section" aria-labelledby="rp-numbers" role="region">
        <h3 id="rp-numbers">Números do período</h3>
        <dl className="rp-numbers">
          {verdict.highlights.map(item => {
            const copy = cardCopy(item, verdict.indicator);
            return <div key={item.key}><dt>{copy.title}</dt><dd><strong>{cardValue(item, copy, ctx)}</strong><span>{changeText(item, ctx)}</span></dd></div>;
          })}
        </dl>
      </section>
      <ChangeExplainer explanation={data.changeExplanation} ctx={ctx} />
      <section className="rp-section" aria-labelledby="rp-actions" role="region">
        <h3 id="rp-actions">O que fazer agora</h3>
        <ul>{verdict.actions.map(action => <li key={`${action.code}-${action.campaignId ?? ''}`}>{actionText(action, ctx)}</li>)}</ul>
      </section>
      {campaigns.length > 0 && <section className="rp-section" aria-labelledby="rp-campaigns">
        <h3 id="rp-campaigns">Campanhas</h3>
        <div className="rp-scroll" tabIndex={0} role="region" aria-label="Tabela de campanhas, role para o lado se faltar espaço">
        <table aria-label="Campanhas do período">
          <thead><tr><th scope="col">Campanha</th><th scope="col">Plataforma</th><th scope="col">Investimento</th><th scope="col">Resultados</th><th scope="col">Custo por resultado</th></tr></thead>
          <tbody>{campaigns.map(campaign => <tr key={campaign.id}>
            <td>{campaign.name}</td>
            <td>{PLATFORM[campaign.platform] || campaign.platform}</td>
            <td>{formatMoney(campaign.metrics.spend, ctx.currency)}</td>
            <td>{campaign.metrics.conversions == null ? 'Não registrado' : format(campaign.metrics.conversions, 'decimal')}</td>
            <td>{campaign.metrics.cpa == null ? '—' : formatMoney(campaign.metrics.cpa, ctx.currency)}</td>
          </tr>)}</tbody>
        </table>
        </div>
      </section>}
    </>}
    {(data.warnings || []).length > 0 && <section className="rp-section rp-notes" aria-labelledby="rp-notes">
      <h3 id="rp-notes">Observações</h3>
      <ul>{data.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    </section>}
    <footer className="rp-foot">Relatório gerado pelo Eyesight. Os valores seguem a atribuição de cada plataforma e não representam lucro líquido.</footer>
  </article>;
}
