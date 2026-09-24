import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvaApi } from './canva-api';

describe('canvaApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia briefing e formato para a rota local de geração', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ generationId: 'job_1', candidates: [] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await canvaApi.generate('Uma campanha de lançamento', 'instagram_post', ['LANÇAMENTO']);

    expect(fetchMock).toHaveBeenCalledWith('/api/generations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ brief: 'Uma campanha de lançamento', designType: 'instagram_post', exactTexts: ['LANÇAMENTO'] }),
    }));
  });

  it('converte o envelope de erro sanitizado em erro de domínio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'CANVA_TIMEOUT', message: 'O Canva demorou mais que o esperado.', retryable: true },
    }), { status: 504, headers: { 'Content-Type': 'application/json' } })));

    await expect(canvaApi.capabilities()).rejects.toEqual(
      expect.objectContaining({ code: 'CANVA_TIMEOUT', retryable: true }),
    );
  });

  it('envia anexo como bytes para a rota local', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ assetId: 'asset_local', kind: 'video' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });

    await canvaApi.uploadMedia(video, 'video');

    expect(fetchMock).toHaveBeenCalledWith('/api/media-uploads?kind=video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Type': 'video/mp4' },
      body: video,
    });
  });
});
