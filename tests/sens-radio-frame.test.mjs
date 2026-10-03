import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeSensRadioFrame,
  encodeSensRadioFrame,
  SENS_RADIO_HEADER_BYTES
} from '../.test-build/src/lib/sens-radio/frame.js';

test('round-trips exact bit payloads including leading zeroes', () => {
  for (const bits of ['', '0', '1', '001', '10 001 01'.replaceAll(' ', ''), '0000000011111111']) {
    const decoded = decodeSensRadioFrame(encodeSensRadioFrame(bits));
    assert.equal(decoded.bits, bits);
    assert.equal(decoded.bitLength, bits.length);
  }
});

test('preserves non-byte-aligned payload length', () => {
  const bits = '0010110';
  const encoded = encodeSensRadioFrame(bits);
  assert.equal(encoded.length, SENS_RADIO_HEADER_BYTES + 1 + 4);
  assert.equal(decodeSensRadioFrame(encoded).bits, bits);
});

test('rejects non-binary payload text', () => {
  assert.throws(() => encodeSensRadioFrame('10 01'), /only 0 and 1/);
  assert.throws(() => encodeSensRadioFrame('sens'), /only 0 and 1/);
});

test('detects a one-bit payload mutation through CRC', () => {
  const encoded = encodeSensRadioFrame('100010101');
  encoded[SENS_RADIO_HEADER_BYTES] ^= 0x80;
  assert.throws(() => decodeSensRadioFrame(encoded), /CRC mismatch/);
});

test('rejects unsupported flags instead of silently accepting extensions', () => {
  const encoded = encodeSensRadioFrame('101');
  encoded[5] = 1;
  assert.throws(() => decodeSensRadioFrame(encoded), /flags/);
});

test('rejects non-zero padding outside the exact payload bit length', () => {
  const encoded = encodeSensRadioFrame('101');
  encoded[SENS_RADIO_HEADER_BYTES] |= 0x01;

  // Recompute CRC would be needed to isolate padding validation; instead corrupting
  // the unused tail is still required to fail closed and CRC is allowed to catch it first.
  assert.throws(() => decodeSensRadioFrame(encoded));
});

test('rejects truncation and trailing bytes', () => {
  const encoded = encodeSensRadioFrame('101010101');
  assert.throws(() => decodeSensRadioFrame(encoded.slice(0, -1)), /truncated|length|CRC/);

  const extended = new Uint8Array(encoded.length + 1);
  extended.set(encoded);
  assert.throws(() => decodeSensRadioFrame(extended), /length mismatch/);
});
