import type { DesignCandidate, GeneratedCandidates } from '../types.js';
import { ApiError } from './errors.js';

export interface GenerationRecord {
  generationId: string;
  createdAt: number;
  expiresAt: number;
  candidates: DesignCandidate[];
  selectedCandidateId?: string;
  designId?: string;
  selectionInProgress?: boolean;
}

export interface GenerationStoreOptions {
  ttlMs?: number;
  maxRecords?: number;
  now?: () => number;
}

export class GenerationStore {
  private readonly records = new Map<string, GenerationRecord>();
  private readonly ttlMs: number;
  private readonly maxRecords: number;
  private readonly now: () => number;

  constructor(options: GenerationStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1_000;
    this.maxRecords = options.maxRecords ?? 20;
    this.now = options.now ?? Date.now;
  }

  put(generated: GeneratedCandidates): GenerationRecord {
    this.cleanup();
    while (this.records.size >= this.maxRecords) {
      const oldest = [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldest) break;
      this.records.delete(oldest.generationId);
    }

    const createdAt = this.now();
    const record: GenerationRecord = {
      generationId: generated.jobId,
      createdAt,
      expiresAt: createdAt + this.ttlMs,
      candidates: generated.candidates.map((candidate) => ({
        ...candidate,
        thumbnailUrls: [...candidate.thumbnailUrls],
      })),
    };
    this.records.set(record.generationId, record);
    return record;
  }

  get(generationId: string): GenerationRecord {
    this.cleanup();
    const record = this.records.get(generationId);
    if (!record) {
      throw new ApiError('GENERATION_NOT_FOUND', 404, 'Essa geração expirou ou não existe. Gere novas opções.');
    }
    return record;
  }

  getCandidate(generationId: string, candidateId: string): DesignCandidate {
    const candidate = this.get(generationId).candidates.find((item) => item.candidateId === candidateId);
    if (!candidate) {
      throw new ApiError('CANDIDATE_NOT_FOUND', 404, 'Essa opção não pertence à geração informada.');
    }
    return candidate;
  }

  markSelected(generationId: string, candidateId: string, designId: string): void {
    const record = this.get(generationId);
    this.getCandidate(generationId, candidateId);
    record.selectionInProgress = false;
    record.selectedCandidateId = candidateId;
    record.designId = designId;
  }

  claimSelection(generationId: string, candidateId: string): void {
    const record = this.get(generationId);
    this.getCandidate(generationId, candidateId);
    if (record.selectionInProgress || record.designId) {
      throw new ApiError('CANVA_TOOL_ERROR', 409, 'Um design já está sendo criado ou foi criado para esta geração.');
    }
    record.selectionInProgress = true;
  }

  releaseSelection(generationId: string): void {
    const record = this.records.get(generationId);
    if (record) record.selectionInProgress = false;
  }

  private cleanup(): void {
    const current = this.now();
    for (const [id, record] of this.records) {
      if (record.expiresAt <= current) this.records.delete(id);
    }
  }
}
