import { Mail } from 'lucide-react';
import { useState } from 'react';
import api from '../../services/api';
import '../../styles/Summary.css';

const SAVE_ERROR = 'Não foi possível salvar. Tente de novo.';
const EXAMPLE_OK = 'Enviamos um exemplo para o e-mail da sua conta.';
const EXAMPLE_FALLBACK = 'Não foi possível enviar o exemplo agora.';

function isDemo() {
  try { return localStorage.getItem('eyesight-demo') === '1'; } catch { return false; }
}

function exampleError(error) {
  const status = error.response?.status;
  if (status === 429) return { text: error.response?.data?.erro || 'Você já pediu exemplos demais. Tente de novo em até 1 hora.', retry: false };
  if (status === 503) return { text: 'O envio de e-mail ainda não está configurado.', retry: false };
  if (status === 409) return { text: 'Ainda não há dados para montar o resumo. Conecte uma conta e atualize os dados.', retry: false };
  return { text: EXAMPLE_FALLBACK, retry: true };
}

const OPTIONS = {
  weekly: { on: 'Resumo semanal ligado.', off: 'Resumo semanal desligado.' },
  alerts: { on: 'Alertas ligados.', off: 'Alertas desligados.' },
};

/* Seção de e-mails do perfil: resumo semanal e alertas (cada um liga/desliga sozinho) e um exemplo para a própria conta. */
export default function SummarySettings({ weekly, alerts, nome }) {
  const demo = isDemo();
  const [values, setValues] = useState({ weekly: Boolean(weekly), alerts: Boolean(alerts) });
  const [confirmed, setConfirmed] = useState({ weekly: Boolean(weekly), alerts: Boolean(alerts) });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [example, setExample] = useState({ state: 'idle', text: '', retry: false });

  // Uma gravação por vez; em falha a caixa volta ao último valor confirmado pelo servidor.
  const toggle = key => async event => {
    if (saving) return;
    const next = event.target.checked;
    setValues(current => ({ ...current, [key]: next }));
    setSaving(true);
    setStatus('');
    setSaveError('');
    try {
      await api.put('/auth/me', { nome, preferences: { summary: { [key]: next } } });
      setConfirmed(current => ({ ...current, [key]: next }));
      setStatus(next ? OPTIONS[key].on : OPTIONS[key].off);
    } catch {
      setValues(current => ({ ...current, [key]: confirmed[key] }));
      setSaveError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const sendExample = async () => {
    if (example.state === 'sending') return;
    setExample({ state: 'sending', text: '', retry: false });
    try {
      await api.post('/resumo/teste');
      setExample({ state: 'done', text: EXAMPLE_OK, retry: false });
    } catch (error) {
      setExample({ state: 'error', ...exampleError(error) });
    }
  };

  return <section className="identity-panel summary-settings" aria-labelledby="summary-title">
    <h2 id="summary-title"><Mail size={20} aria-hidden="true" /> Resumo semanal por e-mail</h2>
    <p>Toda segunda-feira, um e-mail com como estão seus anúncios, os 4 números e o que fazer agora. Você pode parar quando quiser.</p>
    <label className="summary-check">
      <input type="checkbox" checked={values.weekly} onChange={toggle('weekly')} disabled={demo} aria-disabled={saving} />
      <span>Receber o resumo semanal</span>
    </label>
    <p>Quer ser avisado antes? Mande um e-mail quando seus anúncios passarem de bom ou estável para pedir atenção: no máximo um aviso por dia e, depois de um aviso, só outro três dias depois.</p>
    <label className="summary-check">
      <input type="checkbox" checked={values.alerts} onChange={toggle('alerts')} disabled={demo} aria-disabled={saving} />
      <span>Avisar quando meus anúncios passarem a pedir atenção</span>
    </label>
    {demo && <p className="summary-note">Indisponível na demonstração.</p>}
    <div aria-live="polite" role="status">{status}</div>
    {saveError && <p className="summary-error" role="alert">{saveError}</p>}
    <div className="summary-actions">
      <button type="button" className="summary-button" disabled={demo} aria-disabled={example.state === 'sending'} onClick={sendExample}>
        {example.state === 'sending' ? 'Enviando…' : 'Enviar um exemplo para mim'}
      </button>
    </div>
    <div aria-live="polite">{example.state === 'done' && <p>{example.text}</p>}</div>
    {example.state === 'error' && <div className="summary-error" role="alert">
      <p>{example.text}</p>
      {example.retry && <button type="button" className="summary-link" onClick={sendExample}>Tentar de novo</button>}
    </div>}
  </section>;
}
