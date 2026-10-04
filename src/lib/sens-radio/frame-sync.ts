import {
  SENS_RADIO_CRC_BYTES,
  SENS_RADIO_HEADER_BYTES,
  SENS_RADIO_MAGIC,
  SENS_RADIO_MAX_PAYLOAD_BITS,
  decodeSensRadioFrame,
  type SensRadioFrame
} from './frame.js';
import {
  decodeAlignedBpsk,
  type BpskConfig,
  type BpskBitDecision
} from './bpsk.js';

export interface SensRadioFrameCandidate {
  readonly startBit: number;
  readonly endBit: number;
  readonly frameBytes: Uint8Array;
  readonly decoded: SensRadioFrame;
}

export interface SensRadioFrameScan {
  readonly candidates: readonly SensRadioFrameCandidate[];
  readonly falseLockCount: number;
}

export type SensRadioAcquireState = 'LOCKED' | 'AMBIGUOUS' | 'UNLOCKED';

export interface SensRadioBpskAcquisition {
  readonly state: SensRadioAcquireState;
  readonly polarity: 'normal' | 'inverted' | null;
  readonly candidate: SensRadioFrameCandidate | null;
  readonly distinctValidCandidates: number;
  readonly falseLockCount: number;
  readonly minimumCandidateConfidence: number | null;
}

function byteToBits(byte: number): string {
  return byte.toString(2).padStart(8, '0');
}

function bytesToBits(bytes: Uint8Array): string {
  return Array.from(bytes, byteToBits).join('');
}

function bitsToBytes(bits: string): Uint8Array {
  if (!/^[01]*$/.test(bits)) throw new Error('bit stream must contain only 0 and 1');
  if (bits.length % 8 !== 0) throw new Error('candidate frame must be byte aligned');
  return Uint8Array.from({ length: bits.length / 8 }, (_, index) =>
    Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)
  );
}

function readU32Bits(bits: string, start: number): number {
  return Number.parseInt(bits.slice(start, start + 32), 2) >>> 0;
}

const MAGIC_BITS = bytesToBits(SENS_RADIO_MAGIC);
const HEADER_BITS = SENS_RADIO_HEADER_BYTES * 8;
const CRC_BITS = SENS_RADIO_CRC_BYTES * 8;

export function scanSensRadioFrames(bits: string): SensRadioFrameScan {
  if (!/^[01]*$/.test(bits)) throw new Error('bit stream must contain only 0 and 1');

  const candidates: SensRadioFrameCandidate[] = [];
  let falseLockCount = 0;

  for (let start = 0; start <= bits.length - MAGIC_BITS.length; start += 1) {
    if (bits.slice(start, start + MAGIC_BITS.length) !== MAGIC_BITS) continue;

    if (bits.length - start < HEADER_BITS + CRC_BITS) {
      falseLockCount += 1;
      continue;
    }

    const payloadBitLength = readU32Bits(bits, start + 48);
    if (payloadBitLength > SENS_RADIO_MAX_PAYLOAD_BITS) {
      falseLockCount += 1;
      continue;
    }

    const payloadBytes = Math.ceil(payloadBitLength / 8);
    const frameBitLength = (SENS_RADIO_HEADER_BYTES + payloadBytes + SENS_RADIO_CRC_BYTES) * 8;
    if (bits.length - start < frameBitLength) {
      falseLockCount += 1;
      continue;
    }

    const candidateBits = bits.slice(start, start + frameBitLength);
    try {
      const frameBytes = bitsToBytes(candidateBits);
      const decoded = decodeSensRadioFrame(frameBytes);
      candidates.push({
        startBit: start,
        endBit: start + frameBitLength,
        frameBytes,
        decoded
      });
    } catch {
      falseLockCount += 1;
    }
  }

  return { candidates, falseLockCount };
}

function decisionBits(decisions: readonly BpskBitDecision[], inverted: boolean): string {
  return decisions.map((decision) => {
    const bit = decision.bit === 1 ? '1' : '0';
    if (!inverted) return bit;
    return bit === '1' ? '0' : '1';
  }).join('');
}

function candidateConfidence(
  decisions: readonly BpskBitDecision[],
  candidate: SensRadioFrameCandidate
): number {
  let minimum = 1;
  for (let i = candidate.startBit; i < candidate.endBit; i += 1) {
    minimum = Math.min(minimum, decisions[i]?.confidence ?? 0);
  }
  return minimum;
}

function frameKey(candidate: SensRadioFrameCandidate): string {
  return Array.from(candidate.frameBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Acquire a complete SENS-RADIO frame from a slot-aligned BPSK capture.
 *
 * The decoder explicitly tries both coherent phase polarities. CRC-valid frame
 * identity resolves a single candidate; multiple distinct valid frames remain
 * AMBIGUOUS rather than being guessed away.
 */
export function acquireSensRadioFromAlignedBpsk(
  samples: ArrayLike<number>,
  config: BpskConfig,
  minimumConfidence = 0.2
): SensRadioBpskAcquisition {
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new Error('minimumConfidence must be between 0 and 1');
  }

  const decisions = decodeAlignedBpsk(samples, config);
  const accepted: Array<{
    polarity: 'normal' | 'inverted';
    candidate: SensRadioFrameCandidate;
    confidence: number;
  }> = [];
  let falseLockCount = 0;

  for (const polarity of ['normal', 'inverted'] as const) {
    const scan = scanSensRadioFrames(decisionBits(decisions, polarity === 'inverted'));
    falseLockCount += scan.falseLockCount;

    for (const candidate of scan.candidates) {
      const confidence = candidateConfidence(decisions, candidate);
      if (confidence >= minimumConfidence) {
        accepted.push({ polarity, candidate, confidence });
      } else {
        falseLockCount += 1;
      }
    }
  }

  const distinct = new Map<string, typeof accepted[number]>();
  for (const item of accepted) {
    const key = frameKey(item.candidate);
    if (!distinct.has(key)) distinct.set(key, item);
  }

  if (distinct.size === 0) {
    return {
      state: 'UNLOCKED',
      polarity: null,
      candidate: null,
      distinctValidCandidates: 0,
      falseLockCount,
      minimumCandidateConfidence: null
    };
  }

  if (distinct.size > 1) {
    return {
      state: 'AMBIGUOUS',
      polarity: null,
      candidate: null,
      distinctValidCandidates: distinct.size,
      falseLockCount,
      minimumCandidateConfidence: null
    };
  }

  const only = [...distinct.values()][0];
  return {
    state: 'LOCKED',
    polarity: only.polarity,
    candidate: only.candidate,
    distinctValidCandidates: 1,
    falseLockCount,
    minimumCandidateConfidence: only.confidence
  };
}
