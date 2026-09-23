'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CandidateCard } from '../components/CandidateCard';
import { ApiRequestError, canvaApi } from '../lib/canva-api';
import type { Capabilities, Design, GenerationResponse } from '../lib/types';

const defaultBrief = 'Crie um post vertical anunciando 30% de desconto na Semana da Tecnologia. Use azul-marinho, branco e amarelo, com visual moderno e CTA “Compre agora”.';

const formatInfo: Record<string, { label: string; size: string }> = {
  instagram_post: { label: 'Post Instagram', size: '1080 × 1350' },
  your_story: { label: 'Story', size: '1080 × 1920' },
  flyer: { label: 'Flyer', size: 'Impressão' },
  poster: { label: 'Pôster', size: 'Grande formato' },
  youtube_thumbnail: { label: 'YouTube', size: 'Thumbnail' },
};

type BusyState = 'connecting' | 'generating' | 'creating' | 'exporting' | null;

function formatLabel(value: string): string {
  return formatInfo[value]?.label ?? value.replaceAll('_', ' ');
}

export default function Home() {
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [brief, setBrief] = useState(defaultBrief);
  const [designType, setDesignType] = useState('instagram_post');
  const [generation, setGeneration] = useState<GenerationResponse>();
  const [design, setDesign] = useState<Design>();
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<Array<{ format: string; url: string }>>([]);
  const [busy, setBusy] = useState<BusyState>('connecting');
  const [error, setError] = useState<string>();

  const connect = useCallback(async () => {
    setBusy('connecting');
    setError(undefined);
    try {
      const result = await canvaApi.capabilities();
      setCapabilities(result);
      if (result.designTypes.length > 0 && !result.designTypes.includes(designType)) {
        setDesignType(result.designTypes.includes('instagram_post') ? 'instagram_post' : result.designTypes[0]!);
      }
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : 'Não foi possível conectar ao Canva.');
    } finally {
      setBusy(null);
    }
  }, [designType]);

  useEffect(() => {
    const timer = window.setTimeout(() => void connect(), 0);
    // A primeira conexão pode abrir o fluxo OAuth do Canva.
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleFormats = useMemo(() => {
    const available = capabilities?.designTypes ?? [];
    const preferred = Object.keys(formatInfo).filter((format) => available.length === 0 || available.includes(format));
    return preferred.length > 0 ? preferred : available.slice(0, 5);
  }, [capabilities]);

  const currentStep = design ? 3 : generation ? 2 : 1;
  const status = busy === 'connecting'
    ? 'Aguardando Canva'
    : capabilities?.connected
      ? 'Canva conectado'
      : error
        ? 'Conexão pendente'
        : 'Pronto para conectar';

  const statusMessage = busy === 'connecting'
    ? 'Autorize sua conta na janela do Canva, caso ela tenha sido aberta.'
    : busy === 'generating'
      ? 'O Canva está preparando caminhos visuais. Isso pode levar até dois minutos.'
      : busy === 'creating'
        ? 'Transformando sua escolha em um design editável.'
        : busy === 'exporting'
          ? 'Preparando o arquivo para download.'
          : undefined;

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (brief.trim().length < 10 || busy) return;
    setBusy('generating');
    setError(undefined);
    setGeneration(undefined);
    setDesign(undefined);
    setDownloads([]);
    try {
      setGeneration(await canvaApi.generate(brief.trim(), designType));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar opções.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSelect(candidateId: string) {
    if (!generation || busy) return;
    setBusy('creating');
    setError(undefined);
    try {
      const result = await canvaApi.select(generation.generationId, candidateId);
      setDesign(result.design);
      setExportFormats(result.exportFormats);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'Não foi possível criar o design.');
    } finally {
      setBusy(null);
    }
  }

  async function handleExport(format: string) {
    if (!design || busy) return;
    setBusy('exporting');
    setError(undefined);
    try {
      const result = await canvaApi.export(design.id, format);
      setDownloads((current) => [
        ...current.filter((item) => item.format !== format),
        ...result.urls.map((url) => ({ format, url })),
      ]);
    } catch (exportError) {
      const message = exportError instanceof ApiRequestError ? exportError.message : 'Não foi possível exportar o design.';
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  function resetProject() {
    setGeneration(undefined);
    setDesign(undefined);
    setDownloads([]);
    setError(undefined);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Ateliê Canva, início">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Ateliê Canva</span>
        </a>
        <button className="connection-pill" type="button" onClick={() => void connect()} disabled={busy !== null}>
          <span className={`status-dot ${capabilities?.connected ? 'connected' : error ? 'error' : ''}`} aria-hidden="true" />
          {status}
        </button>
      </header>

      <section className="workspace" id="top">
        <aside className="brief-panel" aria-labelledby="brief-title">
          <div className="eyebrow">Novo projeto</div>
          <h1 id="brief-title">Transforme uma ideia em campanha.</h1>
          <p className="intro">Descreva o que precisa. O Canva cria as opções e você decide qual vira design.</p>

          <form className="brief-form" onSubmit={handleGenerate}>
            <label htmlFor="brief">O que vamos criar?</label>
            <textarea
              id="brief"
              name="brief"
              rows={7}
              maxLength={5_000}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              aria-describedby="brief-help"
            />
            <div className="field-meta" id="brief-help">
              <span>Inclua texto, cores, público e objetivo</span>
              <span>{brief.length.toLocaleString('pt-BR')} / 5.000</span>
            </div>

            <fieldset>
              <legend>Formato</legend>
              <div className="format-grid">
                {visibleFormats.map((format) => {
                  const info = formatInfo[format] ?? { label: formatLabel(format), size: 'Canva' };
                  return (
                    <label className="format-option" key={format}>
                      <input
                        type="radio"
                        name="designType"
                        value={format}
                        checked={designType === format}
                        onChange={() => setDesignType(format)}
                      />
                      <span className="format-copy"><strong>{info.label}</strong><small>{info.size}</small></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button
              className="primary-button"
              type="submit"
              disabled={!capabilities?.connected || brief.trim().length < 10 || busy !== null}
            >
              <span>{busy === 'generating' ? 'Criando opções…' : 'Gerar opções'}</span>
              <span aria-hidden="true">↗</span>
            </button>
            <p className="privacy-note">Sua autenticação permanece neste computador.</p>
          </form>

          {error ? (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {!capabilities?.connected && <button type="button" onClick={() => void connect()}>Tentar conexão</button>}
            </div>
          ) : null}
        </aside>

        <section className="preview-panel" aria-labelledby="preview-title">
          <div className="preview-heading">
            <div>
              <div className="eyebrow">Direção criativa</div>
              <h2 id="preview-title">
                {design ? 'Seu design está pronto' : generation ? 'Escolha seu caminho favorito' : 'Suas opções aparecem aqui'}
              </h2>
            </div>
            <span className="step-badge">{currentStep} de 3</span>
          </div>

          <div className="live-region" aria-live="polite" aria-atomic="true">
            {statusMessage ? <div className="working-banner"><span className="working-orbit" aria-hidden="true" />{statusMessage}</div> : null}
          </div>

          {design ? (
            <div className="result-stage">
              <div className="result-mark" aria-hidden="true">✓</div>
              <div className="eyebrow">Design criado no Canva</div>
              <h3>{design.title ?? 'Sua nova campanha'}</h3>
              <p>O design já está salvo na sua conta. Abra no Canva para ajustar detalhes ou exporte daqui.</p>
              <div className="result-actions">
                {design.editUrl ? <a className="primary-link" href={design.editUrl} target="_blank" rel="noreferrer">Editar no Canva ↗</a> : null}
                <button className="secondary-button" type="button" onClick={resetProject}>Criar outro</button>
              </div>
              {exportFormats.length > 0 ? (
                <div className="export-area">
                  <span className="export-label">Exportar como</span>
                  <div className="export-buttons">
                    {exportFormats.map((format) => (
                      <button key={format} type="button" disabled={busy !== null} onClick={() => void handleExport(format)}>
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {downloads.length > 0 ? (
                <div className="download-list" aria-label="Downloads prontos">
                  {downloads.map((download, index) => (
                    <a key={`${download.format}-${index}`} href={download.url} target="_blank" rel="noreferrer">
                      Baixar {download.format.toUpperCase()} <span>link temporário ↗</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : generation ? (
            <div className="candidate-grid">
              {generation.candidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate.candidateId}
                  candidate={candidate}
                  index={index}
                  disabled={busy !== null}
                  onSelect={(candidateId) => void handleSelect(candidateId)}
                />
              ))}
            </div>
          ) : (
            <div className="preview-stage">
              <div className="poster-ghost" aria-hidden="true">
                <span className="ghost-kicker">Semana</span><span className="ghost-title">Tecnologia</span>
                <span className="ghost-discount">30%</span><span className="ghost-line" /><span className="ghost-button">Compre agora</span>
              </div>
              <div className="empty-copy"><span className="spark" aria-hidden="true">✦</span><p>Você verá diferentes caminhos visuais antes de criar o design definitivo.</p></div>
            </div>
          )}

          <div className="process-strip" aria-label="Etapas do processo">
            <div className={`process-item ${currentStep >= 1 ? 'active' : ''}`}><span>01</span><strong>Briefing</strong></div>
            <div className={`process-item ${currentStep >= 2 ? 'active' : ''}`}><span>02</span><strong>Escolha</strong></div>
            <div className={`process-item ${currentStep >= 3 ? 'active' : ''}`}><span>03</span><strong>Exporte</strong></div>
          </div>
        </section>
      </section>
    </main>
  );
}
