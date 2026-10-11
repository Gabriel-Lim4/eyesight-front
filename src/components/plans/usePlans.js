import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';

export const PLAN_CODES = ['budget_exceeded', 'campaign_over_goal', 'campaign_low_ctr', 'campaign_without_results', 'enable_conversion_tracking'];
const SCOPE_KEYS = ['periodo', 'startDate', 'endDate', 'platform', 'campaignId', 'currency'];
const FALLBACK_ERROR = 'Não foi possível completar a solicitação. Tente novamente.';
const SAVE_ERROR = 'Não foi possível salvar. Tente de novo.';

const scopeOf = filters => Object.fromEntries(SCOPE_KEYS.filter(key => filters?.[key] != null && filters[key] !== '').map(key => [key, filters[key]]));
export const planKeyOf = action => `${action.code}:${action.campaignId ?? '-'}`;
const identity = action => ({ code: action.code, ...(action.campaignId != null ? { campaignId: action.campaignId } : {}) });
const EMPTY = { scopeKey: null, ready: false, failed: false, plans: [], ui: {}, generating: null, saveError: '' };

/* Planos de ação do recorte atual. Respostas de requisições de outro recorte são ignoradas. */
export function usePlans(filters, version = '') {
  const scope = scopeOf(filters);
  const scopeKey = JSON.stringify(scope);
  const [data, setData] = useState(EMPTY);
  const [reloads, setReloads] = useState(0);
  const generating = useRef(null);
  const chains = useRef(new Map());
  const pending = useRef(new Map());
  const current = data.scopeKey === scopeKey ? data : { ...EMPTY, scopeKey };

  // `version` muda quando as ações do veredito mudam (sincronização, nova meta): a lista é relida sem perder o estado da tela.
  useEffect(() => {
    let active = true;
    api.get('/ia/planos', { params: JSON.parse(scopeKey) })
      .then(({ data: body }) => {
        if (!active) return;
        const plans = body?.planos ?? [];
        setData(value => (value.scopeKey === scopeKey ? { ...value, ready: true, failed: false, plans } : { ...EMPTY, scopeKey, ready: true, plans }));
      })
      .catch(() => { if (active) setData(value => (value.scopeKey === scopeKey ? { ...value, ready: true } : { ...EMPTY, scopeKey, ready: true, failed: true })); });
    return () => { active = false; };
  }, [scopeKey, reloads, version]);

  const reload = useCallback(() => setReloads(count => count + 1), []);
  const planFor = action => current.plans.find(plan => plan.actionKey === planKeyOf(action)) ?? null;

  const generate = async (action, { regenerate = false } = {}) => {
    if (generating.current?.scopeKey === scopeKey) return false;
    const key = planKeyOf(action);
    const base = scopeKey;
    const token = { key, scopeKey: base };
    generating.current = token;
    setData(value => (value.scopeKey === base ? { ...value, generating: key, ui: { ...value.ui, [key]: { state: 'generating', error: '' } } } : value));
    try {
      const { data: body } = await api.post('/ia/planos', { action: identity(action), regenerate, ...scope }, { timeout: 55000 });
      setData(value => (value.scopeKey === base
        ? { ...value, generating: null, plans: [...value.plans.filter(plan => plan.actionKey !== key), body.plano], ui: { ...value.ui, [key]: { state: 'idle', error: '' } } }
        : value));
      return true;
    } catch (err) {
      const status = err.response?.status;
      setData(value => (value.scopeKey === base
        ? { ...value, generating: null, ui: { ...value.ui, [key]: { state: status === 429 ? 'limit' : 'error', error: err.response?.data?.erro || FALLBACK_ERROR } } }
        : value));
      if (status === 404) reload();
      return false;
    } finally {
      if (generating.current === token) generating.current = null;
    }
  };

  const applyStep = (planId, stepId, done) => setData(value => ({ ...value, plans: value.plans.map(plan => (plan.id === planId ? { ...plan, steps: plan.steps.map(step => (step.id === stepId ? { ...step, done } : step)) } : plan)) }));

  const toggle = (planId, stepId, done) => {
    const base = scopeKey;
    const key = `${planId}:${stepId}`;
    const previous = current.plans.find(plan => plan.id === planId)?.steps.find(step => step.id === stepId)?.done ?? !done;
    pending.current.set(key, (pending.current.get(key) ?? 0) + 1);
    setData(value => (value.scopeKey === base ? { ...value, saveError: '' } : value));
    applyStep(planId, stepId, done);
    const run = (chains.current.get(key) ?? Promise.resolve()).then(async () => {
      try {
        const { data: body } = await api.patch(`/ia/planos/${planId}/passos/${stepId}`, { done });
        pending.current.set(key, pending.current.get(key) - 1);
        if (pending.current.get(key) === 0) {
          setData(value => (value.scopeKey === base ? { ...value, plans: value.plans.map(plan => (plan.id === planId ? { ...body.plano, followUp: body.plano?.steps?.some(step => step.done) ? plan.followUp ?? null : null } : plan)) } : value));
          // O acompanhamento depende da data do primeiro passo concluído: a lista é relida para trazê-lo atualizado.
          if (body.plano?.steps?.some(step => step.done && step.doneAt)) reload();
        }
        return true;
      } catch {
        pending.current.set(key, pending.current.get(key) - 1);
        setData(value => (value.scopeKey === base ? { ...value, saveError: SAVE_ERROR } : value));
        if (pending.current.get(key) === 0) applyStep(planId, stepId, previous);
        return false;
      }
    });
    chains.current.set(key, run);
    return run;
  };

  return {
    ready: current.ready,
    failed: current.failed,
    planFor,
    stateFor: action => current.ui[planKeyOf(action)]?.state ?? 'idle',
    errorFor: action => current.ui[planKeyOf(action)]?.error ?? '',
    busy: current.generating !== null,
    saveError: current.saveError,
    generate, toggle, reload,
  };
}
