import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeedbackBanner } from './FeedbackBanner';

describe('FeedbackBanner', () => {
  it('expõe erro como alerta', () => {
    render(<FeedbackBanner kind="error" message="Não foi possível gerar opções." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível gerar opções.');
  });

  it('expõe processamento como status', () => {
    render(<FeedbackBanner kind="working" message="Gerando opções." />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
