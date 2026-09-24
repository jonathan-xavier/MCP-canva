'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BriefingDetails } from '../components/BriefingDetails';
import { CandidateCard } from '../components/CandidateCard';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { DesignResult } from '../components/DesignResult';
import { EmptyState } from '../components/EmptyState';
import { FeedbackBanner } from '../components/FeedbackBanner';
import { FormatSelector } from '../components/FormatSelector';
import { MediaControls } from '../components/MediaControls';
import { ProcessStepper } from '../components/ProcessStepper';
import { ApiRequestError, canvaApi } from '../lib/canva-api';
import { compileDesignBrief, exactTextRequirements, hasEnoughBriefing, validMediaComposition, type DesignBrief, type MediaComposition } from '../lib/briefing';
import type { Capabilities, Design, GenerationResponse, InstructionCheck, MediaGenerationInput } from '../lib/types';

const defaultBrief: DesignBrief = {
  objective: 'Anunciar 30% de desconto na Semana da Tecnologia com visual moderno, direto e promocional.',
  audience: 'Pessoas interessadas em tecnologia e ofertas online.',
  headline: 'SEMANA DA TECNOLOGIA',
  supportingText: '30% DE DESCONTO',
  cta: 'COMPRE AGORA',
  palette: 'Azul-marinho, branco e amarelo.',
  requiredElements: 'Dar maior destaque visual ao desconto\nManter o CTA completamente legível',
  forbiddenElements: 'Não inventar preços, datas ou condições\nNão acrescentar textos que não foram solicitados',
  revision: '',
};
const preferredFormats = ['instagram_post', 'your_story', 'flyer', 'poster', 'youtube_thumbnail'];
const defaultMedia: MediaComposition = {
  enabled: false,
  source: 'files',
  imageUrl: '',
  videoUrl: '',
  imagePercent: 30,
  orientation: 'vertical',
};

type BusyState = 'connecting' | 'uploading' | 'generating' | 'creating' | 'exporting' | null;

