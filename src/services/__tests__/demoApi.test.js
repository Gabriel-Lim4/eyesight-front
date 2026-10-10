import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { demoAdapter, demoAnalytics } from '../demoApi';
import api from '../api';
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T15:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('offline demo', () => {
  it('filters dates and campaigns and recomputes weighted totals', () => {
    const all = demoAnalytics({ periodo: 'last_7d' });
    const one = demoAnalytics({ periodo: 'custom', startDate: '2026-10-01', endDate: '2026-10-04', platform: 'google', campaignId: 4 });
    expect(all.campaigns).toHaveLength(6); expect(all.daily).toHaveLength(7); expect(all.previousComplete).toBe(true);
    expect(one.campaigns).toHaveLength(1); expect(one.daily).toHaveLength(4); expect(one.campaigns[0].platform).toBe('google');
    expect(one.totals.spend).toBeCloseTo(one.daily.reduce((sum, row) => sum + row.spend, 0));
    expect(one.totals.ctr).toBe(one.totals.clicks / one.totals.impressions * 100);
    expect(one).toEqual(demoAnalytics({ periodo: 'custom', startDate: '2026-10-01', endDate: '2026-10-04', platform: 'google', campaignId: 4 }));
  });
  it('exposes incomplete coverage instead of fabricating older data', () => {
    const data = demoAnalytics({ periodo: 'custom', startDate: '2026-01-01', endDate: '2026-02-01' });
    expect(data.hasData).toBe(false); expect(data.currentComplete).toBe(false); expect(data.previousTotals).toBeNull();
  });
  it('blocks every unknown read and mutation', async () => {
    for (const [method, url] of [['get', '/meta/conectar'], ['get', '/unknown'], ['post', '/ia/outra'], ['put', '/auth/me'], ['delete', '/meta/desconectar']]) {
      await expect(demoAdapter({ method, url })).rejects.toMatchObject({ response: { status: 400, data: { demo: true } } });
    }
  });
  it('answers the explainer chat with a fixed example text and no invented numbers', async () => {
    const response = await demoAdapter({ method: 'post', url: '/ia/chat', data: JSON.stringify({ message: 'Por quê?', focus: { kind: 'verdict' } }) });
    const { conversation, demo } = response.data;
    expect(demo).toBe(true);
    expect(conversation.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(conversation.messages[0].content).toBe('Por quê?');
    expect(conversation.messages[1].content).toMatch(/exemplo/i);
    expect(conversation.messages[1].content).not.toMatch(/\d/);
  });
  it('serves example plans in memory without writing anything', async () => {
    const list = await demoAdapter({ method: 'get', url: '/ia/planos' });
    expect(list.data).toEqual({ planos: [] });
    const created = await demoAdapter({ method: 'post', url: '/ia/planos', data: JSON.stringify({ action: { code: 'campaign_over_goal', campaignId: 4 } }) });
    const { plano } = created.data;
    expect(created.data.demo).toBe(true);
    expect(plano.actionKey).toBe('campaign_over_goal:4');
    expect(plano.steps).toHaveLength(3);
    plano.steps.forEach(step => { expect(step.text).not.toMatch(/\d/); expect(step.done).toBe(false); });
    const before = JSON.stringify({ ...localStorage });
    const toggled = await demoAdapter({ method: 'patch', url: `/ia/planos/${plano.id}/passos/s2`, data: JSON.stringify({ done: true }) });
    expect(toggled.data.plano.steps.map(step => step.done)).toEqual([false, true, false]);
    expect(JSON.stringify({ ...localStorage })).toBe(before);
    await expect(demoAdapter({ method: 'patch', url: '/ia/planos/nope/passos/s1', data: JSON.stringify({ done: true }) })).rejects.toMatchObject({ response: { status: 400 } });
  });
  it('interceptor replaces even a custom network adapter, removes auth and preserves session', async () => {
    localStorage.setItem('eyesight-demo', '1'); localStorage.setItem('token', 'real-token'); localStorage.setItem('refreshToken', 'real-refresh');
    const network = vi.fn(() => { throw new Error('Network must not run'); });
    const response = await api.get('/metricas/analytics', { adapter: network, headers: { Authorization: 'Bearer real-token' } });
    expect(response.data.demo).toBe(true); expect(response.config.headers.Authorization).toBeUndefined(); expect(network).not.toHaveBeenCalled();
    await expect(api.post('/ia/analisar/1', { message: 'test' }, { adapter: network })).rejects.toMatchObject({ response: { status: 400 } });
    expect(network).not.toHaveBeenCalled(); expect(localStorage.getItem('token')).toBe('real-token'); expect(localStorage.getItem('refreshToken')).toBe('real-refresh');
  });
  it('adds a verdict with the same shape as the real API', () => {
    const { verdict } = demoAnalytics({ periodo: 'last_7d' });
    expect(Object.keys(verdict).sort()).toEqual(['actions', 'basis', 'highlights', 'indicator', 'insufficientReason', 'reasons', 'status']);
    expect(verdict.highlights.map(item => item.key)).toEqual(['spend', 'clicks', 'conversions', 'cost']);
    expect(verdict.highlights[0].trend).toBe('neutral');
    expect(['good', 'stable', 'attention']).toContain(verdict.status);
    expect(verdict.basis).not.toBe('none');
    expect(verdict.insufficientReason).toBeNull();
    expect(verdict.actions).toEqual([{ code: 'nothing_urgent', params: {} }]);
    expect(verdict.reasons.every(reason => typeof reason.code === 'string' && typeof reason.params === 'object')).toBe(true);
  });
  it('judges the demo cost per result against the demo goal', () => {
    const data = demoAnalytics({ periodo: 'last_30d' });
    const goal = data.alertSettings.cpaMax;
    expect(data.verdict.basis).toBe('goal');
    expect(data.verdict.status).toBe(data.totals.cpa <= goal ? 'good' : 'attention');
    expect(data.verdict.reasons[0]).toEqual({ code: data.totals.cpa <= goal ? 'cost_within_goal' : 'cost_above_goal', params: { value: data.totals.cpa, goal } });
  });
  it('shows no trend when the demo only covers part of the selected period', () => {
    const data = demoAnalytics({ periodo: 'custom', startDate: '2026-03-25', endDate: '2026-04-20' });
    expect(data.hasData).toBe(true); expect(data.currentComplete).toBe(false);
    expect(data.verdict.highlights.every(item => item.change === null)).toBe(true);
    expect(data.verdict.highlights.filter(item => item.key !== 'spend').every(item => item.trend === 'unknown')).toBe(true);
  });
  it('has no verdict to give when the demo has no data for the period', () => {
    const { verdict } = demoAnalytics({ periodo: 'custom', startDate: '2026-01-01', endDate: '2026-02-01' });
    expect(verdict.status).toBe('insufficient');
    expect(verdict.basis).toBe('none');
    expect(verdict.insufficientReason).toBe('no_data');
    expect(verdict.highlights).toHaveLength(4);
  });
  it('is deterministic and keeps the demo read-only for goals', async () => {
    expect(demoAnalytics({ periodo: 'last_7d' }).verdict).toEqual(demoAnalytics({ periodo: 'last_7d' }).verdict);
    await expect(demoAdapter({ method: 'put', url: '/metricas/alertas', data: '{}' })).rejects.toMatchObject({ response: { status: 400, data: { demo: true } } });
  });
  it('exports only filtered demo rows to a CSV blob', async () => {
    const response = await demoAdapter({ method: 'get', url: '/metricas/exportar', params: { campaignId: 4 } });
    expect(response.data).toBeInstanceOf(Blob); expect(response.data.type).toContain('text/csv');
  });
});
