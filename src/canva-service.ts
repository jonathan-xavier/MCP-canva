import { resolveArguments } from './arguments.js';
import { isRecord, optionalString, requiredString, resultPayload } from './result.js';
import type {
  CreatedDesign,
  CanvaCapabilities,
  DesignCandidate,
  DraftEdit,
  ExportedDesign,
  GeneratedCandidates,
  JsonObject,
  McpPort,
  McpTool,
} from './types.js';

const aliases = {
  brief: ['prompt', 'brief', 'description', 'query', 'text', 'design_prompt'],
  designType: ['design_type', 'designType'],
  jobId: ['job_id', 'jobId', 'generation_job_id'],
  candidateId: ['candidate_id', 'candidateId'],
  designId: ['design_id', 'designId', 'id'],
  format: ['format', 'file_format', 'fileFormat', 'type'],
  transactionId: ['transaction_id', 'transactionId'],
  operations: ['operations', 'edits', 'changes'],
  pageIndex: ['page_index', 'pageIndex'],
  pages: ['pages'],
  userIntent: ['user_intent', 'userIntent'],
} as const;

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

function advertisedFormats(payload: JsonObject): string[] {
  const value = payload.formats ?? payload.export_formats ?? payload.supported_formats;
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (isRecord(item) && typeof item.type === 'string') return [item.type];
      return [];
    });
  }
  if (isRecord(value)) return Object.keys(value);
  return [];
}

export class CanvaService {
  private tools?: McpTool[];

  constructor(private readonly mcp: McpPort) {}

  async listTools(refresh = false): Promise<McpTool[]> {
    if (!this.tools || refresh) {
      this.tools = await this.mcp.listTools();
    }
    return this.tools;
  }

  private async tool(name: string): Promise<McpTool> {
    const tools = await this.listTools();
    const tool = tools.find((item) => item.name === name);
    if (!tool) {
      throw new Error(`A ferramenta "${name}" não foi anunciada pelo Canva. Disponíveis: ${tools.map((item) => item.name).join(', ')}`);
    }
    return tool;
  }

  async call(name: string, args: JsonObject): Promise<JsonObject> {
    await this.tool(name);
    return resultPayload(await this.mcp.callTool(name, args));
  }

  async capabilities(): Promise<CanvaCapabilities> {
    const tools = await this.listTools();
    const generationTool = tools.find((item) => item.name === 'create-design') ?? tools.find((item) => item.name === 'generate-design');
    const designTypeSchema = generationTool?.inputSchema.properties?.design_type;
    const designTypes = Array.isArray(designTypeSchema?.enum)
      ? designTypeSchema.enum.filter((value): value is string => typeof value === 'string')
      : [];
    return {
      connected: true,
      ...(generationTool ? { generationTool: generationTool.name } : {}),
      designTypes,
      canExport: tools.some((item) => item.name === 'get-export-formats') && tools.some((item) => item.name === 'export-design'),
    };
  }

