import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountSensRadioV1Frame,
  createSensRadioBitAccounting
} from '../.test-build/src/lib/sens-radio/accounting.js';
import {
  decodeSensRadioFrame,
  encodeSensRadioFrame
} from '../.test-build/src/lib/sens-radio/frame.js';

test('exact-bitstream AIR does not inherit final storage-byte slack', () => {
  const accounting = createSensRadioBitAccounting(7, {
    carrierMode: 'exact-bitstream',
    rawBitRate: 2
  });

  assert.equal(accounting.semantic_payload_bits, 7);
  assert.equal(accounting.storage_container_bits, 8);
  assert.equal(accounting.tail_unused_bits, 1);
  assert.equal(accounting.physical_container_bytes, 1);
  assert.equal(accounting.carrier_payload_bits, 7);
  assert.equal(accounting.total_wire_bits, 7);
  assert.equal(accounting.payload_utilization, 1);
  assert.equal(accounting.ideal_airtime_seconds, 3.5);
});

test('byte-container AIR includes physical tail only when the profile chooses it', () => {
  const accounting = createSensRadioBitAccounting(7, {
    carrierMode: 'byte-container',
    framingBits: 5,
    integrityBits: 3,
    profileOverheadBits: 2,
    rawBitRate: 2
  });

  assert.equal(accounting.semantic_payload_bits, 7);
  assert.equal(accounting.storage_container_bits, 8);
  assert.equal(accounting.carrier_payload_bits, 8);
  assert.equal(accounting.framing_bits, 5);
  assert.equal(accounting.integrity_bits, 3);
  assert.equal(accounting.profile_overhead_bits, 2);
  assert.equal(accounting.total_wire_bits, 18);
  assert.equal(accounting.payload_utilization, 7 / 18);
  assert.equal(accounting.ideal_airtime_seconds, 9);
});

test('SENS-RADIO v1 accounting equals the actual encoded frame size', () => {
  const bits = '001000101101';
  const frame = encodeSensRadioFrame(bits);
  const accounting = accountSensRadioV1Frame(bits.length, 100);

  assert.equal(accounting.semantic_payload_bits, 12);
  assert.equal(accounting.storage_container_bits, 16);
  assert.equal(accounting.tail_unused_bits, 4);
  assert.equal(accounting.framing_bits, 80);
  assert.equal(accounting.integrity_bits, 32);
  assert.equal(accounting.profile_overhead_bits, 0);
  assert.equal(accounting.carrier_mode, 'byte-container');
  assert.equal(accounting.total_wire_bits, frame.length * 8);
  assert.equal(accounting.total_wire_bits, 128);
  assert.equal(accounting.payload_utilization, 12 / 128);
  assert.equal(accounting.ideal_airtime_seconds, 1.28);
});

test('semantic zero suffix survives byte container framing unchanged', () => {
  const bits = '1010000';
  const frame = encodeSensRadioFrame(bits);
  const decoded = decodeSensRadioFrame(frame);
  const accounting = accountSensRadioV1Frame(bits.length, 100);

  assert.equal(decoded.bits, bits);
  assert.equal(accounting.semantic_payload_bits, 7);
  assert.equal(accounting.storage_container_bits, 8);
  assert.equal(accounting.tail_unused_bits, 1);
  assert.equal(accounting.carrier_payload_bits, 8);
  assert.equal(accounting.total_wire_bits, frame.length * 8);
});

test('semantic bit length cannot silently inflate to one byte per exact-width word', () => {
  const exactWordWidths = [2, 3, 2];
  const semanticBits = exactWordWidths.reduce((sum, width) => sum + width, 0);
  const wrongPerWordByteBits = exactWordWidths.length * 8;
  const accounting = createSensRadioBitAccounting(semanticBits, {
    carrierMode: 'exact-bitstream'
  });

  assert.equal(semanticBits, 7);
  assert.equal(accounting.carrier_payload_bits, 7);
  assert.notEqual(accounting.carrier_payload_bits, wrongPerWordByteBits);
});

test('accounting validates physical counts and raw bit rate', () => {
  assert.throws(() => createSensRadioBitAccounting(-1), /non-negative safe integer/);
  assert.throws(
    () => createSensRadioBitAccounting(7, { framingBits: 1.5 }),
    /non-negative safe integer/
  );
  assert.throws(
    () => createSensRadioBitAccounting(7, { rawBitRate: 0 }),
    /positive finite number/
  );
});
