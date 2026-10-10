import "./EmptyState.css";

function EmptyState({ title, description, icon, buttonText, onButtonClick }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon}
      </div>
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-description">{description}</p>}
      {buttonText && (
        <button
          className="empty-state-button"
          onClick={onButtonClick}
          aria-label={onButtonClick ? "Ação disponível" : undefined}
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
