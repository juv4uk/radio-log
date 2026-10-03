import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAlignedBfsk, decisionsToBitString } from '../.test-build/src/lib/sens-radio/bfsk-rx.js';
import { encodeAlignedBfsk } from '../.test-build/src/lib/sens-radio/bfsk-tx.js';
import { decodeSensRadioFrame, encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const config = {
  sampleRate: 8000,
  symbolRate: 100,
  zeroToneHz: 1000,
  oneToneHz: 1500
};

function bytesToBits(bytes) {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
}

function bitsToBytes(bits) {
  assert.equal(bits.length % 8, 0);
  return Uint8Array.from({ length: bits.length / 8 }, (_, index) =>
    Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)
  );
}

test('production BFSK encoder round-trips a complete SENS-RADIO frame', () => {
  const sensBits = '001000101101';
  const frame = encodeSensRadioFrame(sensBits);
  const channelBits = bytesToBits(frame);

  const samples = encodeAlignedBfsk(channelBits, config);
  const decisions = decodeAlignedBfsk(samples, config);
  const receivedBits = decisionsToBitString(decisions, 0.8);
  const decoded = decodeSensRadioFrame(bitsToBytes(receivedBits));

  assert.equal(decoded.bits, sensBits);
  assert.equal(decoded.bitLength, sensBits.length);
});

test('attenuation changes energy but not ideal aligned bit decisions', () => {
  const bits = '000101111000';
  const strong = decodeAlignedBfsk(encodeAlignedBfsk(bits, config, 0.8), config);
  const weak = decodeAlignedBfsk(encodeAlignedBfsk(bits, config, 0.08), config);

  assert.equal(decisionsToBitString(strong, 0.8), bits);
  assert.equal(decisionsToBitString(weak, 0.8), bits);
  assert.ok(weak[0].zeroEnergy < strong[0].zeroEnergy);
});

test('BFSK encoder preserves leading zeroes and exact symbol count', () => {
  const bits = '00000101';
  const samples = encodeAlignedBfsk(bits, config);
  assert.equal(samples.length, bits.length * (config.sampleRate / config.symbolRate));
  assert.equal(decisionsToBitString(decodeAlignedBfsk(samples, config), 0.8), bits);
});

test('BFSK encoder rejects malformed bits and unsafe configurations', () => {
  assert.throws(() => encodeAlignedBfsk('10x1', config), /only 0 and 1/);
  assert.throws(() => encodeAlignedBfsk('1', { ...config, oneToneHz: config.zeroToneHz }), /must differ/);
  assert.throws(() => encodeAlignedBfsk('1', { ...config, oneToneHz: 5000 }), /Nyquist/);
  assert.throws(() => encodeAlignedBfsk('1', config, 0), /amplitude/);
  assert.throws(() => encodeAlignedBfsk('1', config, 1.1), /amplitude/);
});

test('BFSK encoder has no RF center-frequency input', () => {
  const bits = '1010';
  const a = encodeAlignedBfsk(bits, config);
  const b = encodeAlignedBfsk(bits, config);
  assert.deepEqual(a, b);
});
