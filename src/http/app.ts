import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { CanvaService } from '../canva-service.js';
import type { CanvaCapabilities, CreatedDesign, ExportedDesign, GeneratedCandidates } from '../types.js';
import { CanvaConnectionManager } from './connection-manager.js';
import { ApiError, classifyCanvaError } from './errors.js';
import { GenerationStore } from './generation-store.js';

export interface CanvaWebService {
  capabilities(): Promise<CanvaCapabilities>;
  generateCandidates(brief: string, designType?: string): Promise<GeneratedCandidates>;
  createFromCandidate(jobId: string, candidateId: string): Promise<CreatedDesign>;
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

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const manager = options.getService ? undefined : new CanvaConnectionManager();
  const getService = options.getService ?? (() => manager!.getService() as Promise<CanvaService>);
  const store = options.store ?? new GenerationStore();
  const app = Fastify({
    logger: false,
    bodyLimit: 16 * 1024,
    requestTimeout: 150_000,
  });

  app.get('/api/health', async () => ({ status: 'ok', version: '1.0.0' }));

  app.get('/api/canva/capabilities', async () => {
    const service = await getService();
    return service.capabilities();
  });

  app.post<{ Body: { brief?: string; designType?: string } }>('/api/generations', async (request, reply) => {
    const brief = request.body?.brief?.trim() ?? '';
    const designType = request.body?.designType?.trim() ?? '';
    if (brief.length < 10 || brief.length > 5_000) {
      throw new ApiError('VALIDATION_ERROR', 400, 'O briefing deve ter entre 10 e 5.000 caracteres.');
    }
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(designType)) {
      throw new ApiError('VALIDATION_ERROR', 400, 'Escolha um formato válido.');
    }

    const service = await getService();
    const capabilities = await service.capabilities();
    if (capabilities.designTypes.length > 0 && !capabilities.designTypes.includes(designType)) {
      throw new ApiError('VALIDATION_ERROR', 400, 'Esse formato não é aceito pela conexão atual do Canva.');
    }
    const generated = await service.generateCandidates(brief, designType);
    store.put(generated);
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
      try {
        const service = await getService();
        const design = await service.createFromCandidate(generationId, candidateId);
        store.markSelected(generationId, candidateId, design.id);
        const exportFormats = await service.getExportFormats(design.id).catch(() => []);
        return reply.code(201).send({ design, exportFormats });
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
