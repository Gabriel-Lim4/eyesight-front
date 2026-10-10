import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Shield, Sun } from 'lucide-react';
import api from '../services/api';
import { saveSession } from '../services/session';
import { useTheme } from '../hooks/useTheme';
import SummarySettings from '../components/summary/SummarySettings';
import '../styles/Profile.css';
import '../styles/Identity.css';

export default function Profile() {
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

  return <div className="identity-page">
    <header><h1>Meu perfil</h1><p>Seus dados, aparência e segurança da conta.</p></header>
    {message && <div className={`identity-message ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    {!profile ? <section className="identity-panel">{message ? <button onClick={load}>Tentar novamente</button> : <p role="status">Carregando perfil…</p>}</section> : <>
      <form className="identity-panel" onSubmit={save}>
        <h2><User size={20} /> Dados pessoais</h2>
        <div className="identity-fields">
          <label>Nome<input required maxLength={100} autoComplete="name" value={profile.nome || ''} onChange={e => setProfile({ ...profile, nome: e.target.value })} disabled={demo} /></label>
          <label>E-mail<input value={profile.email || ''} type="email" readOnly aria-describedby="profile-email-note" /></label>
          <label>Telefone<input type="tel" maxLength={30} autoComplete="tel" value={profile.telefone || ''} onChange={e => setProfile({ ...profile, telefone: e.target.value })} disabled={demo} /></label>
          <label>Localização<input maxLength={150} autoComplete="address-level2" placeholder="Cidade, estado" value={profile.localizacao || ''} onChange={e => setProfile({ ...profile, localizacao: e.target.value })} disabled={demo} /></label>
        </div>
        <p id="profile-email-note">O e-mail identifica seu acesso e não pode ser alterado nesta tela.</p>
        <h2><Sun size={20} /> Aparência</h2>
        <label>Tema<select value={lightMode ? 'light' : 'dark'} onChange={e => setLightMode(e.target.value === 'light')}><option value="dark">Escuro</option><option value="light">Claro</option></select></label>
        <p>O tema muda imediatamente neste navegador. Salve para guardar a preferência no seu perfil.</p>
        <button className="identity-primary" disabled={busy || demo}>{busy ? 'Salvando…' : 'Salvar perfil'}</button>
      </form>
      <form className="identity-panel" onSubmit={changePassword}>
        <h2><Shield size={20} /> Alterar senha</h2>
        <p>Confirme a senha atual para proteger sua conta.</p>
        <div className="identity-fields">
          {[['senhaAtual', 'Senha atual', 'current-password'], ['novaSenha', 'Nova senha', 'new-password'], ['confirmarSenha', 'Confirmar nova senha', 'new-password']].map(([key, label, complete]) => <label key={key}>{label}<input type="password" required minLength={key === 'senhaAtual' ? 1 : 8} maxLength={256} autoComplete={complete} value={passwords[key]} onChange={e => setPasswords({ ...passwords, [key]: e.target.value })} disabled={demo} /></label>)}
        </div>
        <p>Use pelo menos 8 caracteres.</p>
        <button className="identity-primary" disabled={busy || demo}>{busy ? 'Aguarde…' : 'Alterar senha'}</button>
      </form>
      <SummarySettings weekly={profile.preferences?.summary?.weekly === true} alerts={profile.preferences?.summary?.alerts === true} nome={profile.nome} />
      <section className="identity-panel"><h2>Contas conectadas</h2><p>Gerencie suas integrações e confira o status de autorização das plataformas.</p><Link to="/app/account">Gerenciar contas</Link></section>
    </>}
  </div>;
}
