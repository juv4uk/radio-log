import type { BfskRxConfig } from './bfsk-rx.js';

export type BfskTxConfig = BfskRxConfig;

function validateConfig(config: BfskTxConfig): number {
  if (!Number.isFinite(config.sampleRate) || config.sampleRate <= 0) throw new Error('sampleRate must be positive');
  if (!Number.isFinite(config.symbolRate) || config.symbolRate <= 0) throw new Error('symbolRate must be positive');
  if (!Number.isFinite(config.zeroToneHz) || !Number.isFinite(config.oneToneHz)) throw new Error('tone frequency must be finite');
  if (config.zeroToneHz <= 0 || config.oneToneHz <= 0) throw new Error('tone frequency must be positive');
  if (config.zeroToneHz === config.oneToneHz) throw new Error('BFSK tones must differ');

  const samplesPerSymbol = config.sampleRate / config.symbolRate;
  if (!Number.isInteger(samplesPerSymbol) || samplesPerSymbol < 8) {
    throw new Error('BFSK transmitter requires an integer samples-per-symbol >= 8');
  }
  if (Math.max(config.zeroToneHz, config.oneToneHz) >= config.sampleRate / 2) {
    throw new Error('BFSK tone must stay below Nyquist');
  }
  return samplesPerSymbol;
}

function assertBits(bits: string): void {
  if (!/^[01]*$/.test(bits)) throw new Error('BFSK input must contain only 0 and 1');
}

/**
 * Deterministic aligned BFSK laboratory encoder.
 *
 * It produces baseband/audio samples only. RF center frequency, power,
 * regulatory profile and hardware are deliberately outside this function.
 */
export function encodeAlignedBfsk(
  bits: string,
  config: BfskTxConfig,
  amplitude = 0.8
): Float64Array {
  assertBits(bits);
  const samplesPerSymbol = validateConfig(config);
  if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude > 1) {
    throw new Error('BFSK amplitude must be greater than 0 and at most 1');
  }

  const samples = new Float64Array(bits.length * samplesPerSymbol);
  let phase = 0;
  for (let symbol = 0; symbol < bits.length; symbol += 1) {
    const tone = bits[symbol] === '1' ? config.oneToneHz : config.zeroToneHz;
    const phaseStep = (2 * Math.PI * tone) / config.sampleRate;
    const start = symbol * samplesPerSymbol;
    for (let i = 0; i < samplesPerSymbol; i += 1) {
      samples[start + i] = amplitude * Math.sin(phase);
      phase += phaseStep;
      if (phase >= 2 * Math.PI) phase %= 2 * Math.PI;
    }
  }
  return samples;
}
