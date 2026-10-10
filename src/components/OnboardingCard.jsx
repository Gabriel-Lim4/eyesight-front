import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react';
import api from '../services/api';
import { oauthErrorMessage, startOAuth } from '../services/oauth';
import '../styles/Onboarding.css';

const PLATFORMS = [{ key: 'meta', name: 'Meta Ads' }, { key: 'google', name: 'Google Ads' }];
const STATE = {
  done: { label: 'Concluído', Icon: CircleCheck },
  running: { label: 'Em andamento', Icon: LoaderCircle },
  error: { label: 'Com erro', Icon: TriangleAlert },
  pending: { label: 'Pendente', Icon: Circle },
};

function Step({ title, state, children }) {
  const { label, Icon } = STATE[state];
  return <li className={`onboarding-step is-${state}`}>
    <Icon className="onboarding-icon" size={20} aria-hidden="true" />
    <div className="onboarding-step-body">
      <div className="onboarding-step-head"><strong>{title}</strong><span className="onboarding-state">{label}</span></div>
      {children}
    </div>
  </li>;
}

/* Checklist de primeiros passos. O progresso é derivado do estado real; só "dispensado" é gravado. */
export default function OnboardingCard({ hasData, lastSyncedAt, sync }) {
  const demo = localStorage.getItem('eyesight-demo') === '1';
  const [info, setInfo] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [offer, setOffer] = useState({ state: 'idle', error: '' });

  useEffect(() => {
    if (demo) return undefined;
    let active = true;
    Promise.all([api.get('/meta/status'), api.get('/google/status'), api.get('/auth/me')])
      .then(([meta, google, me]) => {
        if (!active) return;
        const user = me.data.usuario || {};
        setInfo({ meta: meta.data, google: google.data, nome: user.nome, dismissed: user.preferences?.onboarding?.dismissed === true, weekly: user.preferences?.summary?.weekly === true });
      })
      .catch(() => { /* Sem status confiável o cartão simplesmente não aparece. */ });
    return () => { active = false; };
  }, [demo]);

  if (demo || !info || hasData === null || hidden || info.dismissed) return null;

  const connected = Boolean(info.meta.conectado || info.google.conectado);
  const fetched = connected && (Boolean(lastSyncedAt) || hasData === true);
  const hasResult = connected && hasData === true;
  const allDone = connected && fetched && hasResult;
  const missing = PLATFORMS.find(({ key }) => !info[key].conectado);

  const connect = async key => {
    setConnectError('');
    try { await startOAuth(key); } catch (error) { setConnectError(oauthErrorMessage(error)); }
  };
  const dismiss = () => {
    setHidden(true);
    api.put('/auth/me', { nome: info.nome, preferences: { onboarding: { dismissed: true } } }).catch(() => {});
  };
  const enableSummary = async () => {
    if (offer.state === 'sending') return;
    setOffer({ state: 'sending', error: '' });
    try {
      await api.put('/auth/me', { nome: info.nome, preferences: { summary: { weekly: true } } });
      setOffer({ state: 'on', error: '' });
    } catch {
      setOffer({ state: 'idle', error: 'Não foi possível ligar agora. Tente de novo em Meu perfil.' });
    }
  };
  const syncState = sync.state === 'running' ? 'running' : sync.state === 'error' ? 'error' : fetched ? 'done' : 'pending';

  return <section className="onboarding-card" role="region" aria-label="Primeiros passos">
    <h2>Primeiros passos</h2>
    <ol className="onboarding-steps">
      <Step title="Conectar sua conta de anúncios" state={connected ? 'done' : 'pending'}>
        {!connected && <>
          <p>Conecte o Meta Ads ou o Google Ads para ver os resultados dos seus anúncios aqui.</p>
          <div className="onboarding-actions">
            {PLATFORMS.map(({ key, name }) => info[key].configured === false
              ? <span className="onboarding-note" key={key}>{name}: <span>Integração ainda não configurada</span></span>
              : <button type="button" className="onboarding-primary" key={key} onClick={() => connect(key)}>Conectar {name}</button>)}
            <Link to="/demo">Ver com dados de exemplo</Link>
          </div>
          {connectError && <p className="onboarding-error" role="alert">{connectError}</p>}
        </>}
      </Step>
      <Step title="Buscar seus dados" state={syncState}>
        <div aria-live="polite">
          {sync.state === 'running' && <p>Buscando suas campanhas…</p>}
          {sync.state === 'error' && <>
            <p className="onboarding-error">{sync.message}</p>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-primary" onClick={() => sync.retry()}>Tentar de novo</button>
              <Link to="/app/account">Ver conexões</Link>
            </div>
          </>}
          {sync.state === 'idle' && sync.message && <p className="onboarding-note" role="status">{sync.message}</p>}
        </div>
        {sync.state === 'idle' && connected && !fetched && <div className="onboarding-actions">
          <button type="button" className="onboarding-primary" onClick={() => sync.retry()}>Buscar meus dados</button>
        </div>}
      </Step>
      <Step title="Ver seu primeiro resultado" state={hasResult ? 'done' : 'pending'}>
        {fetched && !hasResult && <p>Sua conta não tem campanhas com atividade neste período. Quando tiver, elas aparecem aqui.</p>}
      </Step>
    </ol>
    {allDone && <div className="onboarding-done">
      <p>Tudo pronto! Estes são os resultados dos seus anúncios.</p>
      {!info.weekly && offer.state !== 'on' && <div className="onboarding-offer">
        <p>Quer receber um resumo toda segunda-feira?</p>
        <button type="button" className="onboarding-primary" aria-disabled={offer.state === 'sending'} onClick={enableSummary}>Ligar o resumo semanal</button>
        {offer.error && <p className="onboarding-error" role="alert">{offer.error}</p>}
      </div>}
      {offer.state === 'on' && <p className="onboarding-note" role="status">Resumo ligado. Você pode desligar em Meu perfil.</p>}
      <div className="onboarding-actions">
        {missing && <Link to="/app/account">Conectar {missing.name} também</Link>}
        <button type="button" onClick={dismiss}>Ocultar</button>
      </div>
    </div>}
  </section>;
}
