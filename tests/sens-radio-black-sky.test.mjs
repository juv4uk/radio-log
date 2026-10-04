import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BLACK_SKY_LAB_PROFILE_A,
  BLACK_SKY_LAB_PROFILE_B,
  bitStringToBytes,
  bytesToBitString,
  countRejectedFrameFaults,
  createDeterministicFrameFaults,
  simulateBlackSkyRoundTrip
} from '../.test-build/src/lib/sens-radio/black-sky.js';
import { decodeSensRadioFrame, encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const fixtures = [
  '00000001',
  '001000101101',
  '101',
  '000000001111111101010101'
];

test('byte/bit helpers preserve exact frame bytes', () => {
  const frame = encodeSensRadioFrame('001000101101');
  assert.deepEqual(bitStringToBytes(bytesToBitString(frame)), frame);
});

test('two distinct laboratory modem profiles recover the same canonical payload', () => {
  for (const bits of fixtures) {
    const a = simulateBlackSkyRoundTrip(bits, BLACK_SKY_LAB_PROFILE_A);
    const b = simulateBlackSkyRoundTrip(bits, BLACK_SKY_LAB_PROFILE_B);

    assert.equal(a.decodedBits, bits);
    assert.equal(b.decodedBits, bits);
    assert.deepEqual(a.recoveredFrame, b.recoveredFrame);
    assert.deepEqual(a.recoveredFrame, encodeSensRadioFrame(bits));
    assert.equal(a.payloadBits, bits.length);
    assert.equal(b.payloadBits, bits.length);
    assert.ok(a.minimumObservedConfidence >= BLACK_SKY_LAB_PROFILE_A.minimumConfidence);
    assert.ok(b.minimumObservedConfidence >= BLACK_SKY_LAB_PROFILE_B.minimumConfidence);
  }
});

test('profile changes affect waveform timing but never SENS frame identity', () => {
  const bits = '001000101101';
  const a = simulateBlackSkyRoundTrip(bits, BLACK_SKY_LAB_PROFILE_A);
  const b = simulateBlackSkyRoundTrip(bits, BLACK_SKY_LAB_PROFILE_B);

  assert.notEqual(a.profileId, b.profileId);
  assert.notEqual(a.waveformSamples, b.waveformSamples);
  assert.notEqual(a.simulatedDurationMs, b.simulatedDurationMs);
  assert.deepEqual(a.recoveredFrame, b.recoveredFrame);
  assert.equal(decodeSensRadioFrame(a.recoveredFrame).bits, bits);
});

test('deterministic frame fault corpus fails closed', () => {
  const frame = encodeSensRadioFrame('001000101101');
  const faults = createDeterministicFrameFaults(frame);

  assert.equal(faults.length, 4);
  assert.equal(countRejectedFrameFaults(frame), faults.length);

  for (const fault of faults) {
    assert.throws(
      () => decodeSensRadioFrame(fault.frame),
      undefined,
      `fault ${fault.id} must be rejected`
    );
  }
});

test('bit helper rejects malformed and non-byte-aligned strings', () => {
  assert.throws(() => bitStringToBytes('10x1'), /only 0 and 1/);
  assert.throws(() => bitStringToBytes('101'), /byte aligned/);
});
