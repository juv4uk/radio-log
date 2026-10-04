import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import {
  bpskDecisionsToBitString,
  decodeAlignedBpsk,
  encodeAlignedBpsk
} from '../.test-build/src/lib/sens-radio/bpsk.js';
import {
  BLACK_SKY_LAB_PROFILE_A,
  bitStringToBytes,
  bytesToBitString
} from '../.test-build/src/lib/sens-radio/black-sky.js';
import { addDeterministicAwgn } from '../.test-build/src/lib/sens-radio/channel-lab.js';
import { decodeAlignedBfsk, decisionsToBitString } from '../.test-build/src/lib/sens-radio/bfsk-rx.js';
import { encodeAlignedBfsk } from '../.test-build/src/lib/sens-radio/bfsk-tx.js';
import { decodeSensRadioFrame, encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const payload = '001000101101';
const frame = encodeSensRadioFrame(payload);
const wireBits = bytesToBitString(frame);

const bpskConfig = {
  sampleRate: 8000,
  symbolRate: 100,
  carrierHz: 1000
};

function minimumConfidence(decisions) {
  return decisions.reduce((m, x) => Math.min(m, x.confidence), 1);
}

function measureBfsk(sigma) {
  const t0 = performance.now();
  const clean = encodeAlignedBfsk(wireBits, BLACK_SKY_LAB_PROFILE_A.modem);
  const samples = sigma === 0 ? clean : addDeterministicAwgn(clean, sigma, 20261004);
  const decisions = decodeAlignedBfsk(samples, BLACK_SKY_LAB_PROFILE_A.modem);
  const receivedBits = decisionsToBitString(decisions, sigma === 0 ? 0.8 : 0.5);
  const recovered = bitStringToBytes(receivedBits);
  const decoded = decodeSensRadioFrame(recovered);
  const t1 = performance.now();

  return {
    modem: 'bfsk',
    awgn_sigma: sigma,
    symbol_rate: BLACK_SKY_LAB_PROFILE_A.modem.symbolRate,
    samples_per_bit: BLACK_SKY_LAB_PROFILE_A.modem.sampleRate / BLACK_SKY_LAB_PROFILE_A.modem.symbolRate,
    waveform_samples: samples.length,
    minimum_confidence: minimumConfidence(decisions),
    occupied_bandwidth_estimate_hz:
      Math.abs(BLACK_SKY_LAB_PROFILE_A.modem.oneToneHz - BLACK_SKY_LAB_PROFILE_A.modem.zeroToneHz) +
      2 * BLACK_SKY_LAB_PROFILE_A.modem.symbolRate,
    decoder_sample_visits: samples.length * 2,
    decoder_trig_evaluations_estimate: samples.length * 4,
    measured_cpu_ms: t1 - t0,
    frame_identity: Buffer.from(recovered).equals(Buffer.from(frame)),
    payload_identity: decoded.bits === payload
  };
}

function measureBpsk(sigma) {
  const t0 = performance.now();
  const clean = encodeAlignedBpsk(wireBits, bpskConfig);
  const samples = sigma === 0 ? clean : addDeterministicAwgn(clean, sigma, 20261004);
  const decisions = decodeAlignedBpsk(samples, bpskConfig);
  const receivedBits = bpskDecisionsToBitString(decisions, sigma === 0 ? 0.95 : 0.5);
  const recovered = bitStringToBytes(receivedBits);
  const decoded = decodeSensRadioFrame(recovered);
  const t1 = performance.now();

  return {
    modem: 'bpsk',
    awgn_sigma: sigma,
    symbol_rate: bpskConfig.symbolRate,
    samples_per_bit: bpskConfig.sampleRate / bpskConfig.symbolRate,
    waveform_samples: samples.length,
    minimum_confidence: minimumConfidence(decisions),
    occupied_bandwidth_estimate_hz: 2 * bpskConfig.symbolRate,
    decoder_sample_visits: samples.length,
    decoder_trig_evaluations_estimate: samples.length,
    measured_cpu_ms: t1 - t0,
    frame_identity: Buffer.from(recovered).equals(Buffer.from(frame)),
    payload_identity: decoded.bits === payload
  };
}

const rows = [
  measureBfsk(0),
  measureBpsk(0),
  measureBfsk(0.20),
  measureBpsk(0.20)
];

for (const row of rows) {
  if (!row.frame_identity || !row.payload_identity) {
    throw new Error(`${row.modem} sigma=${row.awgn_sigma} lost exact frame identity`);
  }
}

const report = {
  schema: 'radio-log/sens-radio-modem-compare/v1',
  generated_by: 'deterministic-modem-comparison',
  live_rf: false,
  payload_bits: payload.length,
  frame_bits: wireBits.length,
  warning: 'CPU timing is host-sensitive; identity and structural work metrics are the regression authority.',
  rows
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/sens-radio-modem-compare.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
