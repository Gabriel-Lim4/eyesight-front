import { useEffect, useMemo, useRef, useState } from 'react';
import { FiX, FiShield, FiFileText, FiCheck } from 'react-icons/fi';
import { parseTerms } from '../utils/parseTerms';
import termsText from '../content/terms.txt?raw';
import '../styles/TermsModal.css';

const TAB_ICONS = [FiFileText, FiShield];

/* Placeholders como [e-mail de contato do projeto] ficam destacados até alguém preencher. */
function Text({ children }) {
  return String(children).split(/(\[[^\]]+\])/g).map((part, index) => (/^\[[^\]]+\]$/.test(part)
    ? <mark key={index} className="terms-todo" title="Preencher antes de publicar">{part}</mark>
    : part));
}

function Block({ block }) {
  if (block.type === 'list') return <ul className="terms-list">{block.items.map(item => <li key={item}><Text>{item}</Text></li>)}</ul>;
  if (block.type === 'clause') return <p className="terms-clause"><span className="terms-clause-number">{block.number}</span><span><Text>{block.text}</Text></span></p>;
  return <p className="terms-text"><Text>{block.text}</Text></p>;
}

export default function TermsModal({ onAccept, onClose }) {
  const documents = useMemo(() => parseTerms(termsText), []);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const dialog = useRef(null), body = useRef(null);
  const doc = documents[active] || documents[0];

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [onClose]);

  const selectTab = index => { setActive(index); setProgress(0); if (body.current) body.current.scrollTop = 0; };

  const onScroll = event => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    setProgress(scrollHeight > clientHeight ? Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)) : 100);
  };
  const goTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!doc) return null;
  return <div className="terms-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="terms-dialog" role="dialog" aria-modal="true" aria-labelledby="terms-title" tabIndex={-1} ref={dialog}>
      <header className="terms-header">
        <div>
          <h2 id="terms-title">Termos de Uso e Privacidade</h2>
          <p>Leia com calma. Você pode voltar a este texto quando quiser.</p>
        </div>
        <button type="button" className="terms-close" onClick={onClose} aria-label="Fechar"><FiX aria-hidden="true" /></button>
      </header>

      <div className="terms-tabs" role="tablist" aria-label="Documentos">
        {documents.map((item, index) => {
          const Icon = TAB_ICONS[index] || FiFileText;
          return <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-selected={index === active} aria-controls="terms-panel" className={index === active ? 'is-active' : ''} onClick={() => selectTab(index)}><Icon aria-hidden="true" /> {item.title}</button>;
        })}
      </div>
      <div className="terms-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

      <div className="terms-layout">
        <nav className="terms-toc" aria-label="Seções deste documento">
          <p>Nesta página</p>
          <ol>{doc.sections.map(section => <li key={section.id}><button type="button" onClick={() => goTo(section.id)}><span>{section.number}</span>{section.title}</button></li>)}</ol>
        </nav>

        <div className="terms-body" id="terms-panel" role="tabpanel" aria-labelledby={`tab-${doc.id}`} ref={body} onScroll={onScroll} tabIndex={0}>
          <h3 className="terms-doc-title">{doc.title}</h3>
          {doc.updated && <p className="terms-updated">Última atualização: {doc.updated}</p>}
          {doc.intro.map((block, index) => <Block key={index} block={block} />)}
          {doc.sections.map(section => <section key={section.id} id={section.id} className="terms-section">
            <h4><span>{section.number}</span>{section.title}</h4>
            {section.blocks.map((block, index) => <Block key={index} block={block} />)}
          </section>)}
        </div>
      </div>

      <footer className="terms-footer">
        <button type="button" className="terms-secondary" onClick={onClose}>Fechar</button>
        <button type="button" className="terms-primary" onClick={onAccept}><FiCheck aria-hidden="true" /> Li e concordo</button>
      </footer>
    </div>
  </div>;
}
