import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const inventoryPath = new URL('../docs/sens-radio-gpu-candidates.json', import.meta.url);

test('GPU candidate inventory names real source functions and explicit blockers', async () => {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  assert.equal(inventory.schema, 'radio-log/sens-radio-gpu-candidates/v1');

  const byId = new Map(inventory.candidates.map((candidate) => [candidate.id, candidate]));

  assert.equal(byId.get('bpsk-aligned-decode').function, 'decodeAlignedBpsk');
  assert.equal(byId.get('bpsk-aligned-decode').status, 'BLOCKED_MECHANISM');
  assert.equal(byId.get('bfsk-aligned-decode').function, 'decodeAlignedBfsk');
  assert.equal(byId.get('bfsk-aligned-decode').status, 'BLOCKED_MECHANISM');
  assert.equal(byId.get('linear-resample').function, 'resampleLinear');

  assert.equal(byId.get('deterministic-awgn').status, 'STATEFUL_CURRENT_DEFINITION');
  assert.equal(byId.get('bfsk-aligned-encode').status, 'STATEFUL_CURRENT_DEFINITION');
  assert.equal(byId.get('frame-sync-acquisition').status, 'KEEP_CPU');
  assert.equal(byId.get('ft8-wasm').status, 'NOT_A_CML_CUDA_TARGET');

  for (const candidate of inventory.candidates) {
    assert.ok(candidate.source.startsWith('src/'), candidate.id);
    assert.ok(candidate.status, candidate.id);
    assert.ok(candidate.blocker || candidate.status === 'KEEP_CPU', candidate.id);
  }
});
