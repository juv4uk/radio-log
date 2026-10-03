import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAlignedBfsk, decisionsToBitString } from '../.test-build/src/lib/sens-radio/bfsk-rx.js';
import { decodeSensRadioFrame, encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

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


function bytesToBits(bytes) {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
}

function bitsToBytes(bits) {
  assert.equal(bits.length % 8, 0);
  return Uint8Array.from({ length: bits.length / 8 }, (_, index) =>
    Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)
  );
}

test('round-trips a complete SENS-RADIO frame through deterministic BFSK audio', () => {
  const sensBits = '001000101101';
  const frame = encodeSensRadioFrame(sensBits);
  const wireBits = bytesToBits(frame);
  const receivedBits = decisionsToBitString(decodeAlignedBfsk(synthesize(wireBits), config), 0.8);
  const decoded = decodeSensRadioFrame(bitsToBytes(receivedBits));
  assert.equal(decoded.bits, sensBits);
  assert.equal(decoded.bitLength, sensBits.length);
});
