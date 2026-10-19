import { saveSession } from '../services/session';
import "../styles/Login.css";
import "../styles/variables.css";
import "../styles/AuthRefresh.css";
import TermsModal from "../components/TermsModal";
import ThemeToggle from "../components/ThemeToggle";
import { FiArrowLeft } from "react-icons/fi";
import { useState } from "react";
import logo from "../assets/Logo.png";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";

// Configurações do Medidor de Força da Senha
const STRENGTH_LABELS = ["Fraca", "Forte", "Muito forte"];
const STRENGTH_COLORS = ["#ef4444", "#22c55e", "#16a34a"];

// Validação de e-mail
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mensagens de validação
const VALIDATION_MESSAGES = {
  email: {
    required: 'E-mail é obrigatório.',
    pattern: 'Por favor, insira um e-mail válido.',
  },
  senha: {
    required: 'Senha é obrigatória.',
    minlength: 'Senha deve ter no mínimo 8 caracteres.',
  },
};

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isCadastro, setIsCadastro] = useState(
    () => searchParams.get("cadastro") === "1"
  );

  // --- Campos ---
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);

  // --- Visibilidade da Senha ---
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  // --- Modal de Termos ---
  const [showModalTermos, setShowModalTermos] = useState(false);

  // --- Feedback ---
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  // -------------------------------------------------------
  // CÁLCULO DE FORÇA DA SENHA
  // -------------------------------------------------------
  const getPasswordStrength = (pass) => {
    if (!pass) return 0;

    const temTamanhoMinimo = pass.length >= 8;
    const temLetras = /[a-zA-Z]/.test(pass);
    const temNumeros = /\d/.test(pass);
    const temEspeciais = /[^A-Za-z0-9]/.test(pass);

    if (pass.length >= 10 && temLetras && temNumeros && temEspeciais) {
      return 2; // Muito forte
    }

    if (temTamanhoMinimo && ((temLetras && temNumeros) || temEspeciais)) {
      return 1; // Forte
    }

    return 0; // Fraca
  };

  const forcaAtual = getPasswordStrength(senha);

  // -------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------
  async function handleLogin() {
    setErro("");

    // Validação de campos obrigatórios
    if (!email) {
      setErro(VALIDATION_MESSAGES.email.required);
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErro(VALIDATION_MESSAGES.email.pattern);
      return;
    }

    if (!senha) {
      setErro(VALIDATION_MESSAGES.senha.required);
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post("/auth/login", { email, senha });

      if (data.token) {
        localStorage.removeItem("eyesight-demo");
        saveSession(data);
      }

      navigate("/app/dashboard");
    } catch (err) {
      const msg =
        err.response?.data?.erro ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        "E-mail ou senha incorretos.";
      setNeedsVerification(Boolean(err.response?.data?.requerVerificacao));
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // CADASTRO
  // -------------------------------------------------------
  async function handleCadastro() {
    setErro("");

    // Validação de campos obrigatórios
    if (!nome) {
      setErro("Nome é obrigatório.");
      return;
    }

    if (!email) {
      setErro(VALIDATION_MESSAGES.email.required);
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErro(VALIDATION_MESSAGES.email.pattern);
      return;
    }

    if (!senha) {
      setErro(VALIDATION_MESSAGES.senha.required);
      return;
    }

    if (senha.length < 8) {
      setErro("Senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    if (forcaAtual === 0) {
      setErro("Sua senha está muito fraca. Crie uma senha mais forte.");
      return;
    }

    if (!aceitouTermos) {
      setErro("Você precisa aceitar os Termos de Uso e Privacidade.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post("/auth/cadastro", { nome, email, senha });
      setNotice(data.mensagem || "Verifique seu e-mail para confirmar o cadastro.");
      setNeedsVerification(true);

      // Após cadastrar, volta para login
      setIsCadastro(false);
      setErro("");
      setNome("");
      setSenha("");
      setConfirmarSenha("");
      setAceitouTermos(false);
      navigate("/login", { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.erro ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Erro ao cadastrar. Tente novamente.";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // Limpa erros ao trocar de modo
  // -------------------------------------------------------
  function trocarModo(paraCadastro) {
    setNotice("");
    setNeedsVerification(false);
    setErro("");
    setNome("");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setAceitouTermos(false);
    setMostrarSenha(false);
    setMostrarConfirmarSenha(false);
    setIsCadastro(paraCadastro);
    navigate(paraCadastro ? "/login?cadastro=1" : "/login", { replace: true });
  }

  // -------------------------------------------------------
  // SUBMISSÃO DO FORMULÁRIO
  // Enter no teclado e clique no botão usam o mesmo fluxo.
  // -------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    if (isCadastro) {
      await handleCadastro();
    } else {
      await handleLogin();
    }
  }

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (

    <div className="login-page">

      <div className={`login-container ${isCadastro ? "cadastro-mode" : ""}`}>

        {/* PAINEL ESQUERDO */}
        <div className="left-side">
          <div className="auth-topbar">
            <button type="button" className="auth-back" onClick={() => navigate("/")}>
              <FiArrowLeft aria-hidden="true" />
              Voltar
            </button>
            <ThemeToggle />
          </div>

          <span className="brand-circle brand-circle-1" aria-hidden="true" />
          <span className="brand-circle brand-circle-2" aria-hidden="true" />
          <span className="brand-circle brand-circle-3" aria-hidden="true" />

          <div className="login-header">
            <img src={logo} alt="Eyesight Logo" className="login-logo" />
            <h1>EYESIGHT</h1>
            <p>Marketing Metrics</p>
          </div>
        </div>

        {/* FORMULÁRIO */}
        <div className="right-side">
          <div className="login-box">
            <form onSubmit={handleSubmit}>

            <h2>{isCadastro ? "Cadastrar" : "Entrar"}</h2>

            {/* Mensagem de erro */}
            {notice && <p role="status">{notice}</p>}
            {needsVerification && !isCadastro && (
              <button type="button" disabled={loading} onClick={async () => {
                setLoading(true);
                setErro("");
                try {
                  const { data } = await api.post('/auth/reenviar-verificacao', { email });
                  setNotice(data.mensagem);
                } catch (error) {
                  setErro(error.response?.data?.erro || 'Não foi possível reenviar o e-mail.');
                } finally {
                  setLoading(false);
                }
              }}>Reenviar confirmação</button>
            )}
            {erro && <p className="erro-msg" role="alert">{erro}</p>}

            {/* Campo Nome — só no cadastro */}
            {isCadastro && (
              <>
                <label htmlFor="login-nome">Nome</label>
<input id="login-nome"
              type="text"
              placeholder="Seu nome..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={loading}
              autoComplete="name"
              spellCheck={false}
            />
              </>
            )}

            {/* E-mail */}
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email"
              type="email"
              placeholder="seu@email.com..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              spellCheck={false}
            />

            {/* Senha */}
            <label htmlFor="login-senha">Senha</label>
            <div className="password-input-wrapper">
              <input id="login-senha"
                type={mostrarSenha ? "text" : "password"}
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                spellCheck={false}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                disabled={loading}
              >
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {/* Medidor de Força da Senha */}
            {isCadastro && senha && (
              <div className="strength-meter" style={{ marginTop: "8px", marginBottom: "8px" }}>
                <div
                  className="strength-track"
style={{
                      height: "100%",
                      borderRadius: "4px",
                      overflow: "hidden",
                      marginBottom: "4px",
                    }}
                  >
                    <div
                      className="strength-fill"
                      style={{
                        height: "100%",
                        width: `${((forcaAtual + 1) / 3) * 100}%`,
                        backgroundColor: STRENGTH_COLORS[forcaAtual],
                        transition: "width 0.3s ease, background-color 0.3s ease",
                      }}
                    />
                </div>
                <span
                  style={{
                    color: STRENGTH_COLORS[forcaAtual],
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                  }}
                >
                  {STRENGTH_LABELS[forcaAtual]}
                </span>
              </div>
            )}

            {/* Confirmar Senha — só no cadastro */}
            {isCadastro && (
              <>
                <label htmlFor="login-confirmar">Confirmar Senha</label>
                <div className="password-input-wrapper">
                  <input id="login-confirmar"
                    type={mostrarConfirmarSenha ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                    disabled={loading}
                  >
                    {mostrarConfirmarSenha ? "Ocultar" : "Mostrar"}
                  </button>
                </div>

                {/* Checkbox de Termos de Uso */}
                <div className="terms-checkbox-container" style={{ marginTop: "12px" }}>
                  <input
                    type="checkbox"
                    id="termos"
                    checked={aceitouTermos}
                    onChange={(e) => setAceitouTermos(e.target.checked)}
                    disabled={loading}
                  />
                  <label htmlFor="termos">
                    Li e aceito os{" "}
                    <span
                      className="terms-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowModalTermos(true);
                      }}
                    >
                      Termos de Uso e Privacidade
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* Esqueceu a senha — só no login */}
            {!isCadastro && (
              <span className="forgot" role="button" tabIndex={0} onClick={() => navigate("/esqueci-senha")} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (() => navigate("/esqueci-senha"))())}>
                Esqueceu a senha?
              </span>
            )}

            {/* Botão principal */}
            <button
              type="submit"
              className="btn-login"
              disabled={loading}
            >
              {loading
                ? "Aguarde..."
                : isCadastro
                  ? "Cadastrar"
                  : "Entrar →"}
            </button>

            <div className="divider">
              <span>ou</span>
            </div>

            {/* Troca entre Login / Cadastro */}
            {!isCadastro ? (
              <p className="register">
                Não tem uma conta?{" "}
                <span role="button" tabIndex={0} onClick={() => trocarModo(true)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (() => trocarModo(true))())}>Cadastre-se</span>
              </p>
            ) : (
              <p className="register">
                Já possui conta?{" "}
                <span role="button" tabIndex={0} onClick={() => trocarModo(false)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (() => trocarModo(false))())}>Entrar</span>
              </p>
            )}

            </form>
          </div>
        </div>
      </div>

      {/* MODAL DE TERMOS DE USO E PRIVACIDADE */}
      {showModalTermos && (
        <TermsModal
          onClose={() => setShowModalTermos(false)}
          onAccept={() => {
            setAceitouTermos(true);
            setShowModalTermos(false);
          }}
        />
      )}
    </div>
  );
}

export default Login;
