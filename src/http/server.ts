import { loadEnvFile } from 'node:process';
import { createApp } from './app.js';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

const port = Number.parseInt(process.env.CANVA_WEB_API_PORT ?? '3000', 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error('CANVA_WEB_API_PORT deve ser uma porta válida.');
}

const app = createApp();

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

await app.listen({ host: '127.0.0.1', port });
console.log(`API local do Ateliê Canva: http://127.0.0.1:${port}`);
