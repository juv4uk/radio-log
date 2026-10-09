import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import {
  bpskDecisionsToBitString,
  decodeAlignedBpsk,
  encodeAlignedBpsk
} from '../.test-build/src/lib/sens-radio/bpsk.js';
import { decodeAlignedBfsk, decisionsToBitString } from '../.test-build/src/lib/sens-radio/bfsk-rx.js';
import { encodeAlignedBfsk } from '../.test-build/src/lib/sens-radio/bfsk-tx.js';
import { resampleLinear } from '../.test-build/src/lib/sens-radio/channel-lab.js';

const bpskConfig = {
  sampleRate: 8000,
  symbolRate: 100,
  carrierHz: 1000
};
const bfskConfig = {
  sampleRate: 8000,
  symbolRate: 100,
  zeroToneHz: 1000,
  oneToneHz: 1500
};

function parseSizes(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const sizes = raw.split(',').map((value) => Number.parseInt(value.trim(), 10));
  if (sizes.length === 0 || sizes.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error(`${name} must be a comma-separated list of positive integers`);
  }
  return sizes;
}

const modemBitSizes = parseSizes('RADIO_GPU_BASELINE_BITS', [1024, 10_000, 100_000]);
const resampleSizes = parseSizes('RADIO_GPU_RESAMPLE_SAMPLES', [1024, 100_000, 1_000_000]);

function deterministicBits(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ((i * 17 + (i >>> 3) + 3) & 1) === 1 ? '1' : '0';
  }
  return out;
}

function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function sha256Float64(array) {
  return createHash('sha256')
    .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    .digest('hex');
}

function measureDecode(modem, bits) {
  let samples;
  let decode;
  let toBits;

  if (modem === 'bpsk') {
    samples = encodeAlignedBpsk(bits, bpskConfig);
    decode = () => decodeAlignedBpsk(samples, bpskConfig);
    toBits = (decisions) => bpskDecisionsToBitString(decisions, 0);
  } else if (modem === 'bfsk') {
    samples = encodeAlignedBfsk(bits, bfskConfig);
    decode = () => decodeAlignedBfsk(samples, bfskConfig);
    toBits = (decisions) => decisionsToBitString(decisions, 0);
  } else {
    throw new Error(`unsupported modem ${modem}`);
  }

  const started = performance.now();
  const decisions = decode();
  const elapsedMs = performance.now() - started;
  const recovered = toBits(decisions);

  if (recovered !== bits) {
    throw new Error(`${modem}: CPU oracle lost exact bit identity at ${bits.length} bits`);
  }

  return {
    candidate: `${modem}-aligned-decode`,
    bit_count: bits.length,
    samples_per_symbol: samples.length / bits.length,
    sample_count: samples.length,
    input_bytes: samples.byteLength,
    decision_count: decisions.length,
    cpu_decode_ms: elapsedMs,
    exact_bit_identity: true,
    corpus_sha256: sha256Text(bits),
    waveform_sha256_native_f64: sha256Float64(samples)
  };
}

function deterministicSignal(length) {
  const samples = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] =
      0.6 * Math.sin((2 * Math.PI * i) / 97) +
      0.2 * Math.cos((2 * Math.PI * i) / 31);
  }
  return samples;
}

function measureResample(sampleCount) {
  const input = deterministicSignal(sampleCount);
  const factor = 1.003;
  const started = performance.now();
  const output = resampleLinear(input, factor);
  const elapsedMs = performance.now() - started;

  return {
    candidate: 'linear-resample',
    input_samples: input.length,
    output_samples: output.length,
    input_bytes: input.byteLength,
    output_bytes: output.byteLength,
    factor,
    cpu_ms: elapsedMs,
    input_sha256_native_f64: sha256Float64(input),
    output_sha256_native_f64: sha256Float64(output),
    parity_status: 'CPU_REFERENCE_ONLY_FLOAT_RELATION_NOT_RATIFIED'
  };
}

const rows = [];
for (const bitCount of modemBitSizes) {
  const bits = deterministicBits(bitCount);
  rows.push(measureDecode('bpsk', bits));
  rows.push(measureDecode('bfsk', bits));
}
for (const sampleCount of resampleSizes) {
  rows.push(measureResample(sampleCount));
}

const report = {
  schema: 'radio-log/sens-radio-gpu-cpu-baseline/v1',
  generated_by: 'scripts/sens-radio-gpu-cpu-baseline.mjs',
  gpu_executed: false,
  purpose: 'CPU oracle and transfer/work-size evidence before CML GPU admission',
  modem_bit_sizes: modemBitSizes,
  resample_sample_sizes: resampleSizes,
  warning:
    'Timing is host-sensitive. Exact modem bit identity and corpus provenance are the correctness authority; resample float parity is not yet ratified.',
  rows
};

await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/sens-radio-gpu-cpu-baseline.json',
  JSON.stringify(report, null, 2) + '\n',
  'utf8'
);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
