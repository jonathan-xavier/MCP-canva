import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { CanvaService } from '../canva-service.js';
import type { CanvaCapabilities, CreatedDesign, ExportedDesign, GeneratedCandidates } from '../types.js';
import { CanvaConnectionManager } from './connection-manager.js';
import { ApiError, classifyCanvaError } from './errors.js';
import { GenerationStore } from './generation-store.js';

export interface CanvaWebService {
  capabilities(): Promise<CanvaCapabilities>;
  uploadAsset(url: string, name: string): Promise<string>;
  uploadLocalAsset(bytes: Uint8Array): Promise<string>;
  generateCandidates(brief: string, designType?: string, assetIds?: string[]): Promise<GeneratedCandidates>;
  createFromCandidate(jobId: string, candidateId: string): Promise<CreatedDesign>;
  getDesignText(designId: string): Promise<string>;
  getExportFormats(designId: string): Promise<string[]>;
  exportDesign(designId: string, format: string): Promise<ExportedDesign>;
}

export interface CreateAppOptions {
  getService?: () => Promise<CanvaWebService>;
  store?: GenerationStore;
  close?: () => Promise<void>;
}

const generationIdPattern = /^[a-zA-Z0-9_-]{1,80}$/;
const candidateIdPattern = /^[a-zA-Z0-9_-]{1,120}$/;
const designIdPattern = /^D[a-zA-Z0-9_-]{5,79}$/;
const exportFormats = new Set(['pdf', 'png', 'jpg', 'gif', 'pptx', 'mp4', 'csv']);

function ensureIdentifier(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) throw new ApiError('VALIDATION_ERROR', 400, `${label} inválido.`);
  return value;
}

function allowedCanvaPreview(urlText: string): boolean {
  try {
    const url = new URL(urlText);
    return url.protocol === 'https:' && (
      url.hostname === 'canva.com' ||
      url.hostname.endsWith('.canva.com') ||
      url.hostname === 'canva.ai' ||
      url.hostname.endsWith('.canva.ai')
    );
  } catch {
    return false;
  }
}

function candidateResponse(generationId: string, candidate: GeneratedCandidates['candidates'][number]) {
  return {
    candidateId: candidate.candidateId,
    ...(candidate.url ? { canvaPreviewUrl: candidate.url } : {}),
    previewUrls: candidate.thumbnailUrls.map(
      (_url, index) => `/api/generations/${encodeURIComponent(generationId)}/candidates/${encodeURIComponent(candidate.candidateId)}/preview/${index}`,
    ),
  };
}

function normalizeDesignText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

interface MediaInput {
  imageUrl?: string;
  videoUrl?: string;
  imageAssetId?: string;
  videoAssetId?: string;
  imagePercent?: number;
  orientation?: string;
}

function publicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    return hostname !== 'localhost'
      && hostname !== '::1'
      && !hostname.endsWith('.local')
      && !/^127\./.test(hostname)
      && !/^10\./.test(hostname)
      && !/^192\.168\./.test(hostname)
      && !/^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  } catch {
    return false;
  }
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const manager = options.getService ? undefined : new CanvaConnectionManager();
  const getService = options.getService ?? (() => manager!.getService() as Promise<CanvaService>);
  const store = options.store ?? new GenerationStore();
  const app = Fastify({
    logger: false,
    bodyLimit: 16 * 1024,
    requestTimeout: 150_000,
  });
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

  app.get('/api/health', async () => ({ status: 'ok', version: '1.0.0' }));

  app.get('/api/canva/capabilities', async () => {
    const service = await getService();
    return service.capabilities();
  });

  app.post<{ Querystring: { kind?: string }; Body: Buffer }>(
    '/api/media-uploads',
    { config: { rawBody: true }, bodyLimit: 100 * 1024 * 1024 },
    async (request, reply) => {
      const kind = request.query.kind;
      if (kind !== 'image' && kind !== 'video') {
        throw new ApiError('VALIDATION_ERROR', 400, 'Escolha image ou video para o anexo.');
      }
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        throw new ApiError('VALIDATION_ERROR', 400, 'O arquivo anexado está vazio.');
      }
      const fileType = request.headers['x-file-type'];
      if (typeof fileType !== 'string' || !fileType.toLowerCase().startsWith(`${kind}/`)) {
        throw new ApiError('VALIDATION_ERROR', 400, kind === 'image' ? 'Anexe um arquivo de imagem válido.' : 'Anexe um arquivo de vídeo válido.');
      }
      const maximum = kind === 'image' ? 20 * 1024 * 1024 : 100 * 1024 * 1024;
      if (request.body.length > maximum) {
        throw new ApiError('VALIDATION_ERROR', 413, kind === 'image' ? 'A imagem deve ter no máximo 20 MB.' : 'O vídeo deve ter no máximo 100 MB.');
      }
      const service = await getService();
      const assetId = await service.uploadLocalAsset(request.body);
      return reply.code(201).send({ assetId, kind });
    },
  );

  app.post<{ Body: { brief?: string; designType?: string; exactTexts?: unknown; media?: MediaInput } }>('/api/generations', async (request, reply) => {
    const brief = request.body?.brief?.trim() ?? '';
    const designType = request.body?.designType?.trim() ?? '';
    if (brief.length < 10 || brief.length > 5_000) {
      throw new ApiError('VALIDATION_ERROR', 400, 'O briefing deve ter entre 10 e 5.000 caracteres.');
    }
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(designType)) {
      throw new ApiError('VALIDATION_ERROR', 400, 'Escolha um formato válido.');
    }
    const rawExactTexts = request.body?.exactTexts ?? [];
    if (!Array.isArray(rawExactTexts) || rawExactTexts.length > 3 || rawExactTexts.some(
      (item) => typeof item !== 'string' || item.trim().length === 0 || item.length > 240,
    )) {
      throw new ApiError('VALIDATION_ERROR', 400, 'Os textos exatos informados são inválidos.');
    }
    const exactTexts = rawExactTexts.map((item) => (item as string).trim());
    const media = request.body?.media;
    const assetIdPattern = /^[a-zA-Z0-9_-]{1,80}$/;
    const usesUploadedAssets = Boolean(media?.imageAssetId || media?.videoAssetId);
    if (media && (
      (usesUploadedAssets
        ? !assetIdPattern.test(media.imageAssetId ?? '') || !assetIdPattern.test(media.videoAssetId ?? '')
        : typeof media.imageUrl !== 'string'
          || typeof media.videoUrl !== 'string'
          || !publicHttpsUrl(media.imageUrl)
          || !publicHttpsUrl(media.videoUrl))
      || !Number.isInteger(media.imagePercent)
      || media.imagePercent! < 10
      || media.imagePercent! > 90
      || !['vertical', 'horizontal'].includes(media.orientation ?? '')
    )) {
      throw new ApiError('VALIDATION_ERROR', 400, 'Informe URLs públicas HTTPS e uma divisão válida para imagem e vídeo.');
    }

    const service = await getService();
    const capabilities = await service.capabilities();
    if (capabilities.designTypes.length > 0 && !capabilities.designTypes.includes(designType)) {
      throw new ApiError('VALIDATION_ERROR', 400, 'Esse formato não é aceito pela conexão atual do Canva.');
    }
    const assetIds = media
      ? usesUploadedAssets
        ? [media.imageAssetId!, media.videoAssetId!]
        : [
            await service.uploadAsset(media.imageUrl!, 'Imagem da composição'),
            await service.uploadAsset(media.videoUrl!, 'Vídeo da composição'),
          ]
      : [];
    const generated = await service.generateCandidates(brief, designType, assetIds);
    store.put(generated, exactTexts);
    return reply.code(201).send({
      generationId: generated.jobId,
      candidates: generated.candidates.map((candidate) => candidateResponse(generated.jobId, candidate)),
    });
  });

  app.get<{ Params: { generationId: string; candidateId: string; index: string } }>(
    '/api/generations/:generationId/candidates/:candidateId/preview/:index',
    async (request, reply) => {
      const generationId = ensureIdentifier(request.params.generationId, generationIdPattern, 'Geração');
      const candidateId = ensureIdentifier(request.params.candidateId, candidateIdPattern, 'Candidato');
      const index = Number.parseInt(request.params.index, 10);
      if (!Number.isSafeInteger(index) || index < 0) throw new ApiError('VALIDATION_ERROR', 400, 'Índice de prévia inválido.');
      const candidate = store.getCandidate(generationId, candidateId);
      const previewUrl = candidate.thumbnailUrls[index];
      if (!previewUrl) throw new ApiError('CANDIDATE_NOT_FOUND', 404, 'Prévia não encontrada.');
      if (!allowedCanvaPreview(previewUrl)) throw new ApiError('CANDIDATE_NOT_FOUND', 404, 'Prévia não permitida.');
      return reply.redirect(previewUrl);
    },
  );

  app.post<{ Params: { generationId: string }; Body: { candidateId?: string } }>(
    '/api/generations/:generationId/selection',
    async (request, reply) => {
      const generationId = ensureIdentifier(request.params.generationId, generationIdPattern, 'Geração');
      const candidateId = ensureIdentifier(request.body?.candidateId ?? '', candidateIdPattern, 'Candidato');
      store.claimSelection(generationId, candidateId);
      const exactTexts = store.get(generationId).exactTexts;
      try {
        const service = await getService();
        const design = await service.createFromCandidate(generationId, candidateId);
        store.markSelected(generationId, candidateId, design.id);
        const exportFormats = await service.getExportFormats(design.id).catch(() => []);
        let instructionCheck;
        if (exactTexts.length > 0) {
          try {
            const designText = normalizeDesignText(await service.getDesignText(design.id));
            const items = exactTexts.map((text) => ({
              text,
              found: designText.includes(normalizeDesignText(text)),
            }));
            instructionCheck = {
              status: items.every((item) => item.found) ? 'verified' : 'missing',
              items,
            } as const;
          } catch {
            instructionCheck = {
              status: 'unavailable',
              items: exactTexts.map((text) => ({ text, found: false })),
            } as const;
          }
        }
        return reply.code(201).send({ design, exportFormats, ...(instructionCheck ? { instructionCheck } : {}) });
      } catch (error) {
        store.releaseSelection(generationId);
        throw error;
      }
    },
  );

  app.get<{ Params: { designId: string } }>('/api/designs/:designId/export-formats', async (request) => {
    const designId = ensureIdentifier(request.params.designId, designIdPattern, 'Design');
    const service = await getService();
    return { formats: await service.getExportFormats(designId) };
  });

  app.post<{ Params: { designId: string }; Body: { format?: string } }>(
    '/api/designs/:designId/exports',
    async (request, reply) => {
      const designId = ensureIdentifier(request.params.designId, designIdPattern, 'Design');
      const format = request.body?.format?.toLowerCase() ?? '';
      if (!exportFormats.has(format)) throw new ApiError('VALIDATION_ERROR', 400, 'Formato de exportação inválido.');
      const service = await getService();
      const exported = await service.exportDesign(designId, format);
      return reply.code(201).send({ format, urls: exported.urls, expires: true });
    },
  );

  app.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, _request: FastifyRequest, reply: FastifyReply) => {
    const apiError = error.validation
      ? new ApiError('VALIDATION_ERROR', 400, 'A requisição contém dados inválidos.')
      : error instanceof ApiError
        ? error
        : classifyCanvaError(error);
    void reply.code(apiError.statusCode).send({
      error: { code: apiError.code, message: apiError.message, retryable: apiError.retryable },
    });
  });

  app.addHook('onClose', async () => {
    await options.close?.();
    await manager?.close();
  });

  return app;
}
