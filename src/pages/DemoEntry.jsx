import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DemoEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem('eyesight-demo', '1');
    navigate('/app', { replace: true });
  }, [navigate]);
  return <p role="status">Preparando demonstração…</p>;
}
