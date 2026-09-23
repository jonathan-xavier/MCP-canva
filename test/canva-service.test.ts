import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvaService } from '../src/canva-service.js';
import type { JsonObject, McpPort, McpTool, McpToolResult } from '../src/types.js';

const tools: McpTool[] = [
  {
    name: 'generate-design',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, design_type: { type: 'string' }, user_intent: { type: 'string' } },
      required: ['query', 'design_type'],
    },
  },
  {
    name: 'create-design-from-candidate',
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string' }, candidate_id: { type: 'string' }, user_intent: { type: 'string' } },
      required: ['job_id', 'candidate_id'],
    },
  },
  {
    name: 'get-export-formats',
    inputSchema: {
      type: 'object',
      properties: { design_id: { type: 'string' }, user_intent: { type: 'string' } },
      required: ['design_id'],
    },
  },
  {
    name: 'export-design',
    inputSchema: {
      type: 'object',
      properties: { design_id: { type: 'string' }, format: { type: 'object' }, user_intent: { type: 'string' } },
      required: ['design_id', 'format'],
    },
  },
  {
    name: 'start-editing-transaction',
    inputSchema: {
      type: 'object',
      properties: { design_id: { type: 'string' }, user_intent: { type: 'string' } },
      required: ['design_id'],
    },
  },
  {
    name: 'perform-editing-operations',
    inputSchema: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string' },
        operations: { type: 'array' },
        page_index: { type: 'number' },
        pages: { type: 'array' },
        user_intent: { type: 'string' },
      },
      required: ['transaction_id', 'operations', 'page_index'],
    },
  },
  {
    name: 'commit-editing-transaction',
    inputSchema: {
      type: 'object',
      properties: { transaction_id: { type: 'string' }, user_intent: { type: 'string' } },
      required: ['transaction_id'],
    },
  },
  {
    name: 'cancel-editing-transaction',
    inputSchema: {
      type: 'object',
      properties: { transaction_id: { type: 'string' }, user_intent: { type: 'string' } },
      required: ['transaction_id'],
    },
  },
];

class FakeMcp implements McpPort {
  readonly calls: Array<{ name: string; args: JsonObject }> = [];

  constructor(private readonly results: Record<string, McpToolResult>) {}

  async listTools(): Promise<McpTool[]> {
    return tools;
  }

  async callTool(name: string, args: JsonObject): Promise<McpToolResult> {
    this.calls.push({ name, args });
    const result = this.results[name];
    if (!result) throw new Error(`Resultado não configurado: ${name}`);
    return result;
  }

  async close(): Promise<void> {}
}

test('fluxo de geração preserva job e exige criação do candidato escolhido', async () => {
  const mcp = new FakeMcp({
    'generate-design': {
      structuredContent: {
        job: {
          id: 'job-1',
          status: 'success',
          result: {
            generated_designs: [
              { candidate_id: 'candidate-1', url: 'https://canva.test/candidate-1', thumbnails: [{ url: 'https://img.test/1' }] },
              { candidate_id: 'candidate-2', url: 'https://canva.test/candidate-2', thumbnails: [] },
            ],
          },
        },
      },
    },
    'create-design-from-candidate': {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            design_summary: {
              id: 'design-2',
              title: 'Banner escolhido',
              urls: { edit_url: 'https://canva.test/edit', view_url: 'https://canva.test/view' },
            },
          }),
        },
      ],
    },
  });
  const service = new CanvaService(mcp);

  const generated = await service.generateCandidates('Promoção de tecnologia');
  assert.equal(generated.jobId, 'job-1');
  assert.equal(generated.candidates.length, 2);
  assert.deepEqual(mcp.calls[0], {
    name: 'generate-design',
    args: {
      query: 'Promoção de tecnologia',
      design_type: 'instagram_post',
      user_intent: 'Gerar opções de banner no formato instagram_post.',
    },
  });

  const design = await service.createFromCandidate(generated.jobId, generated.candidates[1]!.candidateId);
  assert.equal(design.id, 'design-2');
  assert.equal(design.editUrl, 'https://canva.test/edit');
  assert.deepEqual(mcp.calls[1], {
    name: 'create-design-from-candidate',
    args: {
      job_id: 'job-1',
      candidate_id: 'candidate-2',
      user_intent: 'Criar o design editável escolhido pelo usuário.',
    },
  });
});

