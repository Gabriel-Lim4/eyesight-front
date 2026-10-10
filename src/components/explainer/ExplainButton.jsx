import { MessageCircleQuestion } from 'lucide-react';
import '../../styles/Explainer.css';

export default function ExplainButton({ label, onClick, disabled = false, describedBy }) {
  return <button type="button" className="ex-button" onClick={onClick} disabled={disabled} aria-label={`Explicar: ${label}`} aria-describedby={describedBy}>
    <MessageCircleQuestion size={16} aria-hidden="true" />
    <span>Explicar</span>
  </button>;
}