  async generateCandidates(brief: string, designType = 'instagram_post'): Promise<GeneratedCandidates> {
    if (!brief.trim()) throw new Error('O briefing do banner não pode ficar vazio.');
    const tools = await this.listTools();
    if (tools.some((item) => item.name === 'create-design')) {
      throw new Error(
        'O Canva anunciou a nova ferramenta "create-design". A ferramenta legada "generate-design" não será chamada. ' +
          'Atualize este cliente para o novo fluxo antes de gerar designs.',
      );
    }
    const tool = await this.tool('generate-design');
    const args = resolveArguments(tool, [
      { aliases: aliases.brief, value: brief.trim(), label: 'briefing' },
      { aliases: aliases.designType, value: designType, label: 'tipo de design' },
      { aliases: aliases.userIntent, value: `Gerar opções de banner no formato ${designType}.`, label: 'intenção do usuário' },
    ]);
    let payload = resultPayload(await this.mcp.callTool(tool.name, args));
    let job = isRecord(payload.job) ? payload.job : payload;
    if (optionalString(job, 'status') === 'in_progress') {
      const pollTool = await this.tool('get-design-candidates');
      const jobId = requiredString(job, 'id', 'job de geração');
      for (let attempt = 0; attempt < 60 && optionalString(job, 'status') === 'in_progress'; attempt += 1) {
        await wait(2_000);
        const pollArgs = resolveArguments(pollTool, [
          { aliases: aliases.jobId, value: jobId, label: 'job da geração' },
          { aliases: aliases.userIntent, value: 'Aguardar as opções de banner solicitadas.', label: 'intenção do usuário' },
        ]);
        payload = resultPayload(await this.mcp.callTool(pollTool.name, pollArgs));
        job = isRecord(payload.job) ? payload.job : payload;
      }
    }
    const status = optionalString(job, 'status');
    if (status && status !== 'success') {
      throw new Error(`A geração do Canva terminou com status "${status}".`);
    }
    const result = isRecord(job.result) ? job.result : job;
    const rawCandidates = Array.isArray(result.generated_designs)
      ? result.generated_designs
      : Array.isArray(result.candidates)
        ? result.candidates
        : [];
    const candidates: DesignCandidate[] = rawCandidates.filter(isRecord).map((candidate) => {
      const url = optionalString(candidate, 'url');
      return {
        candidateId: requiredString(candidate, 'candidate_id', 'candidato'),
        ...(url ? { url } : {}),
        thumbnailUrls: Array.isArray(candidate.thumbnails)
          ? candidate.thumbnails.filter(isRecord).map((item) => optionalString(item, 'url')).filter((item): item is string => Boolean(item))
          : [],
      };
    });
    if (candidates.length === 0) {
      throw new Error('O Canva não retornou candidatos de design.');
    }
    return { jobId: requiredString(job, 'id', 'job de geração'), candidates, raw: payload };
  }

  async createFromCandidate(jobId: string, candidateId: string): Promise<CreatedDesign> {
    const tool = await this.tool('create-design-from-candidate');
    const args = resolveArguments(tool, [
      { aliases: aliases.jobId, value: jobId, label: 'job da geração' },
      { aliases: aliases.candidateId, value: candidateId, label: 'candidato' },
      { aliases: aliases.userIntent, value: 'Criar o design editável escolhido pelo usuário.', label: 'intenção do usuário' },
    ]);
    const payload = resultPayload(await this.mcp.callTool(tool.name, args));
    const summary = isRecord(payload.design_summary) ? payload.design_summary : payload;
    const urls = isRecord(summary.urls) ? summary.urls : {};
    const title = optionalString(summary, 'title');
    const editUrl = optionalString(urls, 'edit_url');
    const viewUrl = optionalString(urls, 'view_url');
    return {
      id: requiredString(summary, 'id', 'design criado'),
      ...(title ? { title } : {}),
      ...(editUrl ? { editUrl } : {}),
      ...(viewUrl ? { viewUrl } : {}),
      raw: payload,
    };
  }

  async getExportFormats(designId: string): Promise<string[]> {
    const formatsTool = await this.tool('get-export-formats');
    const formatsArgs = resolveArguments(formatsTool, [
      { aliases: aliases.designId, value: designId, label: 'design' },
      { aliases: aliases.userIntent, value: 'Verificar os formatos disponíveis para exportar o design.', label: 'intenção do usuário' },
    ]);
    const formatsPayload = resultPayload(await this.mcp.callTool(formatsTool.name, formatsArgs));
    return advertisedFormats(formatsPayload).sort();
  }