test('exportação retorna links temporários', async () => {
  const mcp = new FakeMcp({
    'get-export-formats': { structuredContent: { formats: [{ type: 'png' }, { type: 'pdf' }] } },
    'export-design': {
      structuredContent: {
        job: { id: 'export-1', status: 'success', urls: ['https://download.test/banner.png'] },
      },
    },
  });
  const exported = await new CanvaService(mcp).exportDesign('design-1', 'png');

  assert.deepEqual(exported.urls, ['https://download.test/banner.png']);
  assert.deepEqual(mcp.calls[0], {
    name: 'get-export-formats',
    args: {
      design_id: 'design-1',
      user_intent: 'Verificar os formatos disponíveis para exportar o design.',
    },
  });
  assert.deepEqual(mcp.calls[1], {
    name: 'export-design',
    args: {
      design_id: 'design-1',
      format: { type: 'png' },
      user_intent: 'Exportar o design como png.',
    },
  });
});

test('exportação recusa formato que não foi anunciado para o design', async () => {
  const mcp = new FakeMcp({
    'get-export-formats': { structuredContent: { formats: { pdf: {} } } },
  });

  await assert.rejects(() => new CanvaService(mcp).exportDesign('design-1', 'png'), /Formatos disponíveis: pdf/);
  assert.deepEqual(mcp.calls.map((call) => call.name), ['get-export-formats']);
});

test('edição abre, executa e confirma a mesma transação', async () => {
  const mcp = new FakeMcp({
    'start-editing-transaction': {
      structuredContent: {
        transaction: { transaction_id: 'tx-1', status: 'open' },
        pages: [{ page_id: 'page-1', is_responsive: false }],
      },
    },
    'perform-editing-operations': { structuredContent: { status: 'applied' } },
    'commit-editing-transaction': { structuredContent: { status: 'committed' } },
  });
  const operations = [{ type: 'replace_text', element_id: 'el-1', text: 'Nova oferta' }];
  const service = new CanvaService(mcp);
  const draft = await service.prepareEdit('design-1', operations, 1);
  const committed = await service.commitEdit(draft.transactionId);

  assert.equal(draft.transactionId, 'tx-1');
  assert.equal(committed.status, 'committed');
  assert.deepEqual(mcp.calls.map((call) => call.name), [
    'start-editing-transaction',
    'perform-editing-operations',
    'commit-editing-transaction',
  ]);
  assert.deepEqual(mcp.calls[1]!.args, {
    transaction_id: 'tx-1',
    operations,
    page_index: 1,
    pages: [{ page_id: 'page-1', is_responsive: false }],
    user_intent: 'Aplicar as edições solicitadas em modo de rascunho.',
  });
  assert.deepEqual(mcp.calls[2]!.args, {
    transaction_id: 'tx-1',
    user_intent: 'Salvar as alterações aprovadas pelo usuário.',
  });
});

test('erro de ferramenta é propagado e impede as próximas etapas', async () => {
  const mcp = new FakeMcp({
    'generate-design': { isError: true, content: [{ type: 'text', text: 'quota exceeded' }] },
  });

  await assert.rejects(() => new CanvaService(mcp).generateCandidates('Banner'), /quota exceeded/);
  assert.equal(mcp.calls.length, 1);
});

test('cancelamento descarta a transação sem chamar commit', async () => {
  const mcp = new FakeMcp({
    'cancel-editing-transaction': { structuredContent: { status: 'cancelled' } },
  });

  const cancelled = await new CanvaService(mcp).cancelEdit('tx-2');
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(mcp.calls, [
    {
      name: 'cancel-editing-transaction',
      args: {
        transaction_id: 'tx-2',
        user_intent: 'Descartar o rascunho não aprovado pelo usuário.',
      },
    },
  ]);
});
