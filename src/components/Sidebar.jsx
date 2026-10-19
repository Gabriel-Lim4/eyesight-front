import { logout } from '../services/api';
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* Ícones: cada um representa o que está escrito ao lado */
import { FiHome, FiBarChart2, FiFileText, FiLink, FiCpu, FiLogOut, FiGlobe, FiHeart, FiPlusCircle } from "react-icons/fi";
import { SiGoogleads, SiInstagram, SiMeta, SiTiktok } from "react-icons/si";
import logo from "../assets/Logo.png";
import ThemeToggle from "./ThemeToggle";
import "../styles/Sidebar.css";
import "../styles/Dashboard.css";

/* Grupos do menu. A ordem aqui é a ordem na tela. */
const NAV_GROUPS = [
  {
    label: "Painel",
    items: [
      { to: "/app", label: "Início", Icon: FiHome },
      { to: "/app/metrics", label: "Métricas", Icon: FiBarChart2 },
      { to: "/app/relatorio", label: "Relatório", Icon: FiFileText },
      { to: "/app/assistant", label: "Argos IA", Icon: FiCpu },
    ],
  },
  {
    label: "Plataformas",
    items: [
      { to: "/app/instagram", label: "Instagram", Icon: SiInstagram },
      { to: "/app/google", label: "Google Ads", Icon: SiGoogleads },
      { to: "/app/meta", label: "Meta Ads", Icon: SiMeta },
    ],
  },
  {
    label: "Conta",
    items: [{ to: "/app/account", label: "Contas conectadas", Icon: FiLink }],
  },
];

const SOON = [
  { label: "TikTok", Icon: SiTiktok },
  { label: "Taboola", Icon: FiGlobe },
  { label: "Kwai", Icon: FiHeart },
  { label: "Mais plataformas", Icon: FiPlusCircle },
];

/* Abaixo desta largura o menu abre recolhido, só com os ícones */
const COMPACT_QUERY = "(max-width: 1023px) and (min-width: 769px)";
const STORAGE_KEY = "eyesight-sidebar-collapsed";

/* Obtém iniciais do nome do usuário */
function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/* Obtém nome do usuário do localStorage */
function getUserName() {
  if (localStorage.getItem("eyesight-demo") === "1") return "Demonstração";
  try {
    const userData = localStorage.getItem("userName");
    if (userData) return userData;
    // Fallback: tenta pegar do token decodificado
    const token = localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload?.name || payload?.nome || "Usuário";
    }
  } catch {
    // Silenciosamente retorna padrão
  }
  return "Usuário";
}

function compactScreen() {
  return typeof window.matchMedia === "function" && window.matchMedia(COMPACT_QUERY).matches;
}

function readCollapsed() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? compactScreen() : saved === "1";
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const demo = localStorage.getItem("eyesight-demo") === "1";
  const handleLogout = async () => {
    setLoggingOut(true); setLogoutError(null);
    try { await logout(); navigate("/", { replace: true }); }
    catch { setLogoutError("Não foi possível sair. Tente novamente."); }
    finally { setLoggingOut(false); }
  };
  const [userName, setUserName] = useState(getUserName);

  // Estado de recolhida/expandida, lembrado entre recarregamentos
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Ao encolher a janela até virar tela compacta, o menu recolhe sozinho (dá pra reabrir pela logo)
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(COMPACT_QUERY);
    const onChange = (event) => { if (event.matches) setCollapsed(true); };
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // Atualiza nome do usuário quando localStorage muda
  useEffect(() => {
    const handleStorage = () => setUserName(getUserName());
    window.addEventListener("storage", handleStorage);
    window.addEventListener("eyesight-user-change", handleStorage);
    return () => { window.removeEventListener("storage", handleStorage); window.removeEventListener("eyesight-user-change", handleStorage); };
  }, []);

  const isCurrent = (path) => location.pathname === path || (path === "/app" && location.pathname === "/app/dashboard");

  // Clicar na logo expande ou recolhe o menu
  const handleBrandClick = () => setCollapsed((prev) => !prev);
  const logoutLabel = loggingOut ? "Saindo…" : demo ? "Sair da demonstração" : "Sair";

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className="sidebar-brand"
        onClick={handleBrandClick}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        <span className="sidebar-logo-ring">
          <img src={logo} alt="" className="sidebar-logo" />
        </span>
        <h2>Eyesight</h2>
      </button>

      <nav className="sidebar-nav" aria-label="Menu principal">
        {NAV_GROUPS.map((group) => (
          <section className="sidebar-group" key={group.label} aria-labelledby={`sb-${group.label}`}>
            <p className="sidebar-group-label" id={`sb-${group.label}`}>{group.label}</p>
            <ul>
              {group.items.map(({ to, label, Icon }) => {
                const current = isCurrent(to);
                return (
                  <li key={to} className={current ? "active-purple" : ""} title={collapsed ? label : undefined}>
                    <Link to={to} aria-current={current ? "page" : undefined}>
                      <span className="sidebar-icon"><Icon aria-hidden="true" focusable="false" /></span>
                      <span className="link-text">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="sidebar-group sidebar-soon-group" aria-labelledby="sb-soon">
          <p className="sidebar-group-label sidebar-section-label" id="sb-soon">Em breve</p>
          <ul className="sidebar-soon-list">
            {SOON.map(({ label, Icon }) => (
              <li className="sidebar-soon-item" key={label} title={`${label} — em breve`}>
                <span className="sidebar-icon"><Icon aria-hidden="true" focusable="false" /></span>
                <span className="link-text">{label}</span>
              </li>
            ))}
          </ul>
        </section>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-theme">
          <ThemeToggle />
          <span className="link-text">Tema</span>
        </div>

        {logoutError && <p role="alert" className="sidebar-logout-error">{logoutError}</p>}

        {/* Área do usuário no rodapé da Sidebar */}
        <div className="sidebar-footer" title={collapsed ? userName : undefined}>
          <Link to="/app/profile" className="avatar" aria-label="Ver perfil">
            {getInitials(userName)}
          </Link>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <Link to="/app/profile" className="view-profile">Ver perfil</Link>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            title={logoutLabel}
            aria-label={logoutLabel}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <FiLogOut aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
