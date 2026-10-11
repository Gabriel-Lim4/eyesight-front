import { logout } from '../services/api';
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* Importando ícones */
import { FiHome, FiInstagram, FiTrendingUp, FiUsers, FiLogOut, FiFileText } from "react-icons/fi";
import { SiGoogleads } from "react-icons/si";
import { MdOutlineDoubleArrow, MdOutlineSettings, MdAndroid } from "react-icons/md";
import logo from "../assets/Logo.png";
import ThemeToggle from "./ThemeToggle";
import "../styles/Sidebar.css";
import "../styles/Dashboard.css";

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

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true); setLogoutError(null);
    try { await logout(); navigate("/", { replace: true }); }
    catch { setLogoutError("Não foi possível sair. Tente novamente."); }
    finally { setLoggingOut(false); }
  };
  const [userName, setUserName] = useState(getUserName);

  // Estado de recolhida/expandida, lembrado entre recarregamentos
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("eyesight-sidebar-collapsed") === "1"
  );

  useEffect(() => {
    localStorage.setItem("eyesight-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Atualiza nome do usuário quando localStorage muda
  useEffect(() => {
    const handleStorage = () => setUserName(getUserName());
    window.addEventListener("storage", handleStorage);
    window.addEventListener("eyesight-user-change", handleStorage);
    return () => { window.removeEventListener("storage", handleStorage); window.removeEventListener("eyesight-user-change", handleStorage); };
  }, []);

  // Função para verificar a página ativa
  const isActive = (path) => (location.pathname === path ? "active-purple" : "");

  // Clicar na logo só expande
  const handleBrandClick = () => {
    if (collapsed) setCollapsed(false);
  };

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Alça para recolher/expandir a sidebar */}
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        <MdOutlineDoubleArrow />
      </button>

      <div>
        <button
          type="button"
          className="sidebar-brand"
          onClick={handleBrandClick}
          aria-label="Expandir menu"
        >
          <div className="sidebar-logo-ring">
            <img src={logo} alt="Eyesight Logo" className="sidebar-logo" />
          </div>
          <h2>EYESIGHT</h2>
        </button>

        <nav aria-label="Menu principal"><ul>
          <li className={isActive("/app")} title={collapsed ? "Início" : undefined}>
            <Link to="/app" aria-current={location.pathname === "/app" ? "page" : undefined}>
              <FiHome /> <span className="link-text">Início</span>
            </Link>
          </li>

          <li className={isActive("/app/instagram")} title={collapsed ? "Instagram" : undefined}>
            <Link to="/app/instagram" aria-current={location.pathname === "/app/instagram" ? "page" : undefined}>
              <FiInstagram /> <span className="link-text">Instagram</span>
            </Link>
          </li>

          <li className={isActive("/app/google")} title={collapsed ? "Google Ads" : undefined}>
            <Link to="/app/google" aria-current={location.pathname === "/app/google" ? "page" : undefined}>
              <SiGoogleads aria-hidden="true" focusable="false" /> <span className="link-text">Google Ads</span>
            </Link>
          </li>

          <li className={isActive("/app/meta")} title={collapsed ? "Meta Ads" : undefined}>
            <Link to="/app/meta" aria-current={location.pathname === "/app/meta" ? "page" : undefined}>
              <MdOutlineSettings /> <span className="link-text">Meta Ads</span>
            </Link>
          </li>

          <li className={isActive("/app/metrics")} title={collapsed ? "Métricas" : undefined}>
            <Link to="/app/metrics" aria-current={location.pathname === "/app/metrics" ? "page" : undefined}>
              <FiTrendingUp /> <span className="link-text">Métricas</span>
            </Link>
          </li>

          <li className={isActive("/app/relatorio")} title={collapsed ? "Relatório" : undefined}>
            <Link to="/app/relatorio" aria-current={location.pathname === "/app/relatorio" ? "page" : undefined}>
              <FiFileText aria-hidden="true" /> <span className="link-text">Relatório</span>
            </Link>
          </li>

          <li className={isActive("/app/account")} title={collapsed ? "Contas" : undefined}>
            <Link to="/app/account" aria-current={location.pathname === "/app/account" ? "page" : undefined}>
              <FiUsers /> <span className="link-text">Contas</span>
            </Link>
          </li>

          <li className={isActive("/app/assistant")} title={collapsed ? "Assistente IA" : undefined}>
            <Link to="/app/assistant" aria-current={location.pathname === "/app/assistant" ? "page" : undefined}>
              <MdAndroid /> <span className="link-text">Assistente IA</span>
            </Link>
          </li>
        </ul></nav>
      </div>

      <div className="sidebar-theme">
        <ThemeToggle />
        <span className="link-text">Tema</span>
      </div>

      {logoutError && <p role="alert" className="sidebar-logout-error">{logoutError}</p>}
      <button className="sidebar-logout" title="Sair" onClick={handleLogout} disabled={loggingOut}><FiLogOut /><span className="link-text">{loggingOut ? "Saindo…" : localStorage.getItem("eyesight-demo") === "1" ? "Sair da demonstração" : "Sair"}</span></button>

      {/* Área do Usuário no rodapé da Sidebar */}
      <div className="sidebar-footer" title={collapsed ? userName : undefined}>
        <Link to="/app/profile" className="avatar" aria-label="Ver perfil">
          {getInitials(userName)}
        </Link>
        <div className="user-info">
          <span className="user-name">{userName}</span>
          <Link to="/app/profile" className="view-profile">
            Ver perfil
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
