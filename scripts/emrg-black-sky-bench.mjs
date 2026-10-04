import { mkdir, writeFile } from 'node:fs/promises';
import {
  BLACK_SKY_LAB_PROFILE_A,
  BLACK_SKY_LAB_PROFILE_B,
  countRejectedFrameFaults,
  simulateBlackSkyRoundTrip
} from '../.test-build/src/lib/sens-radio/black-sky.js';
import { encodeSensRadioFrame } from '../.test-build/src/lib/sens-radio/frame.js';

const fixtures = [
  { id: 'leading-zero', bits: '00000001' },
  { id: 'non-byte-aligned', bits: '001000101101' },
  { id: 'mixed-pattern', bits: '000000001111111101010101' }
];

const profiles = [BLACK_SKY_LAB_PROFILE_A, BLACK_SKY_LAB_PROFILE_B];
const rows = [];

for (const fixture of fixtures) {
  const canonicalFrame = encodeSensRadioFrame(fixture.bits);
  const rejectedFaults = countRejectedFrameFaults(canonicalFrame);

  for (const profile of profiles) {
    const result = simulateBlackSkyRoundTrip(fixture.bits, profile);
    rows.push({
      fixture: fixture.id,
      profile: profile.id,
      payload_bits: result.payloadBits,
      frame_bytes: result.frameBytes,
      framed_bits: result.framedBits,
      overhead_ratio: result.payloadBits === 0 ? null : result.framedBits / result.payloadBits,
      waveform_samples: result.waveformSamples,
      simulated_duration_ms: result.simulatedDurationMs,
      minimum_confidence: result.minimumObservedConfidence,
      fault_cases: 4,
      rejected_faults: rejectedFaults,
      payload_identity: result.decodedBits === fixture.bits,
      frame_identity: Buffer.from(result.recoveredFrame).equals(Buffer.from(canonicalFrame))
    });
  }
}

const report = {
  schema: 'radio-log/emrg-black-sky-bench/v1',
  generated_by: 'deterministic-simulator',
  live_rf: false,
  semantic_authority: false,
  note: 'Transport-only fixtures until canonical EMRG semantic fixtures are exported by sens#3111.',
  rows
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/emrg-black-sky.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
