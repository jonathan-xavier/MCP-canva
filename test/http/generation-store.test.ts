import assert from 'node:assert/strict';
import test from 'node:test';
import { GenerationStore } from '../../src/http/generation-store.js';

function generation(jobId: string, candidateId = `${jobId}_candidate`) {
  return {
    jobId,
    candidates: [{ candidateId, thumbnailUrls: ['https://media.canva.com/preview.png'] }],
    raw: {},
  };
}

test('GenerationStore expira registros e rejeita candidatos de outra geração', () => {
  let now = 1_000;
  const store = new GenerationStore({ ttlMs: 100, now: () => now });
  store.put(generation('job_1', 'candidate_1'), ['TEXTO EXATO']);

  assert.equal(store.getCandidate('job_1', 'candidate_1').candidateId, 'candidate_1');
  assert.deepEqual(store.get('job_1').exactTexts, ['TEXTO EXATO']);
  assert.throws(() => store.getCandidate('job_1', 'candidate_2'), /não pertence/);
  now = 1_101;
  assert.throws(() => store.get('job_1'), /expirou/);
});

test('GenerationStore limita registros e bloqueia seleções concorrentes', () => {
  let now = 1_000;
  const store = new GenerationStore({ maxRecords: 2, now: () => now++ });
  store.put(generation('job_1'));
  store.put(generation('job_2'));
  store.put(generation('job_3'));

  assert.throws(() => store.get('job_1'), /não existe/);
  store.claimSelection('job_2', 'job_2_candidate');
  assert.throws(() => store.claimSelection('job_2', 'job_2_candidate'), /já está sendo criado/);
  store.releaseSelection('job_2');
  store.claimSelection('job_2', 'job_2_candidate');
  store.markSelected('job_2', 'job_2_candidate', 'D1234567890');
  assert.throws(() => store.claimSelection('job_2', 'job_2_candidate'), /foi criado/);
});
