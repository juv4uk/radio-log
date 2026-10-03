import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAlignedBfsk, decisionsToBitString } from '../.test-build/src/lib/sens-radio/bfsk-rx.js';

const config = {
  sampleRate: 8000,
  symbolRate: 100,
  zeroToneHz: 1000,
  oneToneHz: 1500
};

function synthesize(bits, amplitude = 0.8) {
  const samplesPerSymbol = config.sampleRate / config.symbolRate;
  const samples = new Float64Array(bits.length * samplesPerSymbol);
  for (let symbol = 0; symbol < bits.length; symbol += 1) {
    const tone = bits[symbol] === '1' ? config.oneToneHz : config.zeroToneHz;
    for (let i = 0; i < samplesPerSymbol; i += 1) {
      samples[symbol * samplesPerSymbol + i] =
        amplitude * Math.sin(2 * Math.PI * tone * i / config.sampleRate);
    }
  }
  return samples;
}

test('decodes deterministic aligned BFSK bits exactly', () => {
  const bits = '001011010001';
  const decisions = decodeAlignedBfsk(synthesize(bits), config);
  assert.equal(decisionsToBitString(decisions, 0.8), bits);
});

test('preserves leading zeroes in received bitstream', () => {
  const bits = '00000101';
  assert.equal(decisionsToBitString(decodeAlignedBfsk(synthesize(bits), config), 0.8), bits);
});

test('fails closed when sample count is not slot aligned', () => {
  const samples = synthesize('101');
  assert.throws(() => decodeAlignedBfsk(samples.slice(0, -1), config), /exact number of symbol slots/);
});

test('reports silence as low confidence instead of inventing a reliable bit', () => {
  const samples = new Float64Array(config.sampleRate / config.symbolRate);
  const decisions = decodeAlignedBfsk(samples, config);
  assert.equal(decisions[0].confidence, 0);
  assert.throws(() => decisionsToBitString(decisions, 0.2), /low-confidence/);
});

test('rejects invalid tone and sampling configurations', () => {
  assert.throws(() => decodeAlignedBfsk(synthesize('1'), { ...config, oneToneHz: config.zeroToneHz }), /must differ/);
  assert.throws(() => decodeAlignedBfsk(synthesize('1'), { ...config, oneToneHz: 5000 }), /Nyquist/);
});
