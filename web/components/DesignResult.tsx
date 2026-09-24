import type { Design, InstructionCheck } from '../lib/types';

interface DesignResultProps {
  design: Design;
  exportFormats: string[];
  downloads: Array<{ format: string; url: string }>;
  instructionCheck?: InstructionCheck;
  exportingFormat?: string;
  disabled: boolean;
  onExport: (format: string) => void;
  onReset: () => void;
}

export function DesignResult({ design, exportFormats, downloads, instructionCheck, exportingFormat, disabled, onExport, onReset }: DesignResultProps) {
  return (
    <div className="result-stage">
      <div className="result-status">
        <span className="result-mark" aria-hidden="true">✓</span>
        <span>Design criado no Canva</span>
      </div>
      <h3>{design.title ?? 'Sua nova campanha'}</h3>
      <p>O design já está salvo na sua conta. Abra no Canva para ajustar detalhes ou exporte por aqui.</p>
      {instructionCheck ? (
        <div className={`instruction-check ${instructionCheck.status}`}>
          <strong>
            {instructionCheck.status === 'verified'
              ? 'Textos obrigatórios confirmados'
              : instructionCheck.status === 'missing'
                ? 'Revise os textos antes de exportar'
                : 'Não foi possível conferir os textos automaticamente'}
          </strong>
          {instructionCheck.status !== 'unavailable' ? (
            <ul>
              {instructionCheck.items.map((item) => (
                <li key={item.text} className={item.found ? 'found' : 'missing'}>
                  <span aria-hidden="true">{item.found ? '✓' : '!'}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Abra o design no Canva e confirme headline, texto de apoio e CTA.</p>
          )}
        </div>
      ) : null}
      <div className="result-actions">
        {design.editUrl ? <a className="primary-link" href={design.editUrl} target="_blank" rel="noreferrer">Editar no Canva ↗</a> : null}
        <button className="secondary-button" type="button" onClick={onReset}>Criar outro</button>
      </div>
      {exportFormats.length > 0 ? (
        <div className="export-area">
          <span className="export-label">Exportar como</span>
          <div className="export-buttons">
            {exportFormats.map((format) => (
              <button key={format} type="button" disabled={disabled} onClick={() => onExport(format)}>
                {exportingFormat === format ? <span className="mini-spinner" aria-hidden="true" /> : null}
                {exportingFormat === format ? `Exportando ${format.toUpperCase()}` : format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {downloads.length > 0 ? (
        <div className="download-list" aria-label="Downloads prontos">
          {downloads.map((download, index) => (
            <a key={`${download.format}-${index}`} href={download.url} target="_blank" rel="noreferrer">
              <span>Baixar {download.format.toUpperCase()}</span>
              <small>link temporário ↗</small>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
