import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSensRadioTransmitReady,
  validateSensRadioChannelProfile
} from '../.test-build/src/lib/sens-radio/profile.js';

test('accepts bearer-neutral audio loopback without an RF frequency', () => {
  assert.doesNotThrow(() => validateSensRadioChannelProfile({
    id: 'lab-loopback',
    kind: 'audio-loopback',
    modulation: '2fsk-audio',
    txPolicy: 'disabled'
  }));
});

test('accepts multiple receive-only RF frequencies without making one canonical', () => {
  for (const centerFrequencyHz of [7_000_000, 144_000_000, 430_000_000]) {
    assert.doesNotThrow(() => validateSensRadioChannelProfile({
      id: `rx-${centerFrequencyHz}`,
      kind: centerFrequencyHz < 30_000_000 ? 'hf-narrowband' : 'vhf-uhf-packet',
      centerFrequencyHz,
      occupiedBandwidthHz: 500,
      symbolRate: 100,
      modulation: '2fsk',
      txPolicy: 'disabled'
    }));
  }
});

test('RF receive profile requires an explicit center frequency', () => {
  assert.throws(() => validateSensRadioChannelProfile({
    id: 'missing-frequency',
    kind: 'sdr-rx',
    modulation: 'external',
    txPolicy: 'disabled'
  }), /center frequency/);
});

test('transmit profile requires explicit authority reference and callsign', () => {
  assert.throws(() => validateSensRadioChannelProfile({
    id: 'tx',
    kind: 'hf-narrowband',
    centerFrequencyHz: 7_000_000,
    modulation: '2fsk',
    txPolicy: 'operator-authorized'
  }), /regulatory authority/);
});

test('transmit readiness requires channel-clear and minimum-power confirmations', () => {
  const profile = {
    id: 'operator-configured',
    kind: 'vhf-uhf-packet',
    centerFrequencyHz: 144_000_000,
    occupiedBandwidthHz: 500,
    symbolRate: 100,
    modulation: '2fsk',
    txPolicy: 'operator-authorized',
    regulatoryAuthority: 'operator-supplied-current-local-rule-reference',
    operatorCallsign: 'TEST'
  };

  assert.throws(() => assertSensRadioTransmitReady(profile, {
    channelClearConfirmed: false,
    minimumNecessaryPowerConfirmed: true
  }), /channel-clear/);

  assert.throws(() => assertSensRadioTransmitReady(profile, {
    channelClearConfirmed: true,
    minimumNecessaryPowerConfirmed: false
  }), /minimum-necessary-power/);

  assert.doesNotThrow(() => assertSensRadioTransmitReady(profile, {
    channelClearConfirmed: true,
    minimumNecessaryPowerConfirmed: true
  }));
});

test('RX-only bearers cannot silently become transmit profiles', () => {
  assert.throws(() => validateSensRadioChannelProfile({
    id: 'sdr-tx-confusion',
    kind: 'sdr-rx',
    centerFrequencyHz: 144_000_000,
    modulation: 'external',
    txPolicy: 'operator-authorized',
    regulatoryAuthority: 'example',
    operatorCallsign: 'TEST'
  }), /cannot declare RF transmit/);
});
