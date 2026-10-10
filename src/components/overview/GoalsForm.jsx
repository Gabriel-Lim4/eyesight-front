import { useState } from 'react';
import api from '../../services/api';
import '../../styles/Overview.css';

const FIELDS = [
  ['cpaMax', 'Quero pagar, no máximo, por cada resultado', 'money'],
  ['budgetMax', 'Quero gastar, no máximo, no período', 'money'],
  ['ctrMin', 'Quero que pelo menos esta % de quem vê meu anúncio clique', 'percent'],
];
const initial = settings => Object.fromEntries(FIELDS.map(([key]) => [key, settings?.[key] == null ? '' : String(settings[key])]));

export default function GoalsForm({ alertSettings, currency, disabled, onSaved }) {
  const [values, setValues] = useState(() => initial(alertSettings));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const limits = Object.fromEntries(FIELDS.map(([key]) => [key, values[key] === '' ? null : Number(values[key])]));
    if (Object.values(limits).some(value => value !== null && !Number.isFinite(value))) {
      setMessage({ error: true, text: 'Informe apenas números nas metas.' });
      return;
    }
    setBusy(true); setMessage(null);
    try {
      await api.put('/metricas/alertas', { ctrMin: limits.ctrMin, cpaMax: limits.cpaMax, budgetMax: limits.budgetMax });
      setMessage({ text: 'Metas salvas.' });
      onSaved?.();
    } catch (error) {
      setMessage({ error: true, text: error.response?.data?.erro || 'Não foi possível salvar as metas.' });
    } finally { setBusy(false); }
  }

  return <details className="ov-goals">
    <summary>Suas metas</summary>
    <form onSubmit={submit}>
      <p>Com uma meta, o veredito passa a comparar seus anúncios com ela. Deixe em branco para não usar.</p>
      <fieldset disabled={disabled || busy}>
        {FIELDS.map(([key, label, unit]) => {
          const suffix = unit === 'percent' ? '%' : currency && currency !== 'UNKNOWN' ? currency : '';
          return <div className="ov-field" key={key}>
            <label htmlFor={`ov-goal-${key}`}>{label}</label>
            <div className="ov-input">
              <input id={`ov-goal-${key}`} aria-describedby={suffix ? `ov-unit-${key}` : undefined} type="number" inputMode="decimal" min="0" step="any" value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} />
              {suffix && <span className="ov-unit" id={`ov-unit-${key}`}>{suffix}</span>}
            </div>
          </div>;
        })}
        <button type="submit">Salvar metas</button>
      </fieldset>
      {disabled && <p className="ov-note">Na demonstração as metas não podem ser alteradas.</p>}
      {message && <p className={message.error ? 'ov-error' : 'ov-note'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  </details>;
}
