import { AxiosError } from 'axios';
import { explainCostChange } from '../utils/changeMath';

const DAY = 86400000;
const DEMO_CPA_GOAL = 32;
const RECENT_DROP_DAYS = 15;
const CONVERSION_DROP = 0.45;
const campaigns = [
  { id: 1, name: 'Demonstração · Coleção primavera', platform: 'meta' },
  { id: 2, name: 'Demonstração · Remarketing catálogo', platform: 'meta' },
  { id: 3, name: 'Demonstração · Novos públicos', platform: 'meta' },
  { id: 4, name: 'Demonstração · Pesquisa de marca', platform: 'google' },
  { id: 5, name: 'Demonstração · Pesquisa de produtos', platform: 'google' },
  { id: 6, name: 'Demonstração · Shopping', platform: 'google' },
];
const iso = time => new Date(time).toISOString().slice(0, 10);
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const timestamp = () => `${today()}T12:00:00.000Z`;
const fail = message => { throw new Error(message); };
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Data inválida.');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || iso(time) !== value) fail('Data inválida.');
  return time;
}
function range(query) {
  const current = parseDate(today());
  const presets = { today: 1, yesterday: 1, last_7d: 7, last_30d: 30, last_90d: 90 };
  let since, until, period = query.periodo || 'last_30d';
  if (period === 'custom' || query.startDate || query.endDate) {
    since = parseDate(query.startDate); until = parseDate(query.endDate); period = `custom:${query.startDate}:${query.endDate}`;
  } else {
    if (!Object.hasOwn(presets, period)) fail('Período inválido.');
    until = current - (period === 'yesterday' ? DAY : 0); since = until - (presets[period] - 1) * DAY;
  }
  const days = Math.round((until - since) / DAY) + 1;
  if (days < 1 || days > 366 || until > current) fail('Escolha um período válido de até 366 dias, sem datas futuras.');
  return { since: iso(since), until: iso(until), period, days, previousSince: iso(since - days * DAY), previousUntil: iso(since - DAY) };
}
function aggregate(rows) {
  const totals = { impressions: 0, clicks: 0, spend: 0, conversions: rows.length ? 0 : null, revenue: rows.length ? 0 : null };
  for (const row of rows) for (const key of Object.keys(totals)) if (totals[key] !== null) totals[key] += row[key] || 0;
  return { ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions * 100 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : null, cpm: totals.impressions ? totals.spend / totals.impressions * 1000 : null,
    cpa: totals.conversions ? totals.spend / totals.conversions : null, roas: totals.spend && totals.revenue != null ? totals.revenue / totals.spend : null };
}
function values(id, date) {
  const day = Math.floor(parseDate(date) / DAY);
  const wave = ((day * 17 + id * 29) % 23) / 23;
  const impressions = Math.round(1100 + id * 370 + wave * 850);
  const clicks = Math.round(impressions * (0.012 + id * 0.003 + wave * 0.005));
  // História da demonstração: nos últimos dias, duas campanhas perdem taxa de conversão (o painel explica por quê).
  const dropping = id === 2 || id === 3;
  const recent = parseDate(today()) - parseDate(date) < RECENT_DROP_DAYS * DAY;
  const conversions = Math.max(1, Math.round(clicks * (0.04 + id * 0.006) * (dropping && recent ? CONVERSION_DROP : 1)));
  return { impressions, clicks, spend: Math.round(clicks * (0.9 + id * 0.16 + wave * 0.3) * 100) / 100, conversions, revenue: conversions * (95 + id * 15) };
}
export function demoAnalytics(query = {}) {
  const period = range(query);
  if (query.platform && !['all', 'meta', 'google'].includes(query.platform)) fail('Plataforma inválida.');
  const platformCampaigns = campaigns.filter(c => !query.platform || query.platform === 'all' || c.platform === query.platform);
  if (query.campaignId && !platformCampaigns.some(c => c.id === Number(query.campaignId))) fail('Campanha de demonstração não encontrada.');
  const selected = platformCampaigns.filter(c => (!query.campaignId || c.id === Number(query.campaignId)) && (!query.currency || query.currency === 'BRL'));
  const availableSince = parseDate(today()) - 179 * DAY;
  function records(start, end, ids = selected) {
    const rows = [];
    for (let day = Math.max(parseDate(start), availableSince); day <= parseDate(end); day += DAY) for (const campaign of ids) rows.push({ campaignId: campaign.id, date: iso(day), ...values(campaign.id, iso(day)) });
    return rows;
  }
  const current = records(period.since, period.until), previous = records(period.previousSince, period.previousUntil);
  const currentComplete = selected.length > 0 && current.length === selected.length * period.days;
  const previousComplete = selected.length > 0 && previous.length === selected.length * period.days;
  const totals = aggregate(current), previousTotals = previousComplete ? aggregate(previous) : null;
  const daily = [];
  if (current.length) for (let day = parseDate(period.since); day <= parseDate(period.until); day += DAY) {
    const rows = current.filter(row => row.date === iso(day)); daily.push({ date: iso(day), hasData: rows.length > 0, complete: rows.length === selected.length, ...aggregate(rows) });
  }
  const detailed = selected.map(c => ({ ...c, externalId: `demo-${c.id}`, currency: 'BRL', status: 'ACTIVE', lastSyncedAt: timestamp(), metrics: aggregate(current.filter(row => row.campaignId === c.id)), previousMetrics: aggregate(previous.filter(row => row.campaignId === c.id)), hasData: current.some(row => row.campaignId === c.id), complete: currentComplete }));
  const warnings = ['Dados fictícios de demonstração. Nenhuma conta real é consultada.', 'Valor de conversões é atribuído; não representa faturamento ou lucro comprovado.'];
  if (!currentComplete || !previousComplete) warnings.push('A demonstração contém somente os últimos 180 dias. Períodos anteriores podem ter dados incompletos.');
  const result = { period, currency: query.currency || 'BRL', currencies: ['BRL'], totals, previousTotals,
    changes: previousTotals ? Object.fromEntries(Object.keys(totals).map(key => [key, totals[key] == null || !previousTotals[key] ? null : (totals[key] - previousTotals[key]) / Math.abs(previousTotals[key]) * 100])) : {},
    campaigns: detailed, daily, platforms: [...new Set(selected.map(c => c.platform))].map(platform => ({ platform, metrics: aggregate(current.filter(row => selected.find(c => c.id === row.campaignId)?.platform === platform)) })),
    warnings, alerts: [], alertSettings: { ctrMin: 1, cpaMax: DEMO_CPA_GOAL, budgetMax: 15000 }, availableCampaigns: platformCampaigns,
    source: current.length ? 'daily' : 'empty', currentComplete, previousComplete, hasData: current.length > 0, lastSyncedAt: timestamp(), demo: true };
  const verdict = demoVerdict(result);
  const changeExplanation = verdict.status !== 'insufficient' && currentComplete && previousComplete ? explainCostChange(totals, previousTotals, verdict.indicator) : null;
  return { ...result, verdict, changeExplanation };
}
/* Versão reduzida do veredito do back (a demo não importa código do servidor): custo por resultado contra a meta ou o período anterior. */
const DEMO_BAND = 5;
const trendOf = (change, higherIsBetter) => {
  if (change == null || !Number.isFinite(change)) return 'unknown';
  if (Math.abs(change) < DEMO_BAND) return 'stable';
  return (change > 0) === higherIsBetter ? 'better' : 'worse';
};
/* Como no servidor: a campanha mais acima da meta de custo por resultado vira uma ação (com passo a passo). */
function demoActions(analytics) {
  const goal = Number(analytics.alertSettings?.cpaMax);
  const over = goal > 0 ? (analytics.campaigns || [])
    .filter(campaign => campaign.hasData && Number.isFinite(campaign.metrics?.cpa) && campaign.metrics.cpa > goal)
    .sort((a, b) => b.metrics.cpa - a.metrics.cpa)[0] : null;
  return over
    ? [{ code: 'campaign_over_goal', params: { campaign: over.name.slice(0, 80), value: over.metrics.cpa, goal }, campaignId: over.id }]
    : [{ code: 'nothing_urgent', params: {} }];
}
export function demoVerdict(analytics) {
  const { totals, changes } = analytics;
  const comparable = Boolean(analytics.currentComplete && analytics.previousComplete);
  const change = key => (comparable && Number.isFinite(changes?.[key]) ? changes[key] : null);
  const highlights = [
    { key: 'spend', value: totals.spend, change: change('spend'), trend: 'neutral', available: true },
    { key: 'clicks', value: totals.clicks, change: change('clicks'), trend: trendOf(change('clicks'), true), available: true },
    { key: 'conversions', value: totals.conversions, change: change('conversions'), trend: trendOf(change('conversions'), true), available: totals.conversions != null },
    { key: 'cost', value: totals.cpa, change: change('cpa'), trend: trendOf(change('cpa'), false), available: true },
  ];
  const base = { indicator: 'cpa', highlights, actions: demoActions(analytics) };
  const blocked = !analytics.hasData ? 'no_data' : !analytics.currentComplete ? 'incomplete_period' : !(totals.spend > 0) ? 'zero_spend' : !(totals.clicks >= 30) ? 'low_volume' : null;
  if (blocked) return { ...base, status: 'insufficient', basis: 'none', insufficientReason: blocked, reasons: [] };
  const compare = change('cpa') == null ? [] : [{ code: change('cpa') <= -DEMO_BAND ? 'cost_better' : change('cpa') >= DEMO_BAND ? 'cost_worse' : 'cost_stable', params: { indicator: 'cpa', change: change('cpa'), value: totals.cpa } }];
  const goal = Number(analytics.alertSettings?.cpaMax);
  if (goal > 0) {
    const within = totals.cpa <= goal;
    return { ...base, status: within ? 'good' : 'attention', basis: 'goal', insufficientReason: null, reasons: [{ code: within ? 'cost_within_goal' : 'cost_above_goal', params: { value: totals.cpa, goal } }, ...compare] };
  }
  if (compare.length) {
    return { ...base, status: { cost_better: 'good', cost_worse: 'attention', cost_stable: 'stable' }[compare[0].code], basis: 'comparison', insufficientReason: null, reasons: compare };
  }
  return { ...base, status: 'insufficient', basis: 'none', insufficientReason: 'no_baseline', reasons: [] };
}
function legacy(c) { return { pk_id_campanha: c.id, nome_campanha: c.name, id_externo: `demo-${c.id}`, status_campanha: 'ACTIVE', objetivo: 'Vendas', sincronizado_em: timestamp(), conta: { plataforma: c.platform, currency: 'BRL', account_id: `demo-${c.platform}` } }; }
function account(platform) { return { conectado: true, configured: true, account_id: `demo-${platform}`, account_name: `Conta exemplo ${platform === 'meta' ? 'Meta' : 'Google'}`, currency: 'BRL', vinculado_em: `${today()}T12:00:00Z`, demo: true }; }
const sampleAnalysis = () => ({ pk_id_analise: 1, fk_id_campanha: 1, campanha: { nome_campanha: campaigns[0].name }, texto_analise: 'Exemplo ilustrativo de análise. Compare o custo por aquisição e a taxa de conversão entre campanhas antes de redistribuir orçamento. Este texto é demonstrativo e não foi gerado pela OpenAI.', sugestao_analise: 'Teste dois criativos com a mesma audiência e acompanhe o CPA no mesmo período. Confirme a configuração dos eventos antes de interpretar o ROAS.', score_desempenho: 70, modelo: 'Exemplo demonstrativo', periodo: 'last_30d', data_geracao_analise: timestamp() });

