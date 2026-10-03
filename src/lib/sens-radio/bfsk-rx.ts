export interface BfskRxConfig {
  sampleRate: number;
  symbolRate: number;
  zeroToneHz: number;
  oneToneHz: number;
}

export interface BfskBitDecision {
  bit: 0 | 1;
  zeroEnergy: number;
  oneEnergy: number;
  confidence: number;
}

function validateConfig(config: BfskRxConfig): number {
  if (!Number.isFinite(config.sampleRate) || config.sampleRate <= 0) throw new Error('sampleRate must be positive');
  if (!Number.isFinite(config.symbolRate) || config.symbolRate <= 0) throw new Error('symbolRate must be positive');
  if (!Number.isFinite(config.zeroToneHz) || !Number.isFinite(config.oneToneHz)) throw new Error('tone frequency must be finite');
  if (config.zeroToneHz <= 0 || config.oneToneHz <= 0) throw new Error('tone frequency must be positive');
  if (config.zeroToneHz === config.oneToneHz) throw new Error('BFSK tones must differ');

  const samplesPerSymbol = config.sampleRate / config.symbolRate;
  if (!Number.isInteger(samplesPerSymbol) || samplesPerSymbol < 8) {
    throw new Error('BFSK receiver requires an integer samples-per-symbol >= 8');
  }
  if (Math.max(config.zeroToneHz, config.oneToneHz) >= config.sampleRate / 2) {
    throw new Error('BFSK tone must stay below Nyquist');
  }
  return samplesPerSymbol;
}

function toneEnergy(samples: ArrayLike<number>, start: number, length: number, sampleRate: number, toneHz: number): number {
  let real = 0;
  let imag = 0;
  for (let i = 0; i < length; i += 1) {
    const angle = (2 * Math.PI * toneHz * i) / sampleRate;
    const sample = samples[start + i];
    real += sample * Math.cos(angle);
    imag -= sample * Math.sin(angle);
  }
  return real * real + imag * imag;
}

/**
 * Decode already slot-aligned audio into raw bits.
 *
 * Synchronization, framing, CRC and semantic interpretation deliberately live
 * outside this function. This receiver never repairs or shifts the bitstream.
 */
export function decodeAlignedBfsk(
  samples: ArrayLike<number>,
  config: BfskRxConfig
): BfskBitDecision[] {
  const samplesPerSymbol = validateConfig(config);
  if (samples.length % samplesPerSymbol !== 0) {
    throw new Error('BFSK sample length is not an exact number of symbol slots');
  }

  const decisions: BfskBitDecision[] = [];
  for (let start = 0; start < samples.length; start += samplesPerSymbol) {
    const zeroEnergy = toneEnergy(samples, start, samplesPerSymbol, config.sampleRate, config.zeroToneHz);
    const oneEnergy = toneEnergy(samples, start, samplesPerSymbol, config.sampleRate, config.oneToneHz);
    const total = zeroEnergy + oneEnergy;
    const confidence = total === 0 ? 0 : Math.abs(oneEnergy - zeroEnergy) / total;
    decisions.push({
      bit: oneEnergy > zeroEnergy ? 1 : 0,
      zeroEnergy,
      oneEnergy,
      confidence
    });
  }
  return decisions;
}

export function decisionsToBitString(decisions: readonly BfskBitDecision[], minimumConfidence = 0): string {
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new Error('minimumConfidence must be between 0 and 1');
  }
  return decisions.map((decision, index) => {
    if (decision.confidence < minimumConfidence) {
      throw new Error(`BFSK low-confidence symbol at index ${index}`);
    }
    return decision.bit === 1 ? '1' : '0';
  }).join('');
}
