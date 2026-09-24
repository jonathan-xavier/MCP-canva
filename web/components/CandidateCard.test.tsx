import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CandidateCard } from './CandidateCard';

describe('CandidateCard', () => {
  it('mostra a prévia e envia exatamente o candidato escolhido', () => {
    const onSelect = vi.fn();
    render(
      <CandidateCard
        candidate={{
          candidateId: 'candidate_2',
          previewUrls: ['/api/preview/2'],
          canvaPreviewUrl: 'https://www.canva.com/design/2',
        }}
        index={1}
        disabled={false}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('img', { name: 'Prévia da opção 2' })).toHaveAttribute('src', '/api/preview/2');
    fireEvent.click(screen.getByRole('button', { name: 'Usar este design' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('candidate_2');
  });

  it('não permite selecionar enquanto outra escrita está pendente', () => {
    render(
      <CandidateCard
        candidate={{ candidateId: 'candidate_1', previewUrls: [] }}
        index={0}
        disabled
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Usar este design' })).toBeDisabled();
    expect(screen.getByLabelText('Prévia indisponível para a opção 1')).toBeVisible();
  });

  it('identifica textualmente o candidato que está sendo criado', () => {
    render(
      <CandidateCard
        candidate={{ candidateId: 'candidate_1', previewUrls: [] }}
        index={0}
        disabled
        isCreating
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Criando design' })).toBeDisabled();
  });
});