const DEMO_CHAT = {
  verdict: 'Este é um texto de exemplo da demonstração. No uso real, o assistente explica o resumo com os seus números e as suas metas.',
  card: 'Este é um texto de exemplo da demonstração. No uso real, o assistente explica este indicador com os dados da sua conta.',
  reason: 'Este é um texto de exemplo da demonstração. No uso real, o assistente explica este motivo com os seus números.',
  action: 'Este é um texto de exemplo da demonstração. No uso real, o assistente diz como fazer esta ação passo a passo.',
};
function demoChat(body) {
  let request;
  try { request = typeof body === 'string' ? JSON.parse(body) : body || {}; } catch { request = {}; }
  const message = String(request.message ?? '').slice(0, 2000);
  const created_at = timestamp();
  return { conversation: { id: 'demo', title: message.slice(0, 150), messages: [{ role: 'user', content: message, created_at }, { role: 'assistant', content: DEMO_CHAT[request.focus?.kind] || DEMO_CHAT.verdict, created_at }] }, modelo: 'Exemplo demonstrativo', demo: true };
}

const DEMO_PLAN_STEPS = ['Exemplo da demonstração: abra o gerenciador de anúncios da plataforma.', 'Revise a campanha indicada neste aviso.', 'Anote o que mudou e confira de novo em alguns dias.'];
const demoPlans = new Map();
const DEMO_FOLLOW_UP = () => ({ status: 'ready', metric: 'cpa', since: iso(parseDate(today()) - 4 * DAY), daysBefore: 7, daysAfter: 4, before: 58, after: 41.5, changePct: -28.4, result: 'better' });
function demoPlanRequest(method, path, body) {
  const parse = () => { try { return typeof body === 'string' ? JSON.parse(body) : body || {}; } catch { return {}; } };
  if (method === 'get') return { planos: [...demoPlans.values()] };
  if (method === 'post') {
    const action = parse().action || {};
    const key = `${action.code}:${action.campaignId ?? '-'}`;
    const plano = { id: `demo-${key}`, actionKey: key, actionCode: action.code, campaignId: action.campaignId ?? null, steps: DEMO_PLAN_STEPS.map((text, index) => ({ id: `s${index + 1}`, text, done: false })), generatedAt: timestamp(), followUp: null };
    demoPlans.set(plano.id, plano);
    return { plano, demo: true };
  }
  const [, id, stepId] = /^\/ia\/planos\/([^/]+)\/passos\/([^/]+)$/.exec(path) || [];
  const found = demoPlans.get(id);
  if (!found || !found.steps.some(step => step.id === stepId)) fail('Plano de demonstração não encontrado.');
  const done = Boolean(parse().done);
  found.steps = found.steps.map(step => {
    if (step.id !== stepId) return step;
    const { doneAt, ...rest } = step;
    return done ? { ...rest, done, doneAt: timestamp() } : { ...rest, done };
  });
  // Ilustrativo: a demo não tem como medir "depois de agir", então mostra um resultado de exemplo.
  found.followUp = found.steps.some(step => step.done) ? DEMO_FOLLOW_UP() : null;
  return { plano: found, demo: true };
}

