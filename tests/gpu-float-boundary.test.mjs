import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeAlignedBpsk } from '../.test-build/src/lib/sens-radio/bpsk.js';

const config = {
  sampleRate: 8000,
  symbolRate: 100,
  carrierHz: 1000
};

test('Float64 to Float32 narrowing can flip an aligned BPSK bit decision', () => {
  const samples = new Float64Array(config.sampleRate / config.symbolRate);

  // cos(0) = +1 and cos(pi) = -1. In Float64 this leaves a tiny
  // negative correlation: 0.5 - 0.5000000001 ~= -1e-10 => bit 0.
  samples[0] = 0.5;
  samples[4] = 0.5000000001;

  const f64 = decodeAlignedBpsk(samples, config)[0];

  // binary32 rounds both values to exactly 0.5. Feeding those narrowed
  // values through the same CPU oracle produces correlation == 0, and the
  // current decoder's >= 0 rule therefore chooses bit 1.
  const narrowed = Float32Array.from(samples);
  const f32Transport = decodeAlignedBpsk(narrowed, config)[0];

  assert.equal(f64.bit, 0);
  assert.ok(f64.correlation < 0);
  assert.equal(narrowed[0], 0.5);
  assert.equal(narrowed[4], 0.5);
  assert.equal(f32Transport.correlation, 0);
  assert.equal(f32Transport.bit, 1);
  assert.notEqual(f32Transport.bit, f64.bit);
});
