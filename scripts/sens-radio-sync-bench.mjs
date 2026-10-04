import { mkdir, writeFile } from 'node:fs/promises';
import { encodeAlignedBpsk } from '../.test-build/src/lib/sens-radio/bpsk.js';
import { acquireSensRadioFromAlignedBpsk } from '../.test-build/src/lib/sens-radio/frame-sync.js';
import { encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const config = { sampleRate: 8000, symbolRate: 100, carrierHz: 1000 };

function bytesToBits(bytes) {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
}

function invert(samples) {
  return Float64Array.from(samples, (sample) => -sample);
}

const frameA = bytesToBits(encodeSensRadioFrame('001000101101'));
const frameB = bytesToBits(encodeSensRadioFrame('1110001'));

const cases = [
  {
    id: 'garbage-prefix',
    samples: encodeAlignedBpsk('101011' + frameA + '001', config)
  },
  {
    id: 'pi-inverted',
    samples: invert(encodeAlignedBpsk('101' + frameA + '010', config))
  },
  {
    id: 'two-valid-frames',
    samples: encodeAlignedBpsk(frameA + '101010' + frameB, config)
  },
  {
    id: 'silence',
    samples: new Float64Array(80 * 20)
  }
];

const rows = cases.map(({ id, samples }) => {
  const result = acquireSensRadioFromAlignedBpsk(samples, config, 0.95);
  return {
    case: id,
    state: result.state,
    polarity: result.polarity,
    distinct_valid_candidates: result.distinctValidCandidates,
    false_lock_count: result.falseLockCount,
    minimum_candidate_confidence: result.minimumCandidateConfidence,
    payload_identity:
      result.candidate === null ? null : ['001000101101', '1110001'].includes(result.candidate.decoded.bits)
  };
});

const expected = {
  'garbage-prefix': 'LOCKED',
  'pi-inverted': 'LOCKED',
  'two-valid-frames': 'AMBIGUOUS',
  'silence': 'UNLOCKED'
};

for (const row of rows) {
  if (row.state !== expected[row.case]) {
    throw new Error(`${row.case}: expected ${expected[row.case]}, got ${row.state}`);
  }
}

const report = {
  schema: 'radio-log/sens-radio-sync-lab/v1',
  generated_by: 'deterministic-frame-acquisition',
  live_rf: false,
  rows
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/sens-radio-sync-lab.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
