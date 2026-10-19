import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Shield, Sun, Moon, Link2, ArrowUpRight } from 'lucide-react';
import api from '../services/api';
import { saveSession } from '../services/session';
import { useTheme } from '../hooks/useTheme';
import SummarySettings from '../components/summary/SummarySettings';
import '../styles/Profile.css';
import '../styles/Identity.css';
import '../styles/ProfilePro.css';

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?';
  return String(nameOrEmail).trim().split(/[\s@._-]+/).slice(0, 2).map(part => part[0]?.toUpperCase()).filter(Boolean).join('') || '?';
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [passwords, setPasswords] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
  const { lightMode, setLightMode } = useTheme();
  const demo = localStorage.getItem('eyesight-demo') === '1';

  async function load() {
    setMessage(null);
    try {
      const { data } = await api.get('/auth/me');
      setProfile(data.usuario);
    } catch (error) {
      setMessage({ error: true, text: error.response?.data?.erro || 'Não foi possível carregar o perfil. Tente novamente.' });
    }
  }
  // Initial server fetch populates this screen asynchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const { data } = await api.put('/auth/me', {
        nome: profile.nome, telefone: profile.telefone || '', localizacao: profile.localizacao || '',
        preferences: { theme: lightMode ? 'light' : 'dark' },
      });
      setProfile(data.usuario); saveSession(data);
      setMessage({ text: 'Perfil e preferência de tema salvos.' });
    } catch (error) {
      setMessage({ error: true, text: error.response?.data?.erro || 'Não foi possível salvar o perfil.' });
    } finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwords.novaSenha !== passwords.confirmarSenha) { setMessage({ error: true, text: 'As novas senhas não coincidem.' }); return; }
    setBusy(true); setMessage(null);
    try {
      const { data } = await api.post('/auth/alterar-senha', { senhaAtual: passwords.senhaAtual, novaSenha: passwords.novaSenha });
      setPasswords({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
      setMessage({ text: data.mensagem });
    } catch (error) {
      setMessage({ error: true, text: error.response?.data?.erro || 'Não foi possível alterar a senha.' });
    } finally { setBusy(false); }
  }

  const themeValue = lightMode ? 'light' : 'dark';
  return <div className="identity-page pf-page">
    <header className="pf-header"><h1>Meu perfil</h1><p>Seus dados, aparência e segurança da conta.</p></header>
    {message && <div className={`identity-message ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    {!profile ? <section className="identity-panel">{message ? <button onClick={load}>Tentar novamente</button> : <p role="status">Carregando perfil…</p>}</section> : <div className="pf-layout">
      <aside className="pf-aside">
        <section className="pf-id" aria-label="Resumo da conta">
          <div className="pf-avatar" aria-hidden="true">{getInitials(profile.nome || profile.email)}</div>
          <h2>{profile.nome || 'Usuário'}</h2>
          <p className="pf-email">{profile.email}</p>
          <div className="pf-badges">
            <span className="profile-badge">{lightMode ? 'Tema claro' : 'Tema escuro'}</span>
            {demo && <span className="profile-badge profile-badge-demo">Demonstração</span>}
          </div>
          <dl className="pf-facts">
            <div><dt>Telefone</dt><dd>{profile.telefone || 'Não informado'}</dd></div>
            <div><dt>Localização</dt><dd>{profile.localizacao || 'Não informada'}</dd></div>
          </dl>
        </section>
        <Link to="/app/account" className="pf-connect">
          <span className="pf-card-icon" aria-hidden="true"><Link2 size={18} /></span>
          <span className="pf-connect-text"><strong>Contas conectadas</strong><small>Gerencie suas integrações e o status de autorização das plataformas.</small></span>
          <ArrowUpRight size={18} aria-hidden="true" className="pf-connect-arrow" />
        </Link>
      </aside>

      <div className="pf-main">
        <form className="identity-panel pf-card" onSubmit={save}>
          <div className="pf-card-head">
            <span className="pf-card-icon" aria-hidden="true"><User size={18} /></span>
            <div><h2>Dados pessoais</h2><p>Como você aparece no Eyesight.</p></div>
          </div>
          <div className="identity-fields pf-fields">
            <label>Nome<input required maxLength={100} autoComplete="name" value={profile.nome || ''} onChange={e => setProfile({ ...profile, nome: e.target.value })} disabled={demo} /></label>
            <label>E-mail<input value={profile.email || ''} type="email" readOnly aria-describedby="profile-email-note" /></label>
            <label>Telefone<input type="tel" maxLength={30} autoComplete="tel" value={profile.telefone || ''} onChange={e => setProfile({ ...profile, telefone: e.target.value })} disabled={demo} /></label>
            <label>Localização<input maxLength={150} autoComplete="address-level2" placeholder="Cidade, estado" value={profile.localizacao || ''} onChange={e => setProfile({ ...profile, localizacao: e.target.value })} disabled={demo} /></label>
          </div>
          <p id="profile-email-note" className="pf-help">O e-mail identifica seu acesso e não pode ser alterado nesta tela.</p>

          <div className="pf-divider" role="presentation" />

          <div className="pf-row">
            <div className="pf-row-text">
              <h3 id="pf-theme-label"><Sun size={16} aria-hidden="true" /> Tema</h3>
              <p>Muda na hora neste navegador. Salve para guardar no seu perfil.</p>
            </div>
            <div className="pf-segment" role="group" aria-labelledby="pf-theme-label">
              <button type="button" aria-pressed={themeValue === 'dark'} onClick={() => setLightMode(false)}><Moon size={15} aria-hidden="true" /> Escuro</button>
              <button type="button" aria-pressed={themeValue === 'light'} onClick={() => setLightMode(true)}><Sun size={15} aria-hidden="true" /> Claro</button>
            </div>
          </div>

          <div className="pf-card-foot">
            <button className="identity-primary" disabled={busy || demo}>{busy ? 'Salvando…' : 'Salvar perfil'}</button>
            {demo && <span className="pf-foot-note">Edição indisponível na demonstração.</span>}
          </div>
        </form>

        <form className="identity-panel pf-card" onSubmit={changePassword}>
          <div className="pf-card-head">
            <span className="pf-card-icon" aria-hidden="true"><Shield size={18} /></span>
            <div><h2>Alterar senha</h2><p>Confirme a senha atual para proteger sua conta.</p></div>
          </div>
          <div className="identity-fields pf-fields">
            {[['senhaAtual', 'Senha atual', 'current-password'], ['novaSenha', 'Nova senha', 'new-password'], ['confirmarSenha', 'Confirmar nova senha', 'new-password']].map(([key, label, complete]) => <label key={key}>{label}<input type="password" required minLength={key === 'senhaAtual' ? 1 : 8} maxLength={256} autoComplete={complete} value={passwords[key]} onChange={e => setPasswords({ ...passwords, [key]: e.target.value })} disabled={demo} /></label>)}
          </div>
          <p className="pf-help">Use pelo menos 8 caracteres.</p>
          <div className="pf-card-foot">
            <button className="identity-primary" disabled={busy || demo}>{busy ? 'Aguarde…' : 'Alterar senha'}</button>
          </div>
        </form>

        <SummarySettings weekly={profile.preferences?.summary?.weekly === true} alerts={profile.preferences?.summary?.alerts === true} nome={profile.nome} />
      </div>
    </div>}
  </div>;
}

export default Profile;
