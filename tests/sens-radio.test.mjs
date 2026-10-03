import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LAB_LOOPBACK_PROFILE,
  SensRadioLoopbackTransport,
  UA_AMATEUR_OPEN_PROFILE,
  UA_SRD_433_SIM_PROFILE,
  UA_SRD_868_SIM_PROFILE,
  assertSensRadioProfilePolicy,
  decodeSensRadioFrame,
  encodeSensRadioFrame
} from '../.test-build/src/lib/sens-radio/protocol.js';

function sampleFrame() {
  return {
    version: 1,
    streamId: 0x01020304,
    sequence: 7,
    encrypted: false,
    wire: {
      wireVersion: 1,
      payloadBitLength: 13,
      // MSB-first: 10101010 10100 + three zero transport-tail bits.
      payload: Uint8Array.from([0b10101010, 0b10100000])
    }
  };
}

test('round-trips exact SENS wire bits and wire version through a radio frame', () => {
  const frame = sampleFrame();
  const encoded = encodeSensRadioFrame(frame);
  const decoded = decodeSensRadioFrame(encoded);

  assert.equal(decoded.wire.wireVersion, 1);
  assert.equal(decoded.wire.payloadBitLength, 13);
  assert.deepEqual(decoded.wire.payload, frame.wire.payload);
  assert.equal(decoded.streamId, frame.streamId);
  assert.equal(decoded.sequence, frame.sequence);
  assert.equal(decoded.encrypted, false);
});

test('different simulated RF frequencies carry a byte-identical SENS radio frame', () => {
  const frame = sampleFrame();
  const evidence = [];

  const radio433 = new SensRadioLoopbackTransport(UA_SRD_433_SIM_PROFILE);
  const radio868 = new SensRadioLoopbackTransport(UA_SRD_868_SIM_PROFILE);
  radio433.subscribe((value) => evidence.push(value));
  radio868.subscribe((value) => evidence.push(value));

  const raw433 = radio433.send(frame);
  const raw868 = radio868.send(frame);

  assert.notEqual(UA_SRD_433_SIM_PROFILE.centerFrequencyHz, UA_SRD_868_SIM_PROFILE.centerFrequencyHz);
  assert.deepEqual(raw433, raw868);
  assert.deepEqual(decodeSensRadioFrame(raw433).wire.payload, frame.wire.payload);
  assert.deepEqual(decodeSensRadioFrame(raw868).wire.payload, frame.wire.payload);

  assert.equal(evidence.length, 2);
  assert.deepEqual(
    evidence.map((value) => value.profileId),
    ['ua-srd-433-data-candidate', 'ua-srd-868-data-candidate']
  );
  assert.deepEqual(
    evidence.map((value) => value.centerFrequencyHz),
    [433_920_000, 868_300_000]
  );
});

test('CRC corruption and truncation fail closed', () => {
  const encoded = encodeSensRadioFrame(sampleFrame());

  const corrupt = encoded.slice();
  corrupt[17] ^= 0x01;
  assert.throws(() => decodeSensRadioFrame(corrupt), /CRC mismatch/);

  assert.throws(() => decodeSensRadioFrame(encoded.slice(0, -1)), /length mismatch|truncated/);
});

test('unused final-byte bits are transport space and must be canonical zeroes', () => {
  const frame = sampleFrame();
  frame.wire.payload = Uint8Array.from([0b10101010, 0b10100111]);
  assert.throws(() => encodeSensRadioFrame(frame), /unused tail bits must be zero/);
});

test('radio policy keeps amateur-open and private-capable transports distinct', () => {
  assert.doesNotThrow(() => assertSensRadioProfilePolicy(LAB_LOOPBACK_PROFILE, true));
  assert.throws(
    () => assertSensRadioProfilePolicy(UA_AMATEUR_OPEN_PROFILE, true),
    /forbids encrypted payloads/
  );
  assert.throws(
    () => assertSensRadioProfilePolicy(UA_SRD_433_SIM_PROFILE, true),
    /requires legal validation/
  );
  assert.doesNotThrow(() => assertSensRadioProfilePolicy(UA_AMATEUR_OPEN_PROFILE, false));
});

test('RF profile metadata is evidence, not part of decoded SENS identity', () => {
  const frame = sampleFrame();
  const raw = encodeSensRadioFrame(frame);
  const decoded = decodeSensRadioFrame(raw);

  assert.equal('centerFrequencyHz' in decoded, false);
  assert.equal('profileId' in decoded, false);
  assert.deepEqual(decoded.wire, frame.wire);
});
