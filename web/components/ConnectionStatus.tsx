interface ConnectionStatusProps {
  connected: boolean;
  connecting: boolean;
  hasError: boolean;
  disabled: boolean;
  onReconnect: () => void;
}

export function ConnectionStatus({ connected, connecting, hasError, disabled, onReconnect }: ConnectionStatusProps) {
  const label = connecting
    ? 'Aguardando Canva'
    : connected
      ? 'Canva conectado'
      : hasError
        ? 'Conexão pendente'
        : 'Conectar ao Canva';

  return (
    <button
      className={`connection-status ${connected ? 'is-connected' : hasError ? 'has-error' : ''}`}
      type="button"
      onClick={onReconnect}
      disabled={disabled}
      aria-label={connected ? 'Canva conectado. Reconectar ao Canva' : label}
    >
      <span className={`status-icon ${connecting ? 'is-spinning' : ''}`} aria-hidden="true">
        {connecting ? '' : connected ? '✓' : hasError ? '!' : '↗'}
      </span>
      <span>{label}</span>
    </button>
  );
}
