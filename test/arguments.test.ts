import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveArguments } from '../src/arguments.js';
import type { McpTool } from '../src/types.js';

test('resolveArguments usa os nomes publicados pelo schema', () => {
  const tool: McpTool = {
    name: 'generate-design',
    inputSchema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
  };

  assert.deepEqual(
    resolveArguments(tool, [{ aliases: ['prompt', 'brief'], value: 'Banner moderno', label: 'briefing' }]),
    { prompt: 'Banner moderno' },
  );
});

test('resolveArguments usa fallback apenas quando há um único campo string inequívoco', () => {
  const tool: McpTool = {
    name: 'generate-design',
    inputSchema: {
      type: 'object',
      properties: { creative_request: { type: 'string' } },
      required: ['creative_request'],
    },
  };

  assert.deepEqual(
    resolveArguments(tool, [{ aliases: ['prompt'], value: 'Banner moderno', label: 'briefing' }]),
    { creative_request: 'Banner moderno' },
  );
});

test('resolveArguments falha claramente quando o schema exige dados desconhecidos', () => {
  const tool: McpTool = {
    name: 'generate-design',
    inputSchema: {
      type: 'object',
      properties: {
        first: { type: 'string' },
        second: { type: 'string' },
      },
      required: ['first', 'second'],
    },
  };

  assert.throws(
    () => resolveArguments(tool, [{ aliases: ['prompt'], value: 'Banner', label: 'briefing' }]),
    /first, second/,
  );
});
