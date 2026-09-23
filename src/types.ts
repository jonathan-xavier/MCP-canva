export type JsonObject = Record<string, unknown>;

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface McpContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface McpToolResult {
  content?: McpContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
  [key: string]: unknown;
}

export interface McpPort {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: JsonObject): Promise<McpToolResult>;
  close(): Promise<void>;
}

export interface DesignCandidate {
  candidateId: string;
  url?: string;
  thumbnailUrls: string[];
}

export interface GeneratedCandidates {
  jobId: string;
  candidates: DesignCandidate[];
  raw: JsonObject;
}

export interface CreatedDesign {
  id: string;
  title?: string;
  editUrl?: string;
  viewUrl?: string;
  raw: JsonObject;
}

export interface ExportedDesign {
  jobId?: string;
  urls: string[];
  raw: JsonObject;
}

export interface CanvaCapabilities {
  connected: boolean;
  generationTool?: string;
  designTypes: string[];
  canExport: boolean;
}

export interface DraftEdit {
  transactionId: string;
  start: JsonObject;
  performed: JsonObject;
}
