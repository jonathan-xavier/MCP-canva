import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProcessStepper } from './ProcessStepper';

describe('ProcessStepper', () => {
  it.each([
    [1, 'Briefing'],
    [2, 'Escolha'],
    [3, 'Exporte'],
  ])('marca semanticamente a etapa %i', (step, label) => {
    render(<ProcessStepper currentStep={step} />);
    expect(screen.getByText(label).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByRole('listitem').filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1);
  });
});
