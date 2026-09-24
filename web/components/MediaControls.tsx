import type { MediaComposition } from '../lib/briefing';

interface MediaControlsProps {
  media: MediaComposition;
  disabled: boolean;
  imageFile?: File;
  videoFile?: File;
  onChange: (media: MediaComposition) => void;
  onImageFileChange: (file?: File) => void;
  onVideoFileChange: (file?: File) => void;
}

export function MediaControls({ media, disabled, imageFile, videoFile, onChange, onImageFileChange, onVideoFileChange }: MediaControlsProps) {
  const update = <K extends keyof MediaComposition>(field: K, value: MediaComposition[K]) => {
    onChange({ ...media, [field]: value });
  };

  return (
    <fieldset className="media-controls">
      <label className="media-toggle">
        <input
          type="checkbox"
          checked={media.enabled}
          disabled={disabled}
          onChange={(event) => update('enabled', event.target.checked)}
        />
        <span>Incluir imagem e vídeo</span>
      </label>

      {media.enabled ? (
        <div className="media-fields">
          <div className="media-source" role="group" aria-label="Origem das mídias">
            <button type="button" className={media.source === 'files' ? 'active' : ''} disabled={disabled} onClick={() => update('source', 'files')}>Anexar arquivos</button>
            <button type="button" className={media.source === 'urls' ? 'active' : ''} disabled={disabled} onClick={() => update('source', 'urls')}>Usar URLs</button>
          </div>
          {media.source === 'files' ? (
            <>
              <label className="file-field">
                <span>Imagem <small>até 20 MB</small></span>
                <input type="file" accept="image/*" disabled={disabled} onChange={(event) => onImageFileChange(event.target.files?.[0])} />
                <strong>{imageFile?.name ?? 'Nenhuma imagem selecionada'}</strong>
              </label>
              <label className="file-field">
                <span>Vídeo <small>até 100 MB</small></span>
                <input type="file" accept="video/*" disabled={disabled} onChange={(event) => onVideoFileChange(event.target.files?.[0])} />
                <strong>{videoFile?.name ?? 'Nenhum vídeo selecionado'}</strong>
              </label>
            </>
          ) : (
            <>
              <p>Os arquivos precisam estar em URLs públicas HTTPS.</p>
              <label className="detail-field">
                <span>URL da imagem</span>
                <input type="url" value={media.imageUrl} placeholder="https://.../imagem.jpg" disabled={disabled} onChange={(event) => update('imageUrl', event.target.value)} />
              </label>
              <label className="detail-field">
                <span>URL do vídeo</span>
                <input type="url" value={media.videoUrl} placeholder="https://.../video.mp4" disabled={disabled} onChange={(event) => update('videoUrl', event.target.value)} />
              </label>
            </>
          )}
          <label className="detail-field">
            <span>Divisão do card</span>
            <select value={media.orientation} disabled={disabled} onChange={(event) => update('orientation', event.target.value as MediaComposition['orientation'])}>
              <option value="vertical">Imagem em cima, vídeo embaixo</option>
              <option value="horizontal">Imagem à esquerda, vídeo à direita</option>
            </select>
          </label>
          <label className="media-range">
            <span>Imagem {media.imagePercent}%</span>
            <input type="range" min="10" max="90" step="5" value={media.imagePercent} disabled={disabled} onChange={(event) => update('imagePercent', Number(event.target.value))} />
            <span>Vídeo {100 - media.imagePercent}%</span>
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}
