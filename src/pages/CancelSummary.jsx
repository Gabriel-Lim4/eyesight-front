import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import '../styles/Summary.css';

const INVALID = 'Este link não é válido ou expirou. Entre no app e desligue o resumo em Meu perfil.';

/* Página pública aberta pelo link do e-mail. Só o clique no botão cancela; abrir o link não faz nada. */
export default function CancelSummary() {
  const [params] = useSearchParams();
  const token = params.get('t');
  const alerts = params.get('e') === 'alertas';
  const [state, setState] = useState('idle');
  const [error, setError] = useState(token ? '' : INVALID);

  const cancel = async () => {
    if (state === 'sending') return;
    setState('sending');
    setError('');
    try {
      await api.post('/resumo/cancelar', alerts ? { token, escopo: 'alertas' } : { token });
      setState('done');
    } catch (err) {
      setState('idle');
      setError(err.response?.status === 400 ? INVALID : 'Não foi possível cancelar agora. Tente de novo.');
    }
  };

  const invalid = !token || error === INVALID;
  return <main id="main-content" className="summary-cancel">
    <h1>{alerts ? 'Parar de receber os alertas?' : 'Parar de receber o resumo semanal?'}</h1>
    {state === 'done'
      ? <p role="status">{alerts ? 'Pronto. Você não receberá mais os alertas. Para voltar a receber, ligue em Meu perfil.' : 'Pronto. Você não receberá mais o resumo semanal. Para voltar a receber, ligue em Meu perfil.'}</p>
      : <>
        {error && <p className="summary-error" role="alert">{error}</p>}
        {!invalid && <button type="button" className="summary-button" aria-disabled={state === 'sending'} onClick={cancel}>
          {state === 'sending' ? 'Cancelando…' : 'Parar de receber'}
        </button>}
      </>}
    <p><Link to="/">Voltar ao início</Link></p>
  </main>;
}
