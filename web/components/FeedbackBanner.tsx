interface FeedbackBannerProps {
  kind: 'working' | 'error';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FeedbackBanner({ kind, message, actionLabel, onAction }: FeedbackBannerProps) {
  return (
    <div
      className={`feedback-banner ${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'working' ? 'polite' : undefined}
      aria-atomic="true"
    >
      <span className={`feedback-icon ${kind === 'working' ? 'is-spinning' : ''}`} aria-hidden="true">
        {kind === 'error' ? '!' : ''}
      </span>
      <span className="feedback-message">{message}</span>
      {actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
    </div>
  );
}
