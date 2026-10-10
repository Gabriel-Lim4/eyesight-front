// ─────────────────────────────────────────────────────────────
// components/RotaProtegida.jsx
//
// Componente que envolve rotas que exigem autenticação.
// Se não houver token no localStorage, redireciona para o login.
//
// Como usar no App.jsx:
//   <Route path="/app" element={<RotaProtegida><Layout /></RotaProtegida>}>
//
// Por que verificar no front se o back-end já valida o JWT?
// O back-end protege os DADOS. O front-end protege a UI.
// Sem isso, um usuário sem token consegue ver as telas
// (mesmo que sem dados reais) — má experiência e falha de UX.
// ─────────────────────────────────────────────────────────────

import { Navigate } from 'react-router-dom';

function RotaProtegida({ children }) {
  const token = localStorage.getItem('token');

  // Se não tiver token, redireciona para "/" (Login)
  // "replace" substitui o histórico — o usuário não consegue
  // voltar para a rota protegida clicando em "Voltar" no browser.
  if (!token && localStorage.getItem('eyesight-demo') !== '1') {
    return <Navigate to="/login" replace />;
  }

  // Tem token: renderiza normalmente o que foi passado como children
  return children;
}

export default RotaProtegida;
