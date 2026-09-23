'use client';

import { useState } from 'react';
import type { Candidate } from '../lib/types';

interface CandidateCardProps {
  candidate: Candidate;
  index: number;
  disabled: boolean;
  onSelect: (candidateId: string) => void;
}

export function CandidateCard({ candidate, index, disabled, onSelect }: CandidateCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = candidate.previewUrls[0];

  return (
    <article className="candidate-card">
      <div className="candidate-image-wrap">
        {preview && !imageFailed ? (
          // A URL passa pela allowlist da API local; não usamos o otimizador remoto do Next.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="candidate-image"
            src={preview}
            alt={`Prévia da opção ${index + 1}`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="candidate-fallback" aria-label={`Prévia indisponível para a opção ${index + 1}`}>
            <span>Opção {index + 1}</span>
          </div>
        )}
        <span className="candidate-number">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="candidate-actions">
        {candidate.canvaPreviewUrl ? (
          <a href={candidate.canvaPreviewUrl} target="_blank" rel="noreferrer">Ver maior ↗</a>
        ) : <span />}
        <button type="button" disabled={disabled} onClick={() => onSelect(candidate.candidateId)}>
          Usar este design
        </button>
      </div>
    </article>
  );
}
