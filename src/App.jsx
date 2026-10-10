import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";

/* Componentes carregados imediatamente (críticos) */
import Home from "./pages/Home";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import DemoEntry from "./pages/DemoEntry";
import CancelSummary from "./pages/CancelSummary";
import ErrorBoundary from "./components/ErrorBoundary";
import SkipLink from "./components/SkipLink";
import RotaProtegida from "./components/RotaProtegida";
import "./styles/Theme.css";

/* Lazy loading das páginas internas (reduz bundle inicial) */
const Layout = lazy(() => import("./pages/Layout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Instagram = lazy(() => import("./pages/Instagram"));
const Google = lazy(() => import("./pages/Google"));
const Meta = lazy(() => import("./pages/Meta"));
const Metrics = lazy(() => import("./pages/Metrics"));
const Account = lazy(() => import("./pages/Account"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Profile = lazy(() => import("./pages/Profile"));

/* Componente de fallback para carregamento */
function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "3px solid #1e293b",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* Rola para o topo ao trocar de rota */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <SkipLink />
      <ScrollToTop />

      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoEntry />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/cancelar-resumo" element={<CancelSummary />} />
        <Route path="/verificar-email" element={<AuthCallback />} />
        <Route path="/redefinir-senha" element={<AuthCallback recovery />} />

        {/* Rotas protegidas (exigem autenticação) */}
        <Route
          path="/app"
          element={
            <RotaProtegida>
              <Suspense fallback={<PageLoader />}>
                <Layout />
              </Suspense>
            </RotaProtegida>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="instagram"
            element={
              <Suspense fallback={<PageLoader />}>
                <Instagram />
              </Suspense>
            }
          />
          <Route
            path="google"
            element={
              <Suspense fallback={<PageLoader />}>
                <Google />
              </Suspense>
            }
          />
          <Route
            path="meta"
            element={
              <Suspense fallback={<PageLoader />}>
                <Meta />
              </Suspense>
            }
          />
          <Route
            path="metrics"
            element={
              <Suspense fallback={<PageLoader />}>
                <Metrics />
              </Suspense>
            }
          />
          <Route
            path="account"
            element={
              <Suspense fallback={<PageLoader />}>
                <Account />
              </Suspense>
            }
          />
          <Route
            path="assistant"
            element={
              <Suspense fallback={<PageLoader />}>
                <Assistant />
              </Suspense>
            }
          />
          <Route
            path="profile"
            element={
              <Suspense fallback={<PageLoader />}>
                <Profile />
              </Suspense>
            }
          />
        </Route>

        {/* Fallback - redireciona para home */}
        <Route path="*" element={<main id="main-content" style={{ padding: 48 }}><h1>Página não encontrada</h1><p>O endereço pode ter mudado.</p><Link to="/">Voltar ao início</Link></main>} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
