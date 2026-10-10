import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { FiFacebook } from 'react-icons/fi';
import { FaGoogle } from 'react-icons/fa';
import api from '../services/api';
import { oauthErrorMessage, startOAuth } from '../services/oauth';
import '../styles/variables.css';
import '../styles/Identity.css';

const platforms = [{ key: 'meta', name: 'Meta Ads', Icon: FiFacebook }, { key: 'google', name: 'Google Ads', Icon: FaGoogle }];
const callbackMessages = {
  'troca-bloqueada': 'A conta atual foi preservada. Para trocar de conta, desconecte a integração atual e autorize novamente. A desconexão remove os dados importados do Eyesight.',
  conectado: 'Conta conectada. Você já pode sincronizar campanhas.',
  erro: 'Não foi possível conectar. Tente novamente ou confira a configuração da integração.',
  negado: 'Autorização cancelada. Conecte novamente quando desejar.',
  'sem-conta': 'Nenhuma conta de anúncios acessível foi encontrada para este usuário.',
};

export default function Account() {
  const [params, setParams] = useSearchParams();
  const [statuses, setStatuses] = useState({});
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(() => {
    const key = params.get('meta') || params.get('google');
    return key ? { error: key !== 'conectado', text: callbackMessages[key] || 'A conexão não foi concluída. Tente novamente.' } : null;
  });
  const [confirm, setConfirm] = useState(null);
  const dialog = useRef(null);
  const demo = localStorage.getItem('eyesight-demo') === '1';
  const load = useCallback(async () => {
    const results = await Promise.all(platforms.map(async ({ key }) => {
      try { const { data } = await api.get(`/${key}/status`); return [key, data]; }
      catch (error) { return [key, { error: error.response?.data?.erro || 'Não foi possível verificar a conexão.' }]; }
    }));
    setStatuses(Object.fromEntries(results));
  }, []);
  // Initial server fetch populates this screen asynchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const justConnected = params.get('meta') === 'conectado' || params.get('google') === 'conectado';
    if (!justConnected && (params.has('meta') || params.has('google'))) {
      const next = new URLSearchParams(params); next.delete('meta'); next.delete('google');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); }, [confirm]);

  async function connect(key) {
    setBusy(key); setMessage(null);
    try {
      await startOAuth(key);
    } catch (error) {
      setMessage({ error: true, text: oauthErrorMessage(error) });
      setBusy(null);
    }
  }
  async function disconnect() {
    const key = confirm.key; setBusy(key); setMessage(null);
    try {
      await api.delete(`/${key}/desconectar`);
      setConfirm(null); await load();
      setMessage({ text: 'Conta desconectada e dados importados removidos do Eyesight.' });
    } catch (error) {
      setMessage({ error: true, text: error.response?.data?.erro || 'Não foi possível desconectar. Tente novamente.' });
      setConfirm(null);
    } finally { setBusy(null); }
  }

  const connected = ['meta', 'google'].find(key => params.get(key) === 'conectado');
  if (connected) return <Navigate to={`/app?conectado=${connected}`} replace />;

  return <div className="identity-page">
    <header><h1>Contas conectadas</h1><p>Autorize suas plataformas para importar campanhas e acompanhar resultados.</p></header>
    {message && <div className={`identity-message ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    <div className="identity-account-grid">{platforms.map(({ key, name, Icon }) => {
      const status = statuses[key];
      return <section className="identity-panel" key={key}>
        <h2><Icon aria-hidden="true" />{name}</h2>
        {!status ? <p role="status">Verificando conexão…</p> : status.error ? <><p role="alert">{status.error}</p><button onClick={load}>Tentar novamente</button></> : <>
          <strong>{status.conectado ? 'Conta conectada' : 'Não conectado'}</strong>
          {status.account_id && <p>Conta: {status.account_name || status.account_id}{status.currency ? ` · ${status.currency}` : ''}</p>}
          {status.vinculado_em && <p className="identity-status">Conectada em {new Date(status.vinculado_em).toLocaleDateString('pt-BR')}</p>}
          {status.configured === false && <p>Integração ainda não configurada no servidor. Configure as credenciais para autorizar sua conta.</p>}
          <div className="identity-actions">
            {status.conectado ? <><Link to={`/app/${key}`}>Ver campanhas</Link><button disabled={Boolean(busy) || demo} onClick={() => setConfirm({ key, name })}>Desconectar</button></> : <button className="identity-primary" disabled={Boolean(busy) || demo || status.configured === false} onClick={() => connect(key)}>{busy === key ? 'Conectando…' : `Conectar ${name}`}</button>}
          </div>
        </>}
      </section>;
    })}</div>
    <section className="identity-panel"><h2>Instagram profissional</h2><p>Os perfis profissionais disponíveis são consultados pela autorização do Meta. Conectar o Meta não garante que sua conta tenha um perfil Instagram elegível.</p><Link to="/app/instagram">Consultar perfis do Instagram</Link></section>
    {confirm && <dialog ref={dialog} onCancel={() => setConfirm(null)} aria-labelledby="disconnect-title">
      <h2 id="disconnect-title">Desconectar {confirm.name}?</h2>
      <p>Esta ação apaga do Eyesight as campanhas, métricas e análises importadas desta conta. Suas campanhas na plataforma continuam intactas. Uma nova conexão exigirá nova sincronização.</p>
      <div className="identity-actions"><button autoFocus disabled={Boolean(busy)} onClick={() => setConfirm(null)}>Cancelar</button><button disabled={Boolean(busy)} onClick={disconnect}>{busy ? 'Desconectando…' : 'Desconectar e apagar dados'}</button></div>
    </dialog>}
  </div>;
}
