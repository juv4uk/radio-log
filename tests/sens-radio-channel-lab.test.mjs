import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeAlignedBfsk } from '../.test-build/src/lib/sens-radio/bfsk-tx.js';
import { BLACK_SKY_LAB_PROFILE_A, bytesToBitString } from '../.test-build/src/lib/sens-radio/black-sky.js';
import { encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';
import {
  addDeterministicAwgn,
  evaluateSensRadioChannel,
  evaluateSensRadioSamples,
  resampleLinear
} from '../.test-build/src/lib/sens-radio/channel-lab.js';

const payload = '001000101101';

test('clean aligned channel preserves exact SENS frame and payload', () => {
  const result = evaluateSensRadioChannel(payload, { kind: 'clean' });
  assert.equal(result.lockState, 'LOCKED');
  assert.equal(result.frameOutcome, 'SUCCESS');
  assert.equal(result.berBeforeCrc, 0);
  assert.equal(result.crcAccepted, true);
  assert.equal(result.payloadIdentity, true);
  assert.equal(result.frameIdentity, true);
  assert.equal(result.falseLockCount, 0);
});

test('mild deterministic AWGN remains decodable without semantic change', () => {
  const result = evaluateSensRadioChannel(payload, { kind: 'awgn', sigma: 0.05, seed: 20261004 });
  assert.equal(result.frameOutcome, 'SUCCESS');
  assert.equal(result.payloadIdentity, true);
  assert.equal(result.frameIdentity, true);
});

test('small deterministic frequency offset may pass only when exact identity survives CRC', () => {
  const result = evaluateSensRadioChannel(payload, { kind: 'frequency-offset', offsetHz: 20 });
  if (result.frameOutcome === 'SUCCESS') {
    assert.equal(result.payloadIdentity, true);
    assert.equal(result.frameIdentity, true);
    assert.equal(result.crcAccepted, true);
  } else {
    assert.equal(result.payloadIdentity, false);
  }
});

test('sample-rate drift that breaks slot alignment reports UNLOCKED', () => {
  const result = evaluateSensRadioChannel(payload, { kind: 'sample-rate-scale', factor: 1.003 });
  assert.equal(result.lockState, 'UNLOCKED');
  assert.equal(result.frameOutcome, 'NOT_REACHED');
  assert.equal(result.crcAccepted, null);
});

test('zeroed symbol becomes AMBIGUOUS rather than an invented reliable bit', () => {
  const result = evaluateSensRadioChannel(payload, {
    kind: 'burst-zero',
    startSymbol: 20,
    symbolCount: 1
  });
  assert.equal(result.lockState, 'AMBIGUOUS');
  assert.equal(result.frameOutcome, 'NOT_REACHED');
});

test('truncated capture fails before semantic decode', () => {
  const result = evaluateSensRadioChannel(payload, { kind: 'truncate', samples: 1 });
  assert.equal(result.lockState, 'UNLOCKED');
  assert.equal(result.frameOutcome, 'NOT_REACHED');
});

test('edge noise can never be reported as successful unless exact frame identity survives', () => {
  const result = evaluateSensRadioChannel(payload, {
    kind: 'edge-noise',
    leadingSymbols: 1,
    trailingSymbols: 1,
    sigma: 0.05,
    seed: 7
  });
  if (result.frameOutcome === 'SUCCESS') {
    assert.equal(result.frameIdentity, true);
    assert.equal(result.payloadIdentity, true);
  } else {
    assert.equal(result.payloadIdentity, false);
  }
});

test('AWGN and resampling helpers are deterministic', () => {
  const source = Float64Array.from([0, 1, 0, -1]);
  assert.deepEqual(
    addDeterministicAwgn(source, 0.1, 42),
    addDeterministicAwgn(source, 0.1, 42)
  );
  assert.deepEqual(resampleLinear(source, 1.5), resampleLinear(source, 1.5));
});

test('all impairment outcomes obey fail-closed semantic law', () => {
  const cases = [
    { kind: 'clean' },
    { kind: 'awgn', sigma: 0.2, seed: 1 },
    { kind: 'frequency-offset', offsetHz: 50 },
    { kind: 'sample-rate-scale', factor: 0.997 },
    { kind: 'burst-zero', startSymbol: 10, symbolCount: 2 },
    { kind: 'truncate', samples: 17 },
    { kind: 'edge-noise', leadingSymbols: 2, trailingSymbols: 2, sigma: 0.1, seed: 9 }
  ];

  for (const impairment of cases) {
    const result = evaluateSensRadioChannel(payload, impairment);
    if (result.frameOutcome === 'SUCCESS') {
      assert.equal(result.payloadIdentity, true, impairment.kind);
      assert.equal(result.frameIdentity, true, impairment.kind);
      assert.equal(result.crcAccepted, true, impairment.kind);
    }
  }
});


test('external sample arrays use the same decoder path and preserve exact identity', () => {
  const frame = encodeSensRadioFrame(payload);
  const wireBits = bytesToBitString(frame);
  const samples = encodeAlignedBfsk(wireBits, BLACK_SKY_LAB_PROFILE_A.modem);
  const result = evaluateSensRadioSamples(payload, samples, BLACK_SKY_LAB_PROFILE_A);

  assert.equal(result.impairment, 'external-samples');
  assert.equal(result.frameOutcome, 'SUCCESS');
  assert.equal(result.payloadIdentity, true);
  assert.equal(result.frameIdentity, true);
  assert.equal(result.berBeforeCrc, 0);
});

test('channel evidence reports transparent bandwidth and decoder-work estimates', () => {
  const result = evaluateSensRadioChannel(payload, { kind: 'clean' });

  assert.equal(
    result.toneSpanHz,
    Math.abs(
      BLACK_SKY_LAB_PROFILE_A.modem.oneToneHz -
      BLACK_SKY_LAB_PROFILE_A.modem.zeroToneHz
    )
  );
  assert.equal(
    result.occupiedBandwidthEstimateHz,
    result.toneSpanHz + 2 * BLACK_SKY_LAB_PROFILE_A.modem.symbolRate
  );
  assert.equal(result.decoderToneSampleVisits, result.sampleCount * 2);
  assert.equal(result.decoderTrigEvaluationsEstimate, result.sampleCount * 4);
});
