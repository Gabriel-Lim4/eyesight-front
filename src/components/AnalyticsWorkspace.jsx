import { GOAL_FIELDS, GOALS_COPY } from '../utils/goalsCopy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, RefreshCw, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import api from '../services/api';
import { format } from '../utils/format';
import '../styles/AnalyticsWorkspace.css';

const metrics = [
  ['spend', 'Investimento', 'money'], ['impressions', 'Impressões', 'number'],
  ['clicks', 'Cliques', 'number'], ['ctr', 'CTR', 'percent'],
  ['cpc', 'CPC', 'money'], ['cpm', 'CPM', 'money'],
  ['conversions', 'Conversões', 'decimal'], ['roas', 'ROAS', 'ratio'],
];
const labels = { meta: 'Meta Ads', google: 'Google Ads', all: 'Todas as plataformas' };
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

const ADVANCED_KEY = 'eyesight-advanced-open';
function readAdvancedOpen() {
  try { return localStorage.getItem(ADVANCED_KEY) === '1'; } catch { return false; }
}
function writeAdvancedOpen(open) {
  try { localStorage.setItem(ADVANCED_KEY, open ? '1' : '0'); } catch { /* preferência opcional */ }
}
function AdvancedDetails({ open, onToggle, children }) {
  return <details className="analytics-advanced" open={open} onToggle={onToggle}><summary>Ver análise completa</summary><div className="analytics-advanced-body">{children}</div></details>;
}