export default function Home() {
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [brief, setBrief] = useState<DesignBrief>(defaultBrief);
  const [media, setMedia] = useState<MediaComposition>(defaultMedia);
  const [imageFile, setImageFile] = useState<File>();
  const [videoFile, setVideoFile] = useState<File>();
  const [designType, setDesignType] = useState('instagram_post');
  const [generation, setGeneration] = useState<GenerationResponse>();
  const [design, setDesign] = useState<Design>();
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const [instructionCheck, setInstructionCheck] = useState<InstructionCheck>();
  const [downloads, setDownloads] = useState<Array<{ format: string; url: string }>>([]);
  const [busy, setBusy] = useState<BusyState>('connecting');
  const [creatingCandidateId, setCreatingCandidateId] = useState<string>();
  const [exportingFormat, setExportingFormat] = useState<string>();
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
    return () => window.clearTimeout(timer);
    // A primeira conexão pode abrir o fluxo OAuth do Canva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleFormats = useMemo(() => {
    const available = capabilities?.designTypes ?? [];
    const preferred = preferredFormats.filter((format) => available.length === 0 || available.includes(format));
    return preferred.length > 0 ? preferred : available.slice(0, 5);
  }, [capabilities]);

  const compiledPrompt = useMemo(() => compileDesignBrief(brief, designType, media), [brief, designType, media]);
  const validAttachments = media.source !== 'files' || Boolean(
    imageFile
    && videoFile
    && imageFile.type.startsWith('image/')
    && videoFile.type.startsWith('video/')
    && imageFile.size <= 20 * 1024 * 1024
    && videoFile.size <= 100 * 1024 * 1024,
  );
  const validBrief = hasEnoughBriefing(brief) && validMediaComposition(media) && (!media.enabled || validAttachments) && compiledPrompt.length <= 5_000;

  const currentStep = design ? 3 : generation ? 2 : 1;
  const statusMessage = busy === 'connecting'
    ? 'Autorize sua conta na janela do Canva, caso ela tenha sido aberta.'
    : busy === 'uploading'
      ? 'Enviando a imagem e o vídeo para sua biblioteca do Canva.'
    : busy === 'generating'
      ? 'O Canva está preparando caminhos visuais. Isso pode levar até dois minutos.'
      : busy === 'creating'
        ? 'Transformando sua escolha em um design editável.'
        : busy === 'exporting'
          ? `Preparando ${exportingFormat?.toUpperCase() ?? 'o arquivo'} para download.`
          : undefined;

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validBrief || busy) return;
    setBusy(media.enabled && media.source === 'files' ? 'uploading' : 'generating');
    setError(undefined);
    setGeneration(undefined);
    setDesign(undefined);
    setInstructionCheck(undefined);
    setDownloads([]);
    try {
      let mediaInput: MediaGenerationInput | undefined = media.enabled ? media : undefined;
      if (media.enabled && media.source === 'files' && imageFile && videoFile) {
        const [imageUpload, videoUpload] = await Promise.all([
          canvaApi.uploadMedia(imageFile, 'image'),
          canvaApi.uploadMedia(videoFile, 'video'),
        ]);
        mediaInput = {
          ...media,
          imageAssetId: imageUpload.assetId,
          videoAssetId: videoUpload.assetId,
        };
        setBusy('generating');
      }
      setGeneration(await canvaApi.generate(
        compiledPrompt,
        designType,
        exactTextRequirements(brief),
        mediaInput,
      ));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar opções.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSelect(candidateId: string) {
    if (!generation || busy) return;
    setBusy('creating');
    setCreatingCandidateId(candidateId);
    setError(undefined);
    try {
      const result = await canvaApi.select(generation.generationId, candidateId);
      setDesign(result.design);
      setExportFormats(result.exportFormats);
      setInstructionCheck(result.instructionCheck);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'Não foi possível criar o design.');
    } finally {
      setBusy(null);
      setCreatingCandidateId(undefined);
    }
  }

  async function handleExport(format: string) {
    if (!design || busy) return;
    setBusy('exporting');
    setExportingFormat(format);
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
      setExportingFormat(undefined);
    }
  }

  function resetProject() {
    setGeneration(undefined);
    setDesign(undefined);
    setDownloads([]);
    setExportFormats([]);
    setInstructionCheck(undefined);
    setError(undefined);
  }

  function updateBrief<K extends keyof DesignBrief>(field: K, value: DesignBrief[K]) {
    setBrief((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <a className="brand" href="#top" aria-label="Ateliê Canva, início">
          <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          <span>Ateliê<span className="brand-dot">.</span></span>
        </a>
        <nav className="sidebar-nav">
          <a className="active" href="#top"><span className="nav-icon" aria-hidden="true">⌂</span><span>Visão geral</span></a>
          <a href="#brief-title"><span className="nav-icon" aria-hidden="true">✎</span><span>Briefing</span></a>
          <a href="#preview-title"><span className="nav-icon" aria-hidden="true">◇</span><span>Opções</span></a>
          <a href="#preview-title"><span className="nav-icon" aria-hidden="true">⇩</span><span>Exportações</span></a>
        </nav>
        <div className="sidebar-note">
          <span aria-hidden="true">i</span>
          <p>Crie, compare e exporte sem sair do seu fluxo.</p>
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <a className="mobile-brand" href="#top" aria-label="Ateliê Canva, início">
            <span className="brand-mark" aria-hidden="true"><span>✦</span></span>
          </a>
          <div className="topbar-title">
            <span>Estúdio criativo</span>
            <strong>Visão geral</strong>
          </div>
          <div className="topbar-actions">
            <div className="topbar-context" aria-label="Contexto atual">
              <span aria-hidden="true">⌕</span>
              <span>Campanha social</span>
            </div>
            <ConnectionStatus
              connected={Boolean(capabilities?.connected)}
              connecting={busy === 'connecting'}
              hasError={Boolean(error)}
              disabled={busy !== null}
              onReconnect={() => void connect()}
            />
          </div>
        </header>

        <div className="workspace-wrap">
        <section className="workspace" id="top">
          <aside className="brief-panel" aria-labelledby="brief-title">
            <span className="section-label">Novo projeto</span>
            <h1 id="brief-title">Transforme uma ideia em campanha.</h1>
            <p className="intro">Descreva o que precisa. O Canva cria as opções e você decide qual vira design.</p>

            <form className="brief-form" onSubmit={handleGenerate}>
              <label htmlFor="brief">O que vamos criar?</label>
              <textarea
                id="brief"
                name="brief"
                rows={7}
                minLength={10}
                maxLength={2_400}
                value={brief.objective}
                onChange={(event) => updateBrief('objective', event.target.value)}
                aria-describedby="brief-help"
              />
              <div className="field-meta" id="brief-help">
                <span>Descreva o objetivo e a direção visual</span>
                <span>{brief.objective.length.toLocaleString('pt-BR')} / 2.400</span>
              </div>

              <FormatSelector formats={visibleFormats} value={designType} onChange={setDesignType} />

              <MediaControls
                media={media}
                disabled={busy !== null}
                imageFile={imageFile}
                videoFile={videoFile}
                onChange={setMedia}
                onImageFileChange={setImageFile}
                onVideoFileChange={setVideoFile}
              />

              <BriefingDetails
                brief={brief}
                compiledPrompt={compiledPrompt}
                disabled={busy !== null}
                onChange={(field, value) => updateBrief(field, value)}
              />

              {compiledPrompt.length > 5_000 ? (
                <p className="prompt-limit" role="alert">
                  O briefing compilado tem {compiledPrompt.length.toLocaleString('pt-BR')} caracteres. Reduza para no máximo 5.000.
                </p>
              ) : null}

              <button
                className="primary-button"
                type="submit"
                disabled={!capabilities?.connected || !validBrief || busy !== null}
              >
                {busy === 'generating' || busy === 'uploading' ? <span className="mini-spinner" aria-hidden="true" /> : null}
                <span>{busy === 'uploading' ? 'Enviando mídias' : busy === 'generating' ? 'Gerando opções' : 'Gerar opções'}</span>
                {busy !== 'generating' && busy !== 'uploading' ? <span aria-hidden="true">↗</span> : null}
              </button>
              <p className="privacy-note">Sua autenticação permanece neste computador.</p>
            </form>

            {error ? (
              <FeedbackBanner
                kind="error"
                message={error}
                actionLabel={!capabilities?.connected ? 'Tentar conexão' : undefined}
                onAction={!capabilities?.connected ? () => void connect() : undefined}
              />
            ) : null}
          </aside>

          <section
            className="preview-panel"
            aria-labelledby="preview-title"
            aria-busy={busy === 'uploading' || busy === 'generating' || busy === 'creating' || busy === 'exporting'}
          >
            <div className="preview-heading">
              <div>
                <span className="section-label">Direção criativa</span>
                <h2 id="preview-title">
                  {design ? 'Seu design está pronto' : generation ? 'Escolha seu caminho favorito' : 'Crie com direção'}
                </h2>
              </div>
            </div>

            <ProcessStepper currentStep={currentStep} />
            {statusMessage ? <FeedbackBanner kind="working" message={statusMessage} /> : null}

            <div className="preview-content">
              {design ? (
                <DesignResult
                  design={design}
                  exportFormats={exportFormats}
                  downloads={downloads}
                  instructionCheck={instructionCheck}
                  exportingFormat={exportingFormat}
                  disabled={busy !== null}
                  onExport={(format) => void handleExport(format)}
                  onReset={resetProject}
                />
              ) : generation ? (
                <div className="candidate-grid">
                  {generation.candidates.map((candidate, index) => (
                    <CandidateCard
                      key={candidate.candidateId}
                      candidate={candidate}
                      index={index}
                      disabled={busy !== null}
                      isCreating={creatingCandidateId === candidate.candidateId}
                      onSelect={(candidateId) => void handleSelect(candidateId)}
                    />
                  ))}
                </div>
              ) : <EmptyState />}
            </div>
          </section>
        </section>
        </div>
      </div>
    </main>
  );
}
