import type { JsonObject, JsonSchema, McpTool } from './types.js';

export interface SemanticArgument {
  aliases: readonly string[];
  value: unknown;
  label: string;
}

function schemaType(schema: JsonSchema | undefined): string | undefined {
  if (!schema) return undefined;
  if (typeof schema.type === 'string') return schema.type;
  return schema.type?.[0];
}

/**
 * Maps stable workflow concepts to the current schema advertised by Canva.
 * This avoids blindly assuming a field name when the remote tool evolves.
 */
export function resolveArguments(tool: McpTool, semantic: readonly SemanticArgument[]): JsonObject {
  const properties = tool.inputSchema.properties ?? {};
  const required = new Set(tool.inputSchema.required ?? []);
  const args: JsonObject = {};
  const consumed = new Set<SemanticArgument>();

  for (const item of semantic) {
    if (item.value === undefined) continue;
    const name = item.aliases.find((alias) => Object.hasOwn(properties, alias));
    if (name) {
      args[name] = item.value;
      consumed.add(item);
    }
  }

  // Fallback seguro para uma única string obrigatória, comum em ferramentas
  // de geração cujo campo pode mudar de `prompt` para `brief`.
  const missingRequired = [...required].filter((name) => !(name in args));
  for (const item of semantic) {
    if (consumed.has(item) || typeof item.value !== 'string') continue;
    const compatible = missingRequired.filter(
      (name) => !(name in args) && (schemaType(properties[name]) === 'string' || schemaType(properties[name]) === undefined),
    );
    if (compatible.length === 1) {
      args[compatible[0]!] = item.value;
      consumed.add(item);
    }
  }

  const unresolved = [...required].filter(
    (name) => !(name in args) && properties[name]?.default === undefined,
  );
  if (unresolved.length > 0) {
    throw new Error(
      `Não foi possível preencher os campos obrigatórios de ${tool.name}: ${unresolved.join(', ')}. ` +
        `Use "npm run tools -- --json" para conferir o schema anunciado pelo Canva.`,
    );
  }

  return args;
}
