import logo from "../assets/Logo.png";
import "../styles/Login.css";
import "../styles/ForgotPassword.css";
import "../styles/variables.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post('/auth/esqueci-senha', { email });
      setMessage(data.mensagem);
    } catch (err) {
      setError(err.response?.data?.erro || 'Não foi possível enviar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
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
        <Link className="fp-back" to="/login">Voltar para o login</Link>
        <h2>Redefinir senha</h2>
        <p className="fp-subtitle">Receba um link de recuperação por e-mail.</p>
        {error && <p className="erro-msg" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <form onSubmit={submit}>
          <label htmlFor="recovery-email">E-mail</label>
          <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
          <button className="btn-login" disabled={loading}>{loading ? 'Enviando...' : message ? 'Reenviar link' : 'Enviar link'}</button>
        </form>
      </div></div></div>
    </div>
  );
}
