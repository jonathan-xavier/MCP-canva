export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'GENERATION_NOT_FOUND'
  | 'CANDIDATE_NOT_FOUND'
  | 'CANVA_AUTH_REQUIRED'
  | 'CANVA_PERMISSION_DENIED'
  | 'CANVA_TOOL_UNAVAILABLE'
  | 'CANVA_RATE_LIMITED'
  | 'CANVA_TIMEOUT'
  | 'CANVA_TOOL_ERROR'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function classifyCanvaError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const detail = error instanceof Error ? error.message.toLowerCase() : '';

  if (detail.includes('timeout') || detail.includes('timed out')) {
    return new ApiError('CANVA_TIMEOUT', 504, 'O Canva demorou mais que o esperado. Tente novamente.', true);
  }
  if (detail.includes('rate limit') || detail.includes('too many requests')) {
    return new ApiError('CANVA_RATE_LIMITED', 429, 'O limite temporário do Canva foi atingido. Aguarde um pouco.', true);
  }
  if (detail.includes('permission') || detail.includes('missing scopes') || detail.includes('license_required')) {
    return new ApiError('CANVA_PERMISSION_DENIED', 403, 'Sua conta ou plano do Canva não permite esta ação.');
  }
  if (detail.includes('authentication') || detail.includes('unauthorized') || detail.includes('oauth')) {
    return new ApiError('CANVA_AUTH_REQUIRED', 401, 'Autorize sua conta do Canva no navegador e tente novamente.', true);
  }
  if (detail.includes('não foi anunciada') || detail.includes('tool') && detail.includes('unavailable')) {
    return new ApiError('CANVA_TOOL_UNAVAILABLE', 409, 'Este recurso não está disponível na conexão atual do Canva.');
  }
  return new ApiError('CANVA_TOOL_ERROR', 502, 'Não foi possível concluir a ação no Canva.', true);
}