export async function demoAdapter(config) {
  const url = new URL(config.url, 'https://demo.invalid');
  const path = url.pathname.replace(/\/$/, '');
  const query = { ...Object.fromEntries(url.searchParams), ...(config.params || {}) };
  const method = (config.method || 'get').toLowerCase();
  let data;
  try {
    if (method !== 'get') {
      if (method === 'post' && path === '/ia/chat') data = demoChat(config.data);
      else if ((method === 'post' && path === '/ia/planos') || (method === 'patch' && /^\/ia\/planos\/[^/]+\/passos\/[^/]+$/.test(path))) data = demoPlanRequest(method, path, config.data);
      else if (method === 'post' && path === '/metricas/sincronizar') data = { mensagem: 'Dados de demonstração; nenhuma conta real consultada.', demo: true, results: [], warnings: ['Demonstração somente leitura.'] };
      else fail('Modo demonstração somente leitura: nenhuma alteração, mensagem ou conexão real foi realizada.');
    } else if (path === '/ia/planos') data = demoPlanRequest('get', path);
    else if (path === '/metricas/analytics') data = demoAnalytics(query);
    else if (path === '/metricas/exportar') {
      const result = demoAnalytics(query), cells = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
      const lines = [['Campanha (DEMONSTRAÇÃO)', 'Plataforma', 'Moeda', 'Impressões', 'Cliques', 'Investimento', 'Conversões', 'Valor de conversões'], ...result.campaigns.map(c => [c.name, c.platform, c.currency, c.metrics.impressions, c.metrics.clicks, c.metrics.spend, c.metrics.conversions, c.metrics.revenue])];
      data = new Blob(['\ufeff' + lines.map(row => row.map(cells).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    } else if (path === '/metricas/campanhas') data = { campanhas: campaigns.map(legacy), total: campaigns.length };
    else if (/^\/(meta|google)\/status$/.test(path)) data = account(path.split('/')[1]);
    else if (/^\/(meta|google)\/contas$/.test(path)) data = { contas: [account(path.split('/')[1])] };
    else if (/^\/(meta|google)\/campanhas$/.test(path)) { const items = campaigns.filter(c => c.platform === path.split('/')[1]); data = { campanhas: items.map(legacy), total: items.length }; }
    else if (path === '/auth/me') data = { usuario: { id: 'demo', nome: 'Visitante Eyesight', email: 'demo@example.com', telefone: '', localizacao: 'São Paulo, SP', preferences: { theme: 'dark' } } };
    else if (path === '/ia/status') data = { configured: false, automatic: false, model: 'Exemplo demonstrativo', demo: true };
    else if (path === '/ia/analises') data = { analises: [sampleAnalysis()], total: 1 };
    else if (path === '/ia/analises/1') data = { analise: sampleAnalysis() };
    else if (path === '/ia/conversas') data = { conversas: [] };
    else if (path === '/instagram/status') data = { conectado: true, username: 'eyesight.exemplo', instagram_account_id: 'demo-instagram', demo: true };
    else if (path === '/instagram/metricas') data = { conectado: true, periodo: query.periodo || 'last_30d', perfil: { username: 'eyesight.exemplo', seguidores: 2450, totalPosts: 86, fotoPerfil: null }, metricas: { alcance: 12700, impressoes: null, visitasPerfil: null, cliquesLink: null }, warnings: ['Perfil e alcance fictícios para demonstração; demais métricas indisponíveis.'], demo: true };
    else fail('Este recurso não está disponível na demonstração. Nenhuma solicitação foi enviada ao servidor.');
  } catch (error) {
    throw new AxiosError(error.message, 'ERR_DEMO_READ_ONLY', config, null, { data: { erro: error.message, demo: true }, status: 400, statusText: 'Bad Request', headers: {}, config });
  }
  return { data, status: 200, statusText: 'OK', headers: { 'x-eyesight-demo': 'true' }, config };
}
