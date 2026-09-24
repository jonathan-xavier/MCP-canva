const formatInfo: Record<string, { label: string; size: string }> = {
  instagram_post: { label: 'Post Instagram', size: '1080 × 1350' },
  your_story: { label: 'Story', size: '1080 × 1920' },
  flyer: { label: 'Flyer', size: 'Impressão' },
  poster: { label: 'Pôster', size: 'Grande formato' },
  youtube_thumbnail: { label: 'YouTube', size: 'Thumbnail' },
};

interface FormatSelectorProps {
  formats: string[];
  value: string;
  onChange: (format: string) => void;
}

function formatLabel(value: string): string {
  return formatInfo[value]?.label ?? value.replaceAll('_', ' ');
}

export function FormatSelector({ formats, value, onChange }: FormatSelectorProps) {
  return (
    <fieldset className="format-fieldset">
      <legend>Formato</legend>
      <div className="format-grid">
        {formats.map((format) => {
          const info = formatInfo[format] ?? { label: formatLabel(format), size: 'Canva' };
          const selected = value === format;
          return (
            <label className="format-option" key={format}>
              <input
                type="radio"
                name="designType"
                value={format}
                checked={selected}
                onChange={() => onChange(format)}
              />
              <span className="format-copy">
                <span><strong>{info.label}</strong><small>{info.size}</small></span>
                <span className="format-check" aria-hidden="true">{selected ? '✓' : ''}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
