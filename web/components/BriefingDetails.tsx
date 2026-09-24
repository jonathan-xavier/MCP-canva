import type { DesignBrief } from '../lib/briefing';

type BriefField = Exclude<keyof DesignBrief, 'objective'>;

interface BriefingDetailsProps {
  brief: DesignBrief;
  compiledPrompt: string;
  disabled: boolean;
  onChange: (field: BriefField, value: string) => void;
}

const fields: Array<{
  field: BriefField;
  label: string;
  placeholder: string;
  rows?: number;
}> = [
  { field: 'audience', label: 'Público', placeholder: 'Ex.: profissionais de tecnologia de 25 a 40 anos' },
  { field: 'headline', label: 'Headline exata', placeholder: 'Texto que não pode ser reescrito' },
  { field: 'supportingText', label: 'Texto de apoio exato', placeholder: 'Oferta, data ou informação complementar' },
  { field: 'cta', label: 'CTA exato', placeholder: 'Ex.: COMPRE AGORA' },
  { field: 'palette', label: 'Paleta', placeholder: 'Ex.: #000000, #F74D00 e #F9F9F9' },
  { field: 'requiredElements', label: 'Elementos obrigatórios', placeholder: 'Um requisito por linha', rows: 3 },
  { field: 'forbiddenElements', label: 'O que não usar', placeholder: 'Um item proibido por linha', rows: 3 },
  { field: 'revision', label: 'Ajuste desta versão', placeholder: 'Ex.: aumentar o CTA, preservando as demais instruções', rows: 3 },
];

export function BriefingDetails({ brief, compiledPrompt, disabled, onChange }: BriefingDetailsProps) {
  return (
    <>
      <details className="brief-details">
        <summary>Detalhar instruções obrigatórias</summary>
        <div className="brief-details-content">
          <p>Separe o que precisa ser literal. Em uma nova versão, altere somente o campo de ajuste.</p>
          {fields.map(({ field, label, placeholder, rows }) => (
            <label className="detail-field" key={field}>
              <span>{label}</span>
              {rows ? (
                <textarea
                  rows={rows}
                  value={brief[field]}
                  placeholder={placeholder}
                  disabled={disabled}
                  onChange={(event) => onChange(field, event.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={brief[field]}
                  placeholder={placeholder}
                  disabled={disabled}
                  onChange={(event) => onChange(field, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      </details>

      <details className="prompt-preview">
        <summary>Revisar o que será enviado ao Canva</summary>
        <pre>{compiledPrompt}</pre>
      </details>
    </>
  );
}