  async exportDesign(designId: string, format: string): Promise<ExportedDesign> {
    const normalizedFormat = format.toLowerCase();
    const formats = await this.getExportFormats(designId);
    if (!formats.includes(normalizedFormat)) {
      const detail = formats.length > 0 ? ` Formatos disponíveis: ${formats.join(', ')}.` : '';
      throw new Error(`O Canva não anunciou suporte a ${normalizedFormat} para este design.${detail}`);
    }

    const tool = await this.tool('export-design');
    const formatSchema = tool.inputSchema.properties?.format;
    const formatArgument = formatSchema?.type === 'object' ? { type: normalizedFormat } : normalizedFormat;
    const args = resolveArguments(tool, [
      { aliases: aliases.designId, value: designId, label: 'design' },
      { aliases: aliases.format, value: formatArgument, label: 'formato' },
      { aliases: aliases.userIntent, value: `Exportar o design como ${normalizedFormat}.`, label: 'intenção do usuário' },
    ]);
    const payload = resultPayload(await this.mcp.callTool(tool.name, args));
    const job = isRecord(payload.job) ? payload.job : payload;
    const status = optionalString(job, 'status');
    if (status && status !== 'success') {
      throw new Error(`A exportação do Canva terminou com status "${status}".`);
    }
    const urls = Array.isArray(job.urls) ? job.urls.filter((url): url is string => typeof url === 'string') : [];
    if (urls.length === 0) throw new Error('O Canva não retornou um link de download.');
    const jobId = optionalString(job, 'id');
    return {
      ...(jobId ? { jobId } : {}),
      urls,
      raw: payload,
    };
  }

  async prepareEdit(designId: string, operations: unknown[], pageIndex: number): Promise<DraftEdit> {
    if (operations.length === 0) throw new Error('Informe pelo menos uma operação de edição.');
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 1) throw new Error('pageIndex deve ser um inteiro a partir de 1.');
    const startTool = await this.tool('start-editing-transaction');
    const startArgs = resolveArguments(startTool, [
      { aliases: aliases.designId, value: designId, label: 'design' },
      { aliases: aliases.userIntent, value: 'Abrir o design para aplicar as edições solicitadas.', label: 'intenção do usuário' },
    ]);
    const start = resultPayload(await this.mcp.callTool(startTool.name, startArgs));
    const transaction = isRecord(start.transaction) ? start.transaction : start;
    const transactionId = requiredString(transaction, 'transaction_id', 'transação de edição');

    const performTool = await this.tool('perform-editing-operations');
    const performArgs = resolveArguments(performTool, [
      { aliases: aliases.transactionId, value: transactionId, label: 'transação' },
      { aliases: aliases.operations, value: operations, label: 'operações' },
      { aliases: aliases.pageIndex, value: pageIndex, label: 'página da prévia' },
      { aliases: aliases.pages, value: Array.isArray(start.pages) ? start.pages : undefined, label: 'páginas do design' },
      { aliases: aliases.userIntent, value: 'Aplicar as edições solicitadas em modo de rascunho.', label: 'intenção do usuário' },
    ]);
    const performed = resultPayload(await this.mcp.callTool(performTool.name, performArgs));
    return { transactionId, start, performed };
  }

  async commitEdit(transactionId: string): Promise<JsonObject> {
    const commitTool = await this.tool('commit-editing-transaction');
    const commitArgs = resolveArguments(commitTool, [
      { aliases: aliases.transactionId, value: transactionId, label: 'transação' },
      { aliases: aliases.userIntent, value: 'Salvar as alterações aprovadas pelo usuário.', label: 'intenção do usuário' },
    ]);
    return resultPayload(await this.mcp.callTool(commitTool.name, commitArgs));
  }

  async cancelEdit(transactionId: string): Promise<JsonObject> {
    const cancelTool = await this.tool('cancel-editing-transaction');
    const cancelArgs = resolveArguments(cancelTool, [
      { aliases: aliases.transactionId, value: transactionId, label: 'transação' },
      { aliases: aliases.userIntent, value: 'Descartar o rascunho não aprovado pelo usuário.', label: 'intenção do usuário' },
    ]);
    return resultPayload(await this.mcp.callTool(cancelTool.name, cancelArgs));
  }
}
