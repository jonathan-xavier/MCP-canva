import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canvaApi } from '../lib/canva-api';
import Home from './page';

vi.mock('../lib/canva-api', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  canvaApi: {
    capabilities: vi.fn(),
    uploadMedia: vi.fn(),
    generate: vi.fn(),
    select: vi.fn(),
    export: vi.fn(),
  },
}));

const mockedApi = vi.mocked(canvaApi);

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.capabilities.mockResolvedValue({
      connected: true,
      generationTool: 'generate-design',
      designTypes: ['instagram_post'],
      canExport: true,
    });
  });

  it('apresenta os candidatos sem criar um design automaticamente', async () => {
    mockedApi.generate.mockResolvedValue({
      generationId: 'job_1',
      candidates: [{ candidateId: 'candidate_1', previewUrls: [] }],
    });
    render(<Home />);

    await screen.findByText('Canva conectado');
    fireEvent.click(screen.getByRole('button', { name: 'Gerar opções' }));

    await screen.findByText('Opção 1');
    expect(mockedApi.generate).toHaveBeenCalledWith(
      expect.stringContaining('TEXTO EXATO — COPIAR SEM REESCREVER'),
      'instagram_post',
      ['SEMANA DA TECNOLOGIA', '30% DE DESCONTO', 'COMPRE AGORA'],
      undefined,
    );
    expect(mockedApi.select).not.toHaveBeenCalled();
    expect(screen.getByText('Escolha seu caminho favorito')).toBeVisible();
  });

  it('mantém o briefing completo ao aplicar um ajuste de versão', async () => {
    mockedApi.generate.mockResolvedValue({ generationId: 'job_2', candidates: [] });
    render(<Home />);

    await screen.findByText('Canva conectado');
    fireEvent.click(screen.getByText('Detalhar instruções obrigatórias'));
    fireEvent.change(screen.getByLabelText('Ajuste desta versão'), {
      target: { value: 'Aumentar o CTA sem trocar os demais textos.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar opções' }));

    await waitFor(() => expect(mockedApi.generate).toHaveBeenCalled());
    const sentPrompt = mockedApi.generate.mock.calls[0]?.[0] ?? '';
    expect(sentPrompt).toContain('HEADLINE: “SEMANA DA TECNOLOGIA”');
    expect(sentPrompt).toContain('CTA: “COMPRE AGORA”');
    expect(sentPrompt).toContain('Aumentar o CTA sem trocar os demais textos.');
  });

  it('envia imagem e vídeo com a divisão escolhida', async () => {
    mockedApi.generate.mockResolvedValue({ generationId: 'job_media', candidates: [] });
    mockedApi.uploadMedia
      .mockResolvedValueOnce({ assetId: 'asset_image', kind: 'image' })
      .mockResolvedValueOnce({ assetId: 'asset_video', kind: 'video' });
    render(<Home />);

    await screen.findByText('Canva conectado');
    fireEvent.click(screen.getByLabelText('Incluir imagem e vídeo'));
    const image = new File(['image'], 'imagem.jpg', { type: 'image/jpeg' });
    const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText(/Imagem até 20 MB/), { target: { files: [image] } });
    fireEvent.change(screen.getByLabelText(/Vídeo até 100 MB/), { target: { files: [video] } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar opções' }));

    await waitFor(() => expect(mockedApi.generate).toHaveBeenCalled());
    expect(mockedApi.uploadMedia).toHaveBeenNthCalledWith(1, image, 'image');
    expect(mockedApi.uploadMedia).toHaveBeenNthCalledWith(2, video, 'video');
    expect(mockedApi.generate).toHaveBeenCalledWith(
      expect.stringContaining('imagem e fazê-lo ocupar exatamente 30%'),
      'instagram_post',
      expect.any(Array),
      expect.objectContaining({ imageAssetId: 'asset_image', videoAssetId: 'asset_video', imagePercent: 30 }),
    );
  });

  it('preserva o briefing quando a geração falha', async () => {
    mockedApi.generate.mockRejectedValue(new Error('Falha controlada'));
    render(<Home />);

    await screen.findByText('Canva conectado');
    const brief = screen.getByLabelText('O que vamos criar?');
    fireEvent.change(brief, { target: { value: 'Briefing de campanha que deve permanecer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar opções' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Falha controlada'));
    expect(brief).toHaveValue('Briefing de campanha que deve permanecer');
  });
});
