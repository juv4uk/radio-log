import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bpskDecisionsToBitString,
  decodeAlignedBpsk,
  encodeAlignedBpsk
} from '../.test-build/src/lib/sens-radio/bpsk.js';
import { addDeterministicAwgn } from '../.test-build/src/lib/sens-radio/channel-lab.js';
import {
  bitStringToBytes,
  bytesToBitString
} from '../.test-build/src/lib/sens-radio/black-sky.js';
import {
  decodeSensRadioFrame,
  encodeSensRadioFrame
} from '../.test-build/src/lib/sens-radio/frame.js';

const config = {
  sampleRate: 8000,
  symbolRate: 100,
  carrierHz: 1000
};

test('aligned BPSK round-trips raw bits exactly', () => {
  for (const bits of ['0', '1', '001011010001', '00000101']) {
    const samples = encodeAlignedBpsk(bits, config);
    const decisions = decodeAlignedBpsk(samples, config);
    assert.equal(bpskDecisionsToBitString(decisions, 0.95), bits);
  }
});

test('complete SENS-RADIO frame survives BPSK samples exactly', () => {
  const payload = '001000101101';
  const frame = encodeSensRadioFrame(payload);
  const frameBits = bytesToBitString(frame);
  const samples = encodeAlignedBpsk(frameBits, config);
  const receivedBits = bpskDecisionsToBitString(decodeAlignedBpsk(samples, config), 0.95);
  const recoveredFrame = bitStringToBytes(receivedBits);

  assert.deepEqual(recoveredFrame, frame);
  assert.equal(decodeSensRadioFrame(recoveredFrame).bits, payload);
});

test('mild deterministic AWGN keeps exact frame identity', () => {
  const payload = '001000101101';
  const frame = encodeSensRadioFrame(payload);
  const frameBits = bytesToBitString(frame);
  const clean = encodeAlignedBpsk(frameBits, config);
  const noisy = addDeterministicAwgn(clean, 0.20, 20261004);
  const decisions = decodeAlignedBpsk(noisy, config);
  const receivedBits = bpskDecisionsToBitString(decisions, 0.75);
  const recoveredFrame = bitStringToBytes(receivedBits);

  assert.deepEqual(recoveredFrame, frame);
  assert.equal(decodeSensRadioFrame(recoveredFrame).bits, payload);
});

test('silence is explicit low confidence', () => {
  const samples = new Float64Array(config.sampleRate / config.symbolRate);
  const decisions = decodeAlignedBpsk(samples, config);
  assert.equal(decisions[0].confidence, 0);
  assert.throws(
    () => bpskDecisionsToBitString(decisions, 0.2),
    /low-confidence/
  );
});

test('BPSK validation fails closed', () => {
  assert.throws(() => encodeAlignedBpsk('10x1', config), /only 0 and 1/);
  assert.throws(
    () => decodeAlignedBpsk(new Float64Array(79), config),
    /exact number of symbol slots/
  );
  assert.throws(
    () => encodeAlignedBpsk('1', { ...config, carrierHz: 5000 }),
    /Nyquist/
  );
  assert.throws(
    () => encodeAlignedBpsk('1', { ...config, symbolRate: 333 }),
    /integer samples-per-symbol/
  );
});
