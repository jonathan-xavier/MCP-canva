export function EmptyState() {
  return (
    <div className="empty-stage">
      <div className="empty-visual" aria-hidden="true">
        <span className="visual-sheet visual-sheet-back" />
        <span className="visual-sheet visual-sheet-front">
          <span className="visual-kicker" />
          <span className="visual-title" />
          <span className="visual-title visual-title-short" />
          <span className="visual-pill" />
        </span>
        <span className="visual-spark">✦</span>
      </div>
      <div className="empty-content">
        <span className="section-label">Espaço de criação</span>
        <h3>Suas opções aparecem aqui</h3>
        <p>Envie o briefing para comparar diferentes caminhos visuais antes de criar o design definitivo.</p>
      </div>
    </div>
  );
}
