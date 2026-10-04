import { mkdir, writeFile } from 'node:fs/promises';
import { evaluateSensRadioChannel } from '../.test-build/src/lib/sens-radio/channel-lab.js';

const payload = '001000101101';
const cases = [
  { id: 'clean', impairment: { kind: 'clean' } },
  { id: 'awgn-005', impairment: { kind: 'awgn', sigma: 0.05, seed: 20261004 } },
  { id: 'awgn-020', impairment: { kind: 'awgn', sigma: 0.20, seed: 20261004 } },
  { id: 'freq-plus-20', impairment: { kind: 'frequency-offset', offsetHz: 20 } },
  { id: 'freq-plus-50', impairment: { kind: 'frequency-offset', offsetHz: 50 } },
  { id: 'clock-plus-03pct', impairment: { kind: 'sample-rate-scale', factor: 1.003 } },
  { id: 'burst-zero-1', impairment: { kind: 'burst-zero', startSymbol: 20, symbolCount: 1 } },
  { id: 'truncate-1-sample', impairment: { kind: 'truncate', samples: 1 } },
  {
    id: 'edge-noise-1-symbol',
    impairment: { kind: 'edge-noise', leadingSymbols: 1, trailingSymbols: 1, sigma: 0.05, seed: 7 }
  }
];

const rows = cases.map(({ id, impairment }) => ({
  case: id,
  ...evaluateSensRadioChannel(payload, impairment)
}));

const report = {
  schema: 'radio-log/sens-radio-channel-lab/v1',
  generated_by: 'deterministic-channel-lab',
  live_rf: false,
  payload_bits: payload.length,
  rows
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/sens-radio-channel-lab.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
