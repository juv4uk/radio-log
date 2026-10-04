import { decodeAlignedBfsk, decisionsToBitString } from './bfsk-rx.js';
import { encodeAlignedBfsk } from './bfsk-tx.js';
import {
  BLACK_SKY_LAB_PROFILE_A,
  bitStringToBytes,
  bytesToBitString,
  type SensRadioBlackSkyProfile
} from './black-sky.js';
import { decodeSensRadioFrame, encodeSensRadioFrame } from './frame.js';

export type SensRadioChannelImpairment =
  | { readonly kind: 'clean' }
  | { readonly kind: 'awgn'; readonly sigma: number; readonly seed: number }
  | { readonly kind: 'frequency-offset'; readonly offsetHz: number }
  | { readonly kind: 'sample-rate-scale'; readonly factor: number }
  | { readonly kind: 'burst-zero'; readonly startSymbol: number; readonly symbolCount: number }
  | { readonly kind: 'truncate'; readonly samples: number }
  | {
      readonly kind: 'edge-noise';
      readonly leadingSymbols: number;
      readonly trailingSymbols: number;
      readonly sigma: number;
      readonly seed: number;
    };

export type SensRadioLockState = 'LOCKED' | 'AMBIGUOUS' | 'UNLOCKED';
export type SensRadioFrameOutcome = 'SUCCESS' | 'REJECTED' | 'NOT_REACHED';

export interface SensRadioChannelEvidence {
  readonly impairment: SensRadioChannelImpairment['kind'] | 'external-samples';
  readonly lockState: SensRadioLockState;
  readonly frameOutcome: SensRadioFrameOutcome;
  readonly payloadIdentity: boolean;
  readonly frameIdentity: boolean;
  readonly crcAccepted: boolean | null;
  readonly berBeforeCrc: number | null;
  readonly samplesPerBit: number;
  readonly sampleCount: number;
  readonly minimumConfidence: number | null;
  readonly falseLockCount: number;
  readonly toneSpanHz: number;
  readonly occupiedBandwidthEstimateHz: number;
  readonly decoderToneSampleVisits: number;
  readonly decoderTrigEvaluationsEstimate: number;
  readonly reason: string | null;
}

function samplesPerSymbol(profile: SensRadioBlackSkyProfile): number {
  return profile.modem.sampleRate / profile.modem.symbolRate;
}

