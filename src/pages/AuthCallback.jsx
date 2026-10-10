import logo from "../assets/Logo.png";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "../styles/Login.css";
import "../styles/variables.css";

export default function AuthCallback({ recovery = false }) {
  const [callback] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return { token: params.get('access_token'), error: params.get('error_description'), type: params.get('type') };
  });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Remove credentials from the address bar without storing a recovery session.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmation) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    setError("");
    try {
      await api.post('/auth/redefinir-senha', { accessToken: callback.token, novaSenha: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.erro || 'Não foi possível redefinir a senha. Solicite um novo link.');
    } finally {
      setLoading(false);
    }
  }

  const invalid = callback.error || !callback.token || (recovery && callback.type !== 'recovery');
  return (
    <div className="login-page"><div className="login-container">
        <div className="left-side">
          <span className="brand-circle brand-circle-1" aria-hidden="true" />
          <span className="brand-circle brand-circle-2" aria-hidden="true" />
          <span className="brand-circle brand-circle-3" aria-hidden="true" />
          <div className="login-header">
            <div className="logo-box"><img src={logo} alt="Eyesight" /></div>
            <h1>EYESIGHT</h1><p>Marketing Metrics</p>
          </div>
        </div>
        <div className="right-side"><div className="login-box">
      <h2>{recovery ? 'Redefinir senha' : 'Confirmação de e-mail'}</h2>
      {invalid ? (
        <p role="alert">Link inválido ou expirado. Solicite um novo link.</p>
      ) : recovery && !done ? (
        <form onSubmit={submit}>
          <label htmlFor="new-password">Nova senha</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
          <label htmlFor="confirm-password">Confirmar senha</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          {error && <p className="erro-msg" role="alert">{error}</p>}
          <button className="btn-login" disabled={loading}>{loading ? 'Salvando...' : 'Salvar senha'}</button>
        </form>
      ) : <p role="status">{recovery ? 'Senha redefinida. Entre com a nova senha.' : 'E-mail confirmado. Faça login para continuar.'}</p>}
      {invalid && recovery && <Link to="/esqueci-senha">Solicitar novo link</Link>}
      <p><Link to="/login">Voltar para o login</Link></p>
    </div></div></div></div>
  );
}
