import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, type CanvaWebService } from '../../src/http/app.js';

function fakeService(): CanvaWebService {
  return {
    async capabilities() {
      return { connected: true, generationTool: 'generate-design', designTypes: ['instagram_post'], canExport: true };
    },
    async uploadAsset(_url, name) {
      return name.startsWith('Imagem') ? 'asset_image' : 'asset_video';
    },
    async uploadLocalAsset() {
      return 'asset_local';
    },
    async generateCandidates() {
      return {
        jobId: 'job_1',
        candidates: [{
          candidateId: 'candidate_1',
          url: 'https://www.canva.com/design/preview',
          thumbnailUrls: ['https://media.canva.com/preview.png'],
        }],
        raw: {},
      };
    },
    async createFromCandidate() {
      return { id: 'D1234567890', title: 'Campanha', editUrl: 'https://www.canva.com/design/edit', raw: {} };
    },
    async getDesignText() {
      return 'SEMANA DA TECNOLOGIA\n30% DE DESCONTO\nCOMPRE AGORA';
    },
    async getExportFormats() {
      return ['png', 'pdf'];
    },
    async exportDesign() {
      return { jobId: 'export_1', urls: ['https://export-download.canva.com/banner.png'], raw: {} };
    },
  };
}

test('API executa geração, escolha explícita e exportação sem expor URLs arbitrárias', async (t) => {
  let serviceCalls = 0;
  const service = fakeService();
  const app = createApp({ getService: async () => { serviceCalls += 1; return service; } });
  t.after(() => app.close());

  const health = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(serviceCalls, 0, 'health check não deve iniciar OAuth');

  const generated = await app.inject({
    method: 'POST',
    url: '/api/generations',
    payload: {
      brief: 'Campanha de tecnologia moderna',
      designType: 'instagram_post',
      exactTexts: ['SEMANA DA TECNOLOGIA', 'COMPRE AGORA'],
    },
  });
  assert.equal(generated.statusCode, 201);
  const generationBody = generated.json();
  assert.equal(generationBody.generationId, 'job_1');
  assert.deepEqual(generationBody.candidates[0].previewUrls, ['/api/generations/job_1/candidates/candidate_1/preview/0']);

  const preview = await app.inject({ method: 'GET', url: generationBody.candidates[0].previewUrls[0] });
  assert.equal(preview.statusCode, 302);
  assert.equal(preview.headers.location, 'https://media.canva.com/preview.png');

  const mismatch = await app.inject({
    method: 'POST',
    url: '/api/generations/job_1/selection',
    payload: { candidateId: 'candidate_other' },
  });
  assert.equal(mismatch.statusCode, 404);

  const selected = await app.inject({
    method: 'POST',
    url: '/api/generations/job_1/selection',
    payload: { candidateId: 'candidate_1' },
  });
  assert.equal(selected.statusCode, 201);
  assert.deepEqual(selected.json().exportFormats, ['png', 'pdf']);
  assert.deepEqual(selected.json().instructionCheck, {
    status: 'verified',
    items: [
      { text: 'SEMANA DA TECNOLOGIA', found: true },
      { text: 'COMPRE AGORA', found: true },
    ],
  });

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/generations/job_1/selection',
    payload: { candidateId: 'candidate_1' },
  });
  assert.equal(duplicate.statusCode, 409);

  const exported = await app.inject({
    method: 'POST',
    url: '/api/designs/D1234567890/exports',
    payload: { format: 'png' },
  });
  assert.equal(exported.statusCode, 201);
  assert.equal(exported.json().expires, true);
});

test('API valida entrada e sanitiza erros internos do Canva', async (t) => {
  const service = fakeService();
  service.generateCandidates = async () => { throw new Error('token-secreto resposta MCP bruta'); };
  const app = createApp({ getService: async () => service });
  t.after(() => app.close());

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/generations',
    payload: { brief: 'curto', designType: 'instagram_post' },
  });
  assert.equal(invalid.statusCode, 400);

  const invalidExactTexts = await app.inject({
    method: 'POST',
    url: '/api/generations',
    payload: { brief: 'Briefing válido para testar textos', designType: 'instagram_post', exactTexts: [''] },
  });
  assert.equal(invalidExactTexts.statusCode, 400);

  const failed = await app.inject({
    method: 'POST',
    url: '/api/generations',
    payload: { brief: 'Briefing válido para provocar falha', designType: 'instagram_post' },
  });
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.body.includes('token-secreto'), false);
  assert.equal(failed.json().error.code, 'CANVA_TOOL_ERROR');
});

test('API importa imagem e vídeo na ordem e envia os assets para a geração', async (t) => {
  const service = fakeService();
  const uploads: string[] = [];
  let generatedAssetIds: string[] | undefined;
  service.uploadAsset = async (url) => {
    uploads.push(url);
    return url.endsWith('.jpg') ? 'asset_image' : 'asset_video';
  };
  service.generateCandidates = async (_brief, _designType, assetIds) => {
    generatedAssetIds = assetIds;
    return {
      jobId: 'job_media',
      candidates: [{ candidateId: 'candidate_media', thumbnailUrls: [] }],
      raw: {},
    };
  };
  const app = createApp({ getService: async () => service });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/generations',
    payload: {
      brief: 'Crie um post usando obrigatoriamente as duas mídias fornecidas.',
      designType: 'instagram_post',
      media: {
        imageUrl: 'https://cdn.test/image.jpg',
        videoUrl: 'https://cdn.test/video.mp4',
        imagePercent: 30,
        orientation: 'vertical',
      },
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(uploads, ['https://cdn.test/image.jpg', 'https://cdn.test/video.mp4']);
  assert.deepEqual(generatedAssetIds, ['asset_image', 'asset_video']);
});

test('API recebe anexo binário e devolve o asset do Canva', async (t) => {
  const service = fakeService();
  let receivedSize = 0;
  service.uploadLocalAsset = async (bytes) => {
    receivedSize = bytes.byteLength;
    return 'asset_attachment';
  };
  const app = createApp({ getService: async () => service });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/media-uploads?kind=video',
    headers: { 'content-type': 'application/octet-stream', 'x-file-type': 'video/mp4' },
    payload: Buffer.from('video-bytes'),
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedSize, 11);
  assert.deepEqual(response.json(), { assetId: 'asset_attachment', kind: 'video' });
});
