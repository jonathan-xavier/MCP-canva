import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  it('comunica conexão por texto e permite reconectar', () => {
    const onReconnect = vi.fn();
    render(<ConnectionStatus connected connecting={false} hasError={false} disabled={false} onReconnect={onReconnect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Canva conectado. Reconectar ao Canva' }));
    expect(screen.getByText('Canva conectado')).toBeVisible();
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it('comunica espera sem depender apenas do spinner', () => {
    render(<ConnectionStatus connected={false} connecting hasError={false} disabled onReconnect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Aguardando Canva' })).toBeDisabled();
  });
});
