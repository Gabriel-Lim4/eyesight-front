import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Cadastro() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/login?cadastro=1", { replace: true });
  }, [navigate]);

  return null;
}

export default Cadastro;
