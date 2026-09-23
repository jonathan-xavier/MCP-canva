#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { CanvaService } from './canva-service.js';
import { CanvaRemoteClient } from './remote-client.js';
import type { DesignCandidate, JsonObject } from './types.js';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

const usage = `
Canva Banner CLI

Comandos:
  npm run tools -- [--json]
  npm run banner -- --brief "..." [--design-type instagram_post] [--choose 1] [--export png]
  npm run banner -- --brief-file briefing.txt [--choose 1]
  npm run export -- --design-id ID [--format png]
  npm run edit -- --design-id ID --page-index 1 --operations '[...]'
  npm run call -- --tool NOME --args '{"campo":"valor"}'

Na primeira execução, o navegador abrirá o login OAuth do Canva.
`;

function jsonObject(text: string, label: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} deve conter JSON válido.`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} deve ser um objeto JSON.`);
  }
  return parsed as JsonObject;
}

async function textOption(value: string | undefined, file: string | undefined, label: string): Promise<string | undefined> {
  if (value && file) throw new Error(`Use apenas --${label} ou --${label}-file.`);
  if (file) return (await readFile(file, 'utf8')).trim();
  return value?.trim();
}

function showCandidates(candidates: DesignCandidate[]): void {
  console.log('\nOpções geradas pelo Canva:');
  candidates.forEach((candidate, index) => {
    console.log(`\n  ${index + 1}. candidate_id: ${candidate.candidateId}`);
    if (candidate.url) console.log(`     Visualização: ${candidate.url}`);
    for (const thumbnail of candidate.thumbnailUrls) console.log(`     Miniatura: ${thumbnail}`);
  });
}

async function selectCandidate(candidates: DesignCandidate[], supplied: string | undefined): Promise<DesignCandidate> {
  let raw = supplied;
  if (!raw) {
    if (!process.stdin.isTTY) {
      throw new Error('Informe --choose N para selecionar um candidato em modo não interativo.');
    }
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      raw = await prompt.question('\nQual opção deseja transformar em design editável? ');
    } finally {
      prompt.close();
    }
  }

  const index = Number.parseInt(raw, 10) - 1;
  const candidate = candidates[index];
  if (!candidate) throw new Error(`Escolha inválida: ${raw}. Use um número entre 1 e ${candidates.length}.`);
  return candidate;
}