function xorshift32(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function gaussianPair(random: () => number): [number, number] {
  let u1 = random();
  const u2 = random();
  if (u1 <= Number.EPSILON) u1 = Number.EPSILON;
  const radius = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [radius * Math.cos(theta), radius * Math.sin(theta)];
}

export function addDeterministicAwgn(
  samples: ArrayLike<number>,
  sigma: number,
  seed: number
): Float64Array {
  if (!Number.isFinite(sigma) || sigma < 0) throw new Error('AWGN sigma must be non-negative');
  if (!Number.isInteger(seed)) throw new Error('AWGN seed must be an integer');

  const random = xorshift32(seed);
  const out = Float64Array.from(samples);
  for (let i = 0; i < out.length; i += 2) {
    const [a, b] = gaussianPair(random);
    out[i] += a * sigma;
    if (i + 1 < out.length) out[i + 1] += b * sigma;
  }
  return out;
}

export function resampleLinear(samples: ArrayLike<number>, factor: number): Float64Array {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('sample-rate scale factor must be positive');
  if (samples.length === 0) return new Float64Array();

  const outputLength = Math.max(1, Math.round(samples.length * factor));
  const out = new Float64Array(outputLength);
  if (outputLength === 1 || samples.length === 1) {
    out[0] = samples[0];
    return out;
  }

  const scale = (samples.length - 1) / (outputLength - 1);
  for (let i = 0; i < outputLength; i += 1) {
    const source = i * scale;
    const left = Math.floor(source);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = source - left;
    out[i] = samples[left] * (1 - mix) + samples[right] * mix;
  }
  return out;
}

function zeroBurst(
  samples: ArrayLike<number>,
  profile: SensRadioBlackSkyProfile,
  startSymbol: number,
  symbolCount: number
): Float64Array {
  if (!Number.isInteger(startSymbol) || startSymbol < 0) throw new Error('startSymbol must be a non-negative integer');
  if (!Number.isInteger(symbolCount) || symbolCount < 1) throw new Error('symbolCount must be a positive integer');

  const out = Float64Array.from(samples);
  const sps = samplesPerSymbol(profile);
  const start = startSymbol * sps;
  const end = Math.min(out.length, start + symbolCount * sps);
  out.fill(0, start, end);
  return out;
}

function edgeNoise(
  samples: ArrayLike<number>,
  profile: SensRadioBlackSkyProfile,
  leadingSymbols: number,
  trailingSymbols: number,
  sigma: number,
  seed: number
): Float64Array {
  if (!Number.isInteger(leadingSymbols) || leadingSymbols < 0) throw new Error('leadingSymbols must be non-negative');
  if (!Number.isInteger(trailingSymbols) || trailingSymbols < 0) throw new Error('trailingSymbols must be non-negative');

  const sps = samplesPerSymbol(profile);
  const leading = addDeterministicAwgn(new Float64Array(leadingSymbols * sps), sigma, seed);
  const trailing = addDeterministicAwgn(new Float64Array(trailingSymbols * sps), sigma, seed ^ 0x5bd1e995);
  const out = new Float64Array(leading.length + samples.length + trailing.length);
  out.set(leading, 0);
  out.set(Float64Array.from(samples), leading.length);
  out.set(trailing, leading.length + samples.length);
  return out;
}

function bitErrorRate(reference: string, candidate: string): number {
  const denominator = Math.max(reference.length, candidate.length);
  if (denominator === 0) return 0;

  let errors = Math.abs(reference.length - candidate.length);
  const overlap = Math.min(reference.length, candidate.length);
  for (let i = 0; i < overlap; i += 1) {
    if (reference[i] !== candidate[i]) errors += 1;
  }
  return errors / denominator;
}

function applyImpairment(
  wireBits: string,
  profile: SensRadioBlackSkyProfile,
  impairment: SensRadioChannelImpairment
): Float64Array {
  let txProfile = profile;
  if (impairment.kind === 'frequency-offset') {
    txProfile = {
      ...profile,
      modem: {
        ...profile.modem,
        zeroToneHz: profile.modem.zeroToneHz + impairment.offsetHz,
        oneToneHz: profile.modem.oneToneHz + impairment.offsetHz
      }
    };
  }

  let samples = encodeAlignedBfsk(wireBits, txProfile.modem);

  switch (impairment.kind) {
    case 'clean':
    case 'frequency-offset':
      return samples;
    case 'awgn':
      return addDeterministicAwgn(samples, impairment.sigma, impairment.seed);
    case 'sample-rate-scale':
      return resampleLinear(samples, impairment.factor);
    case 'burst-zero':
      return zeroBurst(samples, profile, impairment.startSymbol, impairment.symbolCount);
    case 'truncate':
      if (!Number.isInteger(impairment.samples) || impairment.samples < 1) {
        throw new Error('truncate samples must be a positive integer');
      }
      return samples.slice(0, Math.max(0, samples.length - impairment.samples));
    case 'edge-noise':
      return edgeNoise(
        samples,
        profile,
        impairment.leadingSymbols,
        impairment.trailingSymbols,
        impairment.sigma,
        impairment.seed
      );
  }
}

function analyzeReceivedSamples(
  payloadBits: string,
  frame: Uint8Array,
  wireBits: string,
  samples: ArrayLike<number>,
  profile: SensRadioBlackSkyProfile,
  impairment: SensRadioChannelEvidence['impairment']
): SensRadioChannelEvidence {
  const sps = samplesPerSymbol(profile);
  const sampleCount = samples.length;
  const toneSpanHz = Math.abs(profile.modem.oneToneHz - profile.modem.zeroToneHz);
  const occupiedBandwidthEstimateHz = toneSpanHz + 2 * profile.modem.symbolRate;
  const decoderToneSampleVisits = sampleCount * 2;
  const decoderTrigEvaluationsEstimate = sampleCount * 4;

  const common = {
    impairment,
    samplesPerBit: sps,
    sampleCount,
    toneSpanHz,
    occupiedBandwidthEstimateHz,
    decoderToneSampleVisits,
    decoderTrigEvaluationsEstimate
  } as const;

  let decisions;
  try {
    decisions = decodeAlignedBfsk(samples, profile.modem);
  } catch (error) {
    return {
      ...common,
      lockState: 'UNLOCKED',
      frameOutcome: 'NOT_REACHED',
      payloadIdentity: false,
      frameIdentity: false,
      crcAccepted: null,
      berBeforeCrc: null,
      minimumConfidence: null,
      falseLockCount: 0,
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  const minimumConfidence = decisions.length === 0
    ? 1
    : decisions.reduce((minimum, decision) => Math.min(minimum, decision.confidence), 1);

  let receivedBits: string;
  try {
    receivedBits = decisionsToBitString(decisions, profile.minimumConfidence);
  } catch (error) {
    return {
      ...common,
      lockState: 'AMBIGUOUS',
      frameOutcome: 'NOT_REACHED',
      payloadIdentity: false,
      frameIdentity: false,
      crcAccepted: null,
      berBeforeCrc: null,
      minimumConfidence,
      falseLockCount: 0,
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  const berBeforeCrc = bitErrorRate(wireBits, receivedBits);

  let recoveredFrame: Uint8Array;
  try {
    recoveredFrame = bitStringToBytes(receivedBits);
  } catch (error) {
    return {
      ...common,
      lockState: 'LOCKED',
      frameOutcome: 'REJECTED',
      payloadIdentity: false,
      frameIdentity: false,
      crcAccepted: false,
      berBeforeCrc,
      minimumConfidence,
      falseLockCount: 1,
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  try {
    const decoded = decodeSensRadioFrame(recoveredFrame);
    const frameIdentity = recoveredFrame.length === frame.length &&
      recoveredFrame.every((byte, index) => byte === frame[index]);
    const payloadIdentity = decoded.bits === payloadBits;

    if (!frameIdentity || !payloadIdentity) {
      return {
        ...common,
        lockState: 'LOCKED',
        frameOutcome: 'REJECTED',
        payloadIdentity,
        frameIdentity,
        crcAccepted: true,
        berBeforeCrc,
        minimumConfidence,
        falseLockCount: 1,
        reason: 'decoded frame did not preserve exact identity'
      };
    }

    return {
      ...common,
      lockState: 'LOCKED',
      frameOutcome: 'SUCCESS',
      payloadIdentity: true,
      frameIdentity: true,
      crcAccepted: true,
      berBeforeCrc,
      minimumConfidence,
      falseLockCount: 0,
      reason: null
    };
  } catch (error) {
    return {
      ...common,
      lockState: 'LOCKED',
      frameOutcome: 'REJECTED',
      payloadIdentity: false,
      frameIdentity: false,
      crcAccepted: false,
      berBeforeCrc,
      minimumConfidence,
      falseLockCount: 1,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

export function evaluateSensRadioSamples(
  payloadBits: string,
  samples: ArrayLike<number>,
  profile: SensRadioBlackSkyProfile = BLACK_SKY_LAB_PROFILE_A
): SensRadioChannelEvidence {
  const frame = encodeSensRadioFrame(payloadBits);
  const wireBits = bytesToBitString(frame);
  return analyzeReceivedSamples(payloadBits, frame, wireBits, samples, profile, 'external-samples');
}

export function evaluateSensRadioChannel(
  payloadBits: string,
  impairment: SensRadioChannelImpairment,
  profile: SensRadioBlackSkyProfile = BLACK_SKY_LAB_PROFILE_A
): SensRadioChannelEvidence {
  const frame = encodeSensRadioFrame(payloadBits);
  const wireBits = bytesToBitString(frame);
  const samples = applyImpairment(wireBits, profile, impairment);
  return analyzeReceivedSamples(payloadBits, frame, wireBits, samples, profile, impairment.kind);
}
