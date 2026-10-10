import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiEye, FiInstagram } from 'react-icons/fi';
import api from '../services/api';
import '../styles/Instagram.css';
import '../styles/variables.css';
import '../styles/Identity.css';

const formatNumber = value => value == null ? 'Indisponível' : Number(value).toLocaleString('pt-BR');

export default function Instagram() {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('last_30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload(value => value + 1), []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(null); setMetrics(null);
      try {
        const { data: connection } = await api.get('/instagram/status');
        if (!active) return;
        setStatus(connection);
        if (connection.conectado) {
          const { data } = await api.get('/instagram/metricas', { params: { periodo: period } });
          if (active) setMetrics(data);
        }
      } catch (failure) {
        if (active) setError({ message: failure.response?.data?.erro || 'Não foi possível consultar o Instagram. Tente novamente.', reconnect: failure.response?.data?.acao === 'reconectar' });
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [period, reload]);

  const profile = metrics?.perfil || {};
  return <div className="identity-page instagram-page">
    <header><h1>Instagram profissional</h1><p>Perfil e alcance disponíveis pela integração Meta.</p></header>
    <section className="identity-panel">
      <div className="identity-actions instagram-controls">
        <label>Período do alcance<select value={period} onChange={event => setPeriod(event.target.value)} disabled={loading}><option value="last_7d">Últimos 7 dias</option><option value="last_30d">Últimos 30 dias</option></select></label>
        <button onClick={refresh} disabled={loading}>{loading ? 'Consultando…' : 'Atualizar dados'}</button>
      </div>
      <p>A consulta de alcance aceita até 30 dias. Seguidores e publicações representam o total atual do perfil.</p>
    </section>
    {loading ? <p role="status">Consultando perfil e métricas…</p> : error ? <section className="identity-panel"><p role="alert">{error.message}</p><div className="identity-actions"><button onClick={refresh}>Tentar novamente</button>{error.reconnect && <Link to="/app/account">Reconectar Meta</Link>}</div></section> : !status?.conectado ? <section className="identity-panel">
      <h2><FiInstagram />{status?.motivo === 'sem_conta_instagram' ? 'Nenhum perfil profissional encontrado' : 'Conecte sua conta Meta'}</h2>
      <p>{status?.motivo === 'sem_conta_instagram' ? 'Vincule um perfil profissional do Instagram a uma Página Facebook e autorize o acesso à Página na conexão Meta.' : 'Autorize sua conta Meta para consultar os perfis profissionais do Instagram associados às suas Páginas.'}</p>
      <Link to="/app/account">Gerenciar conexão Meta</Link>
    </section> : metrics && <>
      <section className="identity-panel"><h2><FiInstagram />{profile.username ? `@${profile.username}` : 'Perfil profissional'}</h2><p>Dados consultados diretamente na plataforma para o período selecionado.</p></section>
      <div className="overview-row instagram-overview">
        <section className="card"><div className="icon-box instagram-accent"><FiUsers /></div><h2 className="card-title">Seguidores</h2><p className="card-value">{formatNumber(profile.seguidores)}</p><span className="card-note">Total atual do perfil</span></section>
        <section className="card"><div className="icon-box instagram-accent"><FiEye /></div><h2 className="card-title">Alcance diário acumulado</h2><p className="card-value">{formatNumber(metrics.metricas?.alcance)}</p><span className="card-note">{period === 'last_7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}</span></section>
        <section className="card"><div className="icon-box instagram-accent"><FiInstagram /></div><h2 className="card-title">Publicações</h2><p className="card-value">{formatNumber(profile.totalPosts)}</p><span className="card-note">Total atual do perfil</span></section>
      </div>
      <section className="identity-panel"><h2>Como interpretar os dados</h2><p>O alcance é a soma dos dias do período; uma pessoa pode ser contada em mais de um dia. Não representa pessoas únicas no período inteiro.</p>{(metrics.warnings || []).map(warning => <p key={warning}>{warning}</p>)}<p>Valores indisponíveis não são zero. Impressões, visitas, cliques, engajamento e dados individuais de Stories e Reels não são fornecidos nesta integração.</p></section>
    </>}
  </div>;
}
