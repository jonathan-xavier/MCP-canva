import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, canvaApi } from './canva-api';

describe('canvaApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia briefing e formato para a rota local de geração', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ generationId: 'job_1', candidates: [] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await canvaApi.generate('Uma campanha de lançamento', 'instagram_post');

    expect(fetchMock).toHaveBeenCalledWith('/api/generations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ brief: 'Uma campanha de lançamento', designType: 'instagram_post' }),
    }));
  });

  it('converte o envelope de erro sanitizado em erro de domínio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'CANVA_TIMEOUT', message: 'O Canva demorou mais que o esperado.', retryable: true },
    }), { status: 504, headers: { 'Content-Type': 'application/json' } })));

    await expect(canvaApi.capabilities()).rejects.toEqual(
      expect.objectContaining<ApiRequestError>({ code: 'CANVA_TIMEOUT', retryable: true }),
    );
  });
});
