export interface BpskConfig {
  sampleRate: number;
  symbolRate: number;
  carrierHz: number;
}

export interface BpskBitDecision {
  bit: 0 | 1;
  correlation: number;
  normalizedCorrelation: number;
  confidence: number;
}

function validateConfig(config: BpskConfig): number {
  if (!Number.isFinite(config.sampleRate) || config.sampleRate <= 0) {
    throw new Error('sampleRate must be positive');
  }
  if (!Number.isFinite(config.symbolRate) || config.symbolRate <= 0) {
    throw new Error('symbolRate must be positive');
  }
  if (!Number.isFinite(config.carrierHz) || config.carrierHz <= 0) {
    throw new Error('carrier frequency must be positive');
  }
  if (config.carrierHz >= config.sampleRate / 2) {
    throw new Error('BPSK carrier must stay below Nyquist');
  }

  const samplesPerSymbol = config.sampleRate / config.symbolRate;
  if (!Number.isInteger(samplesPerSymbol) || samplesPerSymbol < 8) {
    throw new Error('BPSK requires an integer samples-per-symbol >= 8');
  }
  return samplesPerSymbol;
}

function assertBits(bits: string): void {
  if (!/^[01]*$/.test(bits)) throw new Error('BPSK input must contain only 0 and 1');
}

/**
 * Deterministic slot-aligned laboratory BPSK.
 *
 * bit 1 => +carrier
 * bit 0 => -carrier (pi phase reversal)
 *
 * RF center frequency and hardware are deliberately absent.
 */
export function encodeAlignedBpsk(
  bits: string,
  config: BpskConfig,
  amplitude = 0.8
): Float64Array {
  assertBits(bits);
  const samplesPerSymbol = validateConfig(config);
  if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude > 1) {
    throw new Error('BPSK amplitude must be greater than 0 and at most 1');
  }

  const samples = new Float64Array(bits.length * samplesPerSymbol);
  for (let symbol = 0; symbol < bits.length; symbol += 1) {
    const sign = bits[symbol] === '1' ? 1 : -1;
    const start = symbol * samplesPerSymbol;
    for (let i = 0; i < samplesPerSymbol; i += 1) {
      const globalIndex = start + i;
      const phase = (2 * Math.PI * config.carrierHz * globalIndex) / config.sampleRate;
      samples[globalIndex] = sign * amplitude * Math.cos(phase);
    }
  }
  return samples;
}

/**
 * Slot-aligned coherent BPSK decoder.
 *
 * Synchronization/carrier recovery are outside this laboratory primitive.
 * A zero or weak correlation is ambiguity, not a guessed reliable bit.
 */
export function decodeAlignedBpsk(
  samples: ArrayLike<number>,
  config: BpskConfig
): BpskBitDecision[] {
  const samplesPerSymbol = validateConfig(config);
  if (samples.length % samplesPerSymbol !== 0) {
    throw new Error('BPSK sample length is not an exact number of symbol slots');
  }

  const decisions: BpskBitDecision[] = [];
  for (let start = 0; start < samples.length; start += samplesPerSymbol) {
    let correlation = 0;
    let observedEnergy = 0;
    let referenceEnergy = 0;

    for (let i = 0; i < samplesPerSymbol; i += 1) {
      const globalIndex = start + i;
      const reference = Math.cos(
        (2 * Math.PI * config.carrierHz * globalIndex) / config.sampleRate
      );
      const sample = samples[globalIndex];
      correlation += sample * reference;
      observedEnergy += sample * sample;
      referenceEnergy += reference * reference;
    }

    const denominator = Math.sqrt(observedEnergy * referenceEnergy);
    const normalizedCorrelation = denominator === 0 ? 0 : correlation / denominator;
    const confidence = Math.min(1, Math.abs(normalizedCorrelation));

    decisions.push({
      bit: correlation >= 0 ? 1 : 0,
      correlation,
      normalizedCorrelation,
      confidence
    });
  }

  return decisions;
}

export function bpskDecisionsToBitString(
  decisions: readonly BpskBitDecision[],
  minimumConfidence = 0
): string {
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new Error('minimumConfidence must be between 0 and 1');
  }

  return decisions.map((decision, index) => {
    if (decision.confidence < minimumConfidence) {
      throw new Error(`BPSK low-confidence symbol at index ${index}`);
    }
    return decision.bit === 1 ? '1' : '0';
  }).join('');
}
