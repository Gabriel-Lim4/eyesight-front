import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STATE_COPY, focusTitle, suggestionsFor } from './explainerCopy';
import '../../styles/Explainer.css';

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled])';

export default function ExplainerPanel({ focus, messages, pendingText, state, error, onAsk, onClose }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  const [draft, setDraft] = useState('');
  const sending = state === 'sending';
  const title = focusTitle(focus);

  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    const onKey = event => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && previous.isConnected) previous.focus();
    };
  }, []);

  const trapTab = event => {
    if (event.key !== 'Tab') return;
    const items = [...panel.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const submit = async event => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    if (await onAsk(draft)) setDraft('');
  };

  return <>
    <div className="ex-backdrop" onClick={onClose} aria-hidden="true" />
    <aside ref={panel} className="ex-panel" role="dialog" aria-modal="true" aria-labelledby="ex-title" tabIndex={-1} onKeyDown={trapTab}>
      <header className="ex-head">
        <h2 id="ex-title">{title}</h2>
        <button type="button" className="ex-close" onClick={onClose} aria-label="Fechar painel"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="ex-log" aria-live="polite">
        {messages.map((message, index) => <p key={index} className={`ex-message is-${message.role}`}>{message.content}</p>)}
        {pendingText && <p className="ex-message is-user">{pendingText}</p>}
        {sending && <p className="ex-status">{STATE_COPY.sending}</p>}
      </div>
      {(state === 'error' || state === 'limit') && <div className="ex-error" role="alert">
        <p>{error}</p>
        {state === 'error' && pendingText && <button type="button" className="ex-retry" onClick={() => onAsk(pendingText)}>{STATE_COPY.retry}</button>}
      </div>}
      <div className="ex-suggestions">
        {suggestionsFor(focus).map(question => <button key={question} type="button" aria-disabled={sending} onClick={() => { if (!sending) onAsk(question); }}>{question}</button>)}
      </div>
      <form className="ex-form" onSubmit={submit}>
        <label htmlFor="ex-free">Ou escreva sua pergunta</label>
        <textarea id="ex-free" rows={3} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} />
        <button type="submit" className="ex-send" disabled={!draft.trim()} aria-disabled={sending}><Send size={16} aria-hidden="true" /><span>Enviar</span></button>
      </form>
    </aside>
  </>;
}
