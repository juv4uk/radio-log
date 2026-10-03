import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LAB_LOOPBACK_PROFILE,
  SensRadioLoopbackTransport,
  UA_AMATEUR_OPEN_PROFILE,
  UA_SRD_433_SIM_PROFILE,
  UA_SRD_868_SIM_PROFILE,
  assertSensRadioProfilePolicy
} from '../.test-build/src/lib/sens-radio/profiles.js';
import { decodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const payload = '001000101101';

test('different RF profile frequencies carry byte-identical SENS frames', () => {
  const evidence = [];
  const radio433 = new SensRadioLoopbackTransport(UA_SRD_433_SIM_PROFILE);
  const radio868 = new SensRadioLoopbackTransport(UA_SRD_868_SIM_PROFILE);
  radio433.subscribe((value) => evidence.push(value));
  radio868.subscribe((value) => evidence.push(value));

  const raw433 = radio433.send({ bits: payload, encrypted: false });
  const raw868 = radio868.send({ bits: payload, encrypted: false });

  assert.notEqual(UA_SRD_433_SIM_PROFILE.centerFrequencyHz, UA_SRD_868_SIM_PROFILE.centerFrequencyHz);
  assert.deepEqual(raw433, raw868);
  assert.equal(decodeSensRadioFrame(raw433).bits, payload);
  assert.equal(decodeSensRadioFrame(raw868).bits, payload);

  assert.deepEqual(
    evidence.map((item) => item.profileId),
    ['ua-srd-433-data-candidate', 'ua-srd-868-data-candidate']
  );
  assert.deepEqual(
    evidence.map((item) => item.centerFrequencyHz),
    [433_920_000, 868_300_000]
  );
  assert.deepEqual(evidence.map((item) => item.decoded.bits), [payload, payload]);
});

test('RF profile metadata does not enter decoded SENS identity', () => {
  const radio = new SensRadioLoopbackTransport(UA_SRD_433_SIM_PROFILE);
  const raw = radio.send({ bits: '000101', encrypted: false });
  const decoded = decodeSensRadioFrame(raw);

  assert.equal('profileId' in decoded, false);
  assert.equal('centerFrequencyHz' in decoded, false);
  assert.equal(decoded.bits, '000101');
});

test('amateur-open profile fails closed on encrypted payloads', () => {
  assert.throws(
    () => assertSensRadioProfilePolicy(UA_AMATEUR_OPEN_PROFILE, true),
    /forbids encrypted payloads/
  );
  assert.doesNotThrow(() => assertSensRadioProfilePolicy(UA_AMATEUR_OPEN_PROFILE, false));
});

test('candidate SRD profiles do not assume encrypted transport is lawful', () => {
  assert.throws(
    () => assertSensRadioProfilePolicy(UA_SRD_433_SIM_PROFILE, true),
    /requires legal validation/
  );

  const validated = {
    ...UA_SRD_433_SIM_PROFILE,
    status: 'operator-validated'
  };
  assert.doesNotThrow(() => assertSensRadioProfilePolicy(validated, true));
});

test('lab loopback may exercise encrypted higher-layer payloads without RF', () => {
  assert.doesNotThrow(() => assertSensRadioProfilePolicy(LAB_LOOPBACK_PROFILE, true));
  const radio = new SensRadioLoopbackTransport(LAB_LOOPBACK_PROFILE);
  const raw = radio.send({ bits: payload, encrypted: true });
  assert.equal(decodeSensRadioFrame(raw).bits, payload);
});
