import type { JsonObject, McpToolResult } from './types.js';

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

export function resultMessage(result: McpToolResult): string {
  return (result.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export function resultPayload(result: McpToolResult): JsonObject {
  if (result.isError) {
    throw new Error(resultMessage(result) || 'O Canva retornou um erro sem detalhes.');
  }

  if (isRecord(result.structuredContent)) {
    return result.structuredContent;
  }

  for (const block of result.content ?? []) {
    if (block.type !== 'text' || typeof block.text !== 'string') {
      continue;
    }

    const parsed = parseJson(block.text);
    if (isRecord(parsed)) {
      return parsed;
    }
  }

  const message = resultMessage(result);
  if (message) {
    return { message };
  }

  throw new Error('A ferramenta do Canva não retornou conteúdo estruturado.');
}

export function requiredString(record: JsonObject, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Resposta inválida do Canva: ${context} não contém "${key}".`);
  }
  return value;
}

export function optionalString(record: JsonObject, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
