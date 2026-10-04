import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireSensRadioFromAlignedBpsk,
  scanSensRadioFrames
} from '../.test-build/src/lib/sens-radio/frame-sync.js';
import { encodeAlignedBpsk } from '../.test-build/src/lib/sens-radio/bpsk.js';
import { encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const config = {
  sampleRate: 8000,
  symbolRate: 100,
  carrierHz: 1000
};

function bytesToBits(bytes) {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
}

function invertSamples(samples) {
  return Float64Array.from(samples, (sample) => -sample);
}

test('bitstream scanner finds an exact frame inside leading/trailing garbage', () => {
  const payload = '001000101101';
  const frameBits = bytesToBits(encodeSensRadioFrame(payload));
  const stream = '101011001' + frameBits + '000111';

  const scan = scanSensRadioFrames(stream);
  assert.equal(scan.candidates.length, 1);
  assert.equal(scan.candidates[0].startBit, 9);
  assert.equal(scan.candidates[0].decoded.bits, payload);
});

test('false magic before the real frame is counted but never accepted', () => {
  const payload = '001000101101';
  const frameBits = bytesToBits(encodeSensRadioFrame(payload));
  const falseMagic = bytesToBits(Uint8Array.from([0x53, 0x45, 0x4e, 0x53])) +
    '00000010' +
    '00000000' +
    '11111111111111111111111111111111';

  const scan = scanSensRadioFrames(falseMagic + '10101' + frameBits);
  assert.equal(scan.candidates.length, 1);
  assert.equal(scan.candidates[0].decoded.bits, payload);
  assert.ok(scan.falseLockCount >= 1);
});

test('BPSK acquisition finds frame after whole-symbol garbage', () => {
  const payload = '001000101101';
  const frameBits = bytesToBits(encodeSensRadioFrame(payload));
  const samples = encodeAlignedBpsk('101011' + frameBits + '001', config);

  const acquired = acquireSensRadioFromAlignedBpsk(samples, config, 0.95);
  assert.equal(acquired.state, 'LOCKED');
  assert.equal(acquired.polarity, 'normal');
  assert.equal(acquired.candidate.decoded.bits, payload);
});

test('BPSK acquisition resolves pi phase inversion through frame validity', () => {
  const payload = '001000101101';
  const frameBits = bytesToBits(encodeSensRadioFrame(payload));
  const clean = encodeAlignedBpsk('101' + frameBits + '010', config);
  const inverted = invertSamples(clean);

  const acquired = acquireSensRadioFromAlignedBpsk(inverted, config, 0.95);
  assert.equal(acquired.state, 'LOCKED');
  assert.equal(acquired.polarity, 'inverted');
  assert.equal(acquired.candidate.decoded.bits, payload);
});

test('two distinct valid frames are explicit ambiguity', () => {
  const a = bytesToBits(encodeSensRadioFrame('001000101101'));
  const b = bytesToBits(encodeSensRadioFrame('1110001'));
  const samples = encodeAlignedBpsk(a + '101010' + b, config);

  const acquired = acquireSensRadioFromAlignedBpsk(samples, config, 0.95);
  assert.equal(acquired.state, 'AMBIGUOUS');
  assert.equal(acquired.distinctValidCandidates, 2);
  assert.equal(acquired.candidate, null);
});

test('noise-only/silence capture remains unlocked', () => {
  const silence = new Float64Array(80 * 20);
  const acquired = acquireSensRadioFromAlignedBpsk(silence, config, 0.2);
  assert.equal(acquired.state, 'UNLOCKED');
  assert.equal(acquired.candidate, null);
});
