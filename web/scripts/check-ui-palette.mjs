import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const allowed = new Set([
  '#1814f3',
  '#2d60ff',
  '#343c6a',
  '#718ebf',
  '#8ba3cb',
  '#dfeaf2',
  '#e6eff5',
  '#edf1f7',
  '#f5f7fa',
  '#ffffff',
]);
const roots = ['app', 'components'];
const violations = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if (extname(entry.name) !== '.css') continue;
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
      const color = match[0].toLowerCase();
      if (!allowed.has(color)) {
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`${path}:${line} ${match[0]}`);
      }
    }
  }
}

for (const root of roots) visit(root);

if (violations.length > 0) {
  console.error(`Cores fora da paleta permitida:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Paleta da interface validada.');
}
