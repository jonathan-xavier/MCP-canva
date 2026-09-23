import { Client, type CallToolResult, type Tool } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { JsonObject, McpPort, McpTool, McpToolResult } from './types.js';

const DEFAULT_URL = 'https://mcp.canva.com/mcp';
const DEFAULT_TIMEOUT_MS = 120_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`CANVA_MCP_TIMEOUT_MS deve ser um inteiro positivo; recebido: ${value}`);
  }
  return parsed;
}

export interface RemoteClientOptions {
  endpoint?: string;
  timeoutMs?: number;
}

export class CanvaRemoteClient implements McpPort {
  private constructor(
    private readonly client: Client,
    private readonly timeoutMs: number,
  ) {}

  static async connect(options: RemoteClientOptions = {}): Promise<CanvaRemoteClient> {
    const endpoint = options.endpoint ?? process.env.CANVA_MCP_URL ?? DEFAULT_URL;
    const timeoutMs = options.timeoutMs ?? positiveInteger(process.env.CANVA_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== 'https:') {
      throw new Error('CANVA_MCP_URL deve usar HTTPS.');
    }

    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const environment = getDefaultEnvironment();
    if (process.env.MCP_REMOTE_CONFIG_DIR) {
      environment.MCP_REMOTE_CONFIG_DIR = process.env.MCP_REMOTE_CONFIG_DIR;
    }

    const transport = new StdioClientTransport({
      command,
      args: ['--no-install', 'mcp-remote', endpointUrl.toString()],
      env: environment,
      stderr: 'inherit',
    });
    const client = new Client(
      { name: 'canva-banner-cli', version: '1.0.0' },
      { versionNegotiation: { mode: 'legacy' } },
    );

    await client.connect(transport, { timeout: timeoutMs });
    return new CanvaRemoteClient(client, timeoutMs);
  }

  async listTools(): Promise<McpTool[]> {
    const { tools } = await this.client.listTools({}, { timeout: this.timeoutMs });
    return tools.map((tool: Tool) => ({
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      inputSchema: tool.inputSchema,
    })) as McpTool[];
  }

  async callTool(name: string, args: JsonObject): Promise<McpToolResult> {
    const result: CallToolResult = await this.client.callTool(
      { name, arguments: args },
      { timeout: this.timeoutMs },
    );
    return result as McpToolResult;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
