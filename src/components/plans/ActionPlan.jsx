import { ListChecks } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PLAN_CODES } from './usePlans';
import '../../styles/Plans.css';

const formatDay = value => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function ActionPlan({ action, plans, available, describedBy }) {
  const plan = plans.planFor(action);
  const hasPlan = Boolean(plan);
  const hadPlan = useRef(hasPlan);
  const firstStep = useRef(null);
  // Quando o plano acaba de chegar o botão some: leva o foco do teclado ao primeiro passo.
  useEffect(() => {
    if (hasPlan && !hadPlan.current) firstStep.current?.focus();
    hadPlan.current = hasPlan;
  }, [hasPlan]);
  if (!PLAN_CODES.includes(action.code) || plans.failed) return null;
  const state = plans.stateFor(action);
  const generating = state === 'generating';
  const blocked = plans.busy || generating;
  const generate = options => { if (blocked) return; if (options) plans.generate(action, options); else plans.generate(action); };
  const failed = state === 'error' || state === 'limit';
  const done = plan ? plan.steps.filter(step => step.done).length : 0;

  return <div className="pl-plan">
    {!plan && <button type="button" className="pl-button" disabled={!available} aria-disabled={blocked} aria-describedby={available ? undefined : describedBy} onClick={() => generate()}>
      <ListChecks size={16} aria-hidden="true" />
      <span>{generating ? 'Preparando os passos…' : 'Ver passo a passo'}</span>
    </button>}
    {plan && <>
      <p className="pl-progress" aria-live="polite">{done} de {plan.steps.length} passos feitos</p>
      <ul className="pl-steps">
        {plan.steps.map((step, index) => <li key={step.id}>
          <label><input ref={index === 0 ? firstStep : undefined} type="checkbox" checked={step.done} onChange={event => plans.toggle(plan.id, step.id, event.target.checked)} /><span>{step.text}</span></label>
        </li>)}
      </ul>
      {done === plan.steps.length && <p className="pl-done">Tudo feito. Veja nos próximos dias se o resultado melhorou.</p>}
      <p className="pl-meta">
        <span>Gerado em {formatDay(plan.generatedAt)}</span>
        <button type="button" className="pl-link" disabled={!available} aria-disabled={blocked} aria-describedby={available ? undefined : describedBy} onClick={() => generate({ regenerate: true })}>{generating ? 'Preparando os passos…' : 'Gerar de novo'}</button>
      </p>
    </>}
    {failed && <div className="pl-error" role="alert">
      <p>{plans.errorFor(action)}</p>
      {state === 'error' && <button type="button" className="pl-link" aria-disabled={blocked} onClick={() => generate(plan ? { regenerate: true } : undefined)}>Tentar de novo</button>}
    </div>}
    {plans.saveError && plan && <p className="pl-error" role="alert">{plans.saveError}</p>}
  </div>;
}