async function run(): Promise<void> {
  const command = process.argv[2];
  const rest = process.argv.slice(3);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(usage.trim());
    return;
  }
  if (rest.includes('--help') || rest.includes('-h')) {
    console.log(usage.trim());
    return;
  }

  const mcp = await CanvaRemoteClient.connect();
  const canva = new CanvaService(mcp);
  try {
    switch (command) {
      case 'tools': {
        const { values } = parseArgs({
          args: rest,
          strict: true,
          options: {
            json: { type: 'boolean', default: false },
            name: { type: 'string' },
          },
        });
        const allTools = await canva.listTools();
        const tools = values.name ? allTools.filter((tool) => tool.name === values.name) : allTools;
        if (values.name && tools.length === 0) throw new Error(`Ferramenta não encontrada: ${values.name}`);
        if (values.json || values.name) console.log(JSON.stringify(tools, null, 2));
        else tools.forEach((tool) => console.log(`${tool.name} — ${tool.description ?? 'sem descrição'}`));
        break;
      }

      case 'banner': {
        const { values } = parseArgs({
          args: rest,
          strict: true,
          options: {
            brief: { type: 'string' },
            'brief-file': { type: 'string' },
            'design-type': { type: 'string', default: 'instagram_post' },
            choose: { type: 'string' },
            export: { type: 'string' },
            json: { type: 'boolean', default: false },
          },
        });
        let brief = await textOption(values.brief, values['brief-file'], 'brief');
        if (!brief) {
          if (!process.stdin.isTTY) throw new Error('Informe --brief ou --brief-file.');
          const prompt = createInterface({ input: process.stdin, output: process.stdout });
          try {
            brief = (await prompt.question('Descreva o banner que deseja criar: ')).trim();
          } finally {
            prompt.close();
          }
        }

        console.log('Gerando opções no Canva; isso pode levar até dois minutos...');
        const generated = await canva.generateCandidates(brief, values['design-type']);
        showCandidates(generated.candidates);
        const selected = await selectCandidate(generated.candidates, values.choose);
        const design = await canva.createFromCandidate(generated.jobId, selected.candidateId);
        console.log('\nDesign editável criado.');
        console.log(`ID: ${design.id}`);
        if (design.editUrl) console.log(`Editar no Canva: ${design.editUrl}`);
        if (design.viewUrl) console.log(`Visualizar: ${design.viewUrl}`);

        let exported;
        if (values.export) {
          exported = await canva.exportDesign(design.id, values.export.toLowerCase());
          console.log(`\nExportação ${values.export.toUpperCase()}:`);
          exported.urls.forEach((url) => console.log(url));
        }
        if (values.json) console.log(JSON.stringify({ generated, selected, design, exported }, null, 2));
        break;
      }

      case 'export': {
        const { values } = parseArgs({
          args: rest,
          strict: true,
          options: {
            'design-id': { type: 'string' },
            format: { type: 'string', default: 'png' },
          },
        });
        if (!values['design-id']) throw new Error('--design-id é obrigatório.');
        const exported = await canva.exportDesign(values['design-id'], values.format.toLowerCase());
        exported.urls.forEach((url) => console.log(url));
        break;
      }

      case 'edit': {
        const { values } = parseArgs({
          args: rest,
          strict: true,
          options: {
            'design-id': { type: 'string' },
            operations: { type: 'string' },
            'operations-file': { type: 'string' },
            'page-index': { type: 'string', default: '1' },
          },
        });
        if (!values['design-id']) throw new Error('--design-id é obrigatório.');
        if (!process.stdin.isTTY) throw new Error('A edição requer um terminal interativo para aprovar ou descartar a prévia.');
        const operationsText = await textOption(values.operations, values['operations-file'], 'operations');
        if (!operationsText) throw new Error('Informe --operations ou --operations-file.');
        const operations = JSON.parse(operationsText) as unknown;
        if (!Array.isArray(operations)) throw new Error('As operações devem ser um array JSON.');
        const pageIndex = Number.parseInt(values['page-index'], 10);
        const draft = await canva.prepareEdit(values['design-id'], operations, pageIndex);
        console.log('\nAlterações aplicadas em rascunho. Confira a resposta e as miniaturas:');
        console.log(JSON.stringify(draft.performed, null, 2));

        const prompt = createInterface({ input: process.stdin, output: process.stdout });
        let approved: string;
        try {
          approved = (await prompt.question('\nDeseja salvar essas alterações? Digite SIM para confirmar: ')).trim().toUpperCase();
        } finally {
          prompt.close();
        }
        if (approved === 'SIM') {
          const committed = await canva.commitEdit(draft.transactionId);
          console.log('\nAlterações salvas:');
          console.log(JSON.stringify(committed, null, 2));
        } else {
          const cancelled = await canva.cancelEdit(draft.transactionId);
          console.log('\nAlterações descartadas:');
          console.log(JSON.stringify(cancelled, null, 2));
        }
        break;
      }

      case 'call': {
        const { values } = parseArgs({
          args: rest,
          strict: true,
          options: {
            tool: { type: 'string' },
            args: { type: 'string', default: '{}' },
          },
        });
        if (!values.tool) throw new Error('--tool é obrigatório.');
        const result = await canva.call(values.tool, jsonObject(values.args, '--args'));
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      default:
        throw new Error(`Comando desconhecido: ${command}\n\n${usage.trim()}`);
    }
  } finally {
    await mcp.close();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
});
