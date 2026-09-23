import type { ApiErrorBody, Capabilities, ExportResponse, GenerationResponse, SelectionResponse } from './types';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code = 'UNKNOWN_ERROR',
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new ApiRequestError(
      body.error?.message ?? 'Não foi possível concluir a solicitação.',
      body.error?.code,
      body.error?.retryable,
    );
  }
  return response.json() as Promise<T>;
}

export const canvaApi = {
  capabilities: (): Promise<Capabilities> => request('/api/canva/capabilities'),
  generate: (brief: string, designType: string): Promise<GenerationResponse> =>
    request('/api/generations', {
      method: 'POST',
      body: JSON.stringify({ brief, designType }),
    }),
  select: (generationId: string, candidateId: string): Promise<SelectionResponse> =>
    request(`/api/generations/${encodeURIComponent(generationId)}/selection`, {
      method: 'POST',
      body: JSON.stringify({ candidateId }),
    }),
  export: (designId: string, format: string): Promise<ExportResponse> =>
    request(`/api/designs/${encodeURIComponent(designId)}/exports`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    }),
};
