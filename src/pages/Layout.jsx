import Sidebar from '../components/Sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';
import '../styles/variables.css';
import '../styles/Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  const demo = localStorage.getItem('eyesight-demo') === '1';
  const leaveDemo = () => { localStorage.removeItem('eyesight-demo'); navigate(localStorage.getItem('token') ? '/app' : '/', { replace: true }); };
  return <div className="dashboard-container app-shell">
    <Sidebar />
    <main id="main-content" className="dashboard-content app-main" tabIndex={-1}>
      {demo && <aside className="demo-banner" aria-label="Modo demonstração"><div><strong>Demonstração</strong><span>Dados fictícios · nenhuma conta real consultada · somente leitura</span></div><button onClick={leaveDemo}>Sair da demonstração</button></aside>}
      <Outlet />
    </main>
  </div>;
}