export default function AnalyticsWorkspace({ platform = 'all', title = 'Visão geral', onData, onError, reloadToken = 0, overview }) {
  const callbacks = useRef({ onData, onError });
  useEffect(() => { callbacks.current = { onData, onError }; });
  const [filters, setFilters] = useState({ periodo: 'last_30d', platform });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [chartMetric, setChartMetric] = useState('spend');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('spend');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [alertSettings, setAlertSettings] = useState({});
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [custom, setCustom] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(readAdvancedOpen);
  // Sem dados, com erro ou sem veredito, o bloco abre sozinho: é onde ficam os filtros que desfazem o recorte.
  const forceOpen = !loading && (!data?.hasData || !data?.verdict);
  const toggleAdvanced = event => {
    if (forceOpen) return;
    const open = event.currentTarget.open;
    setAdvancedOpen(open);
    writeAdvancedOpen(open);
  };
  const query = useMemo(() => ({ ...filters, platform: platform === 'all' ? filters.platform : platform }), [filters, platform]);
  const update = useCallback(next => { setFilters(current => ({ ...current, ...next })); setPage(1); setDetail(null); setNotice(''); }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Reset the request state when external filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(''); setData(null);
    api.get('/metricas/analytics', { params: query, signal: controller.signal })
      .then(({ data: result }) => { if (!controller.signal.aborted) { setData(result); setAlertSettings(result.alertSettings || {}); callbacks.current.onData?.(result); } })
      .catch(err => { if (!controller.signal.aborted) { setError(err.response?.data?.erro || 'Não foi possível carregar as métricas. Tente novamente.'); callbacks.current.onError?.(err); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision, reloadToken]);

  async function sync() {
    setSyncing(true); setNotice(''); setError('');
    try {
      const { data: result } = await api.post('/metricas/sincronizar', query);
      setNotice([result.mensagem, ...(result.results || []).flatMap(item => item.success ? (item.warnings || []) : [`${labels[item.platform]}: ${item.error}`])].filter(Boolean).join(' '));
      setRevision(value => value + 1);
    } catch (err) { setError(err.response?.data?.erro || err.response?.data?.results?.map(item => `${labels[item.platform]}: ${item.error}`).join(' ') || 'Falha na sincronização. Verifique suas contas e tente novamente.'); }
    finally { setSyncing(false); }
  }
  async function exportCsv() {
    setExporting(true); setNotice('');
    try {
      const response = await api.get('/metricas/exportar', { params: query, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `eyesight_${data.period.since}_${data.period.until}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Relatório exportado com os filtros selecionados.');
    } catch { setError('Não foi possível exportar o relatório. Tente novamente.'); }
    finally { setExporting(false); }
  }
  async function saveAlerts(event) {
    event.preventDefault(); setSavingAlerts(true);
    try {
      const limits = Object.fromEntries(['ctrMin', 'cpaMax', 'budgetMax'].map(key => [key, alertSettings[key] === '' || alertSettings[key] == null ? null : Number(alertSettings[key])]));
      await api.put('/metricas/alertas', limits);
      setNotice(GOALS_COPY.saved); setRevision(value => value + 1);
    } catch (err) { setError(err.response?.data?.erro || GOALS_COPY.error); }
    finally { setSavingAlerts(false); }
  }
  const campaigns = useMemo(() => (data?.campaigns || []).filter(item => item.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : (b.metrics[sort] ?? -Infinity) - (a.metrics[sort] ?? -Infinity)), [data, search, sort]);
  const pages = Math.max(1, Math.ceil(campaigns.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = campaigns.slice((currentPage - 1) * 10, currentPage * 10);
  const selectedMetric = metrics.find(([key]) => key === chartMetric);
  const chart = (data?.daily || []).map(day => ({ ...day, value: day.complete ? day[chartMetric] : null, label: day.date.slice(5).split('-').reverse().join('/') }));

  const simple = typeof overview === 'function';
  const reload = message => {
    if (typeof message === 'string') setNotice(message);
    setRevision(value => value + 1);
  };
  const exportButton = <button onClick={exportCsv} disabled={!data?.hasData || loading || exporting}><Download size={16} /> {exporting ? 'Exportando…' : 'Exportar CSV'}</button>;
  const periodField = <label>Período<select value={custom ? 'custom' : filters.periodo} onChange={event => { const value = event.target.value; setCustom(value === 'custom'); if (value !== 'custom') update({ periodo: value, startDate: undefined, endDate: undefined }); }}><option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="last_7d">Últimos 7 dias</option><option value="last_30d">Últimos 30 dias</option><option value="last_90d">Últimos 90 dias</option><option value="custom">Personalizado</option></select></label>;
  const otherFields = <>
    {platform === 'all' && <label>Plataforma<select value={filters.platform} onChange={event => update({ platform: event.target.value, campaignId: undefined, currency: undefined })}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    <label>Campanha<select value={filters.campaignId || ''} onChange={event => update({ campaignId: event.target.value || undefined })}><option value="">Todas as campanhas</option>{data?.availableCampaigns?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {(data?.currencies?.length > 1 || data?.currency === 'UNKNOWN') && <label>Moeda<select value={data.currency} onChange={event => update({ currency: event.target.value, campaignId: undefined })}>{data.currencies.map(item => <option key={item} value={item}>{item === 'UNKNOWN' ? 'Não identificada' : item}</option>)}</select></label>}
  </>;
  const advancedTop = <div className="analytics-advanced-top"><fieldset disabled={syncing} className="analytics-filters"><legend className="sr-only">Filtros adicionais</legend>{otherFields}</fieldset>{exportButton}</div>;
  const warningsAside = data?.warnings?.length ? <aside className="analytics-notes" aria-label="Notas sobre os dados"><h2>Sobre estes dados</h2><ul>{data.warnings.map(message => <li key={message}>{message}</li>)}</ul></aside> : null;

  const loadingNotice = <div className="analytics-loading" role="status">Carregando métricas…</div>;
  const periodLine = data ? <div className="analytics-period"><span>{formatDate(data.period.since)} — {formatDate(data.period.until)} · {data.currency === 'UNKNOWN' ? 'Moeda não identificada' : data.currency}</span><span>{data.lastSyncedAt ? `Última sincronização: ${new Date(data.lastSyncedAt).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}</span></div> : null;
  const emptyPanel = data ? <div className="analytics-panel analytics-empty"><h2>Seus resultados começam aqui</h2><p>Conecte uma conta e sincronize o período selecionado. Se a conta já estiver conectada, verifique se existem campanhas com atividade.</p><Link className="analytics-link" to="/app/account">Gerenciar contas <ArrowUpRight size={16} /></Link></div> : null;
  const detailBlocks = data?.hasData ? <>
        <div className="analytics-kpis">{metrics.map(([key, label, type]) => <article className="analytics-kpi" key={key}><h2>{label}</h2><strong>{format(data.totals[key], type, data.currency)}</strong><span>{data.currentComplete && data.previousComplete && data.changes[key] != null ? `${data.changes[key] > 0 ? '+' : ''}${format(data.changes[key], 'percent')} vs. período anterior` : 'Sem comparação disponível'}</span></article>)}</div>
        <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Evolução diária</h2><p>{data.previousTotals && data.currentComplete ? `Comparação dos indicadores com ${formatDate(data.period.previousSince)} a ${formatDate(data.period.previousUntil)}.` : 'Sincronize os dois períodos para habilitar a comparação.'}</p></div><label>Métrica<select value={chartMetric} onChange={event => setChartMetric(event.target.value)}>{metrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          {chart.some(day => day.value != null) ? <div className="analytics-chart" role="img" aria-label={`Evolução diária de ${selectedMetric[1]}; valores detalhados disponíveis na tabela abaixo`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 18, right: 20, left: 0, bottom: 8 }}><defs><linearGradient id={`analytics-fill-${platform}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border-color)" /><XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} minTickGap={30} axisLine={false} tickLine={false} /><YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={60} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'var(--bg-container)', border: '1px solid var(--border-color)', borderRadius: 10, color: 'var(--text-primary)' }} formatter={value => [format(value, selectedMetric[2], data.currency), selectedMetric[1]]} labelFormatter={(_, payload) => payload?.[0] ? formatDate(payload[0].payload.date) : ''} /><Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill={`url(#analytics-fill-${platform})`} connectNulls={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <p className="analytics-empty">Histórico diário indisponível ou incompleto. Sincronize para preencher o gráfico.</p>}
          <details className="analytics-daily"><summary>Consultar valores diários em tabela</summary><div className="analytics-table-scroll"><table><caption>{selectedMetric[1]} por dia</caption><thead><tr><th>Data</th><th>{selectedMetric[1]}</th><th>Coleta</th></tr></thead><tbody>{chart.map(day => <tr key={day.date}><td>{formatDate(day.date)}</td><td>{format(day.value, selectedMetric[2], data.currency)}</td><td>{day.complete ? 'Completa' : 'Incompleta'}</td></tr>)}</tbody></table></div></details>
        </div>
        {!!data.alerts?.length && <div className="analytics-panel analytics-alerts"><h2>Campanhas que precisam de atenção</h2><ul>{data.alerts.map((alert, index) => <li key={`${alert.campaignId}-${alert.type}-${index}`}><strong>{alert.campaign}</strong><span>{alert.message}</span></li>)}</ul></div>}
        <div className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Campanhas</h2><p>{campaigns.length} campanhas no filtro atual</p></div><div className="analytics-actions"><label>Buscar campanha<input type="search" placeholder="Nome da campanha" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><label>Ordenar por<select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="spend">Maior investimento</option><option value="roas">Maior ROAS</option><option value="conversions">Mais conversões</option><option value="ctr">Maior CTR</option><option value="name">Nome</option></select></label></div></div>
          <div className="analytics-table-scroll"><table><caption className="sr-only">Resultados por campanha</caption><thead><tr><th>Campanha</th><th>Status</th><th>Investimento</th><th>Cliques</th><th>CTR</th><th>CPC</th><th>Conversões</th><th>ROAS</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><button className="analytics-campaign" onClick={() => setDetail(detail?.id === item.id ? null : item)}>{item.name}</button><small>{labels[item.platform]}{!item.hasData ? ' · Sem dados' : !item.complete ? ' · Coleta parcial' : ''}</small></td><td><span className="analytics-status">{({ ACTIVE: 'Ativa', ENABLED: 'Ativa', PAUSED: 'Pausada', REMOVED: 'Removida', ARCHIVED: 'Arquivada', DELETED: 'Excluída' })[item.status] || item.status || 'Não informado'}</span></td>{[['spend', 'money'], ['clicks', 'number'], ['ctr', 'percent'], ['cpc', 'money'], ['conversions', 'decimal'], ['roas', 'ratio']].map(([key, type]) => <td key={key}>{format(item.hasData ? item.metrics[key] : null, type, data.currency)}</td>)}</tr>)}</tbody></table></div>
          {!visible.length && <p className="analytics-empty">Nenhuma campanha encontrada com esse nome.</p>}
          <div className="analytics-pagination"><span>Página {currentPage} de {pages}</span><button disabled={currentPage <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button disabled={currentPage >= pages} onClick={() => setPage(value => value + 1)}>Próxima</button></div>
          {detail && <section className="analytics-detail" aria-label="Detalhes da campanha"><div><h3>{detail.name}</h3><button onClick={() => setDetail(null)}>Fechar detalhes</button></div><p>Valor de conversões: <strong>{format(detail.metrics.revenue, 'money', data.currency)}</strong> · CPA: <strong>{format(detail.metrics.cpa, 'money', data.currency)}</strong></p><Link to="/app/assistant">Analisar campanhas com IA <ArrowUpRight size={16} /></Link></section>}
        </div>
  </> : null;

  return <section className="analytics-workspace" aria-busy={loading}>
    <header className="analytics-heading"><div><p className="analytics-eyebrow">DESEMPENHO DE CAMPANHAS</p><h1>{title}</h1><p>Do investimento ao resultado, com os dados das suas contas.</p></div>
      <div className="analytics-actions">{!simple && exportButton}<button className="analytics-primary" onClick={sync} disabled={syncing || loading}><RefreshCw size={16} className={syncing ? 'analytics-spin' : ''} />{syncing ? (simple ? 'Atualizando…' : 'Sincronizando…') : (simple ? 'Atualizar dados' : 'Sincronizar dados')}</button></div>
    </header>
    <fieldset disabled={syncing} className="analytics-filters"><legend className="sr-only">Filtros das métricas</legend>
      {periodField}
      {!simple && otherFields}
      {!simple && <button aria-expanded={showAlerts} onClick={() => setShowAlerts(value => !value)}><SlidersHorizontal size={16} /> {GOALS_COPY.title}</button>}
    </fieldset>
    {custom && <form className="analytics-custom" onSubmit={event => { event.preventDefault(); update({ periodo: 'custom', ...customDates }); }}><label>Data inicial<input required type="date" value={customDates.startDate} onChange={event => setCustomDates(value => ({ ...value, startDate: event.target.value }))} /></label><label>Data final<input required type="date" min={customDates.startDate} value={customDates.endDate} onChange={event => setCustomDates(value => ({ ...value, endDate: event.target.value }))} /></label><button type="submit" disabled={syncing}>Aplicar datas</button></form>}
    {!simple && showAlerts && <form className="analytics-panel analytics-alert-form" onSubmit={saveAlerts}><div><h2>{GOALS_COPY.title}</h2><p>{GOALS_COPY.help}</p></div>{GOAL_FIELDS.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" max={key === 'ctrMin' ? 100 : 1000000000} step="0.01" value={alertSettings[key] ?? ''} onChange={event => setAlertSettings(value => ({ ...value, [key]: event.target.value }))} /></label>)}<button type="submit" disabled={savingAlerts}>{savingAlerts ? 'Salvando…' : GOALS_COPY.save}</button></form>}
    {notice && <p className="analytics-notice" role="status">{notice}</p>}
    {error && <div className="analytics-error" role="alert"><p>{error}</p><button onClick={() => setRevision(value => value + 1)}>Tentar novamente</button><Link to="/app/account">Ver conexões</Link></div>}
    {simple ? <>
      {loading && loadingNotice}
      {!loading && periodLine}
      {!loading && data?.hasData && overview({ data, filters, alertSettings, reload })}
      {!loading && data && !data.hasData && emptyPanel}
      <AdvancedDetails open={advancedOpen || forceOpen} onToggle={toggleAdvanced}>
        {advancedTop}
        {!loading && data?.hasData && detailBlocks}
        {!loading && warningsAside}
      </AdvancedDetails>
    </> : loading ? loadingNotice : data && <>
      {periodLine}
      {!data.hasData ? emptyPanel : <>
        {detailBlocks}
        {warningsAside}
      </>}
      {!data.hasData && warningsAside}
    </>}
  </section>;
}
