import { decodeAlignedBfsk, decisionsToBitString, type BfskRxConfig } from './bfsk-rx.js';
import { encodeAlignedBfsk } from './bfsk-tx.js';
import { accountSensRadioV1Frame, type SensRadioBitAccounting } from './accounting.js';
import { decodeSensRadioFrame, encodeSensRadioFrame } from './frame.js';

export interface SensRadioBlackSkyProfile {
  readonly id: string;
  readonly modem: BfskRxConfig;
  readonly minimumConfidence: number;
}

export interface SensRadioBlackSkyResult {
  readonly profileId: string;
  readonly payloadBits: number;
  readonly frameBytes: number;
  readonly framedBits: number;
  readonly bitAccounting: SensRadioBitAccounting;
  readonly waveformSamples: number;
  readonly simulatedDurationMs: number;
  readonly minimumObservedConfidence: number;
  readonly decodedBits: string;
  readonly recoveredFrame: Uint8Array;
}

export interface SensRadioFrameFault {
  readonly id: 'truncated' | 'trailing-byte' | 'header-bit-flip' | 'payload-bit-flip';
  readonly frame: Uint8Array;
}

export interface SensRadioDeliveryResult {
  readonly attempts: number;
  readonly retries: number;
  readonly droppedAttempts: number;
  readonly totalSimulatedDurationMs: number;
  readonly roundTrip: SensRadioBlackSkyResult;
}

export const BLACK_SKY_LAB_PROFILE_A: SensRadioBlackSkyProfile = {
  id: 'black-sky-lab-100',
  modem: {
    sampleRate: 8_000,
    symbolRate: 100,
    zeroToneHz: 1_000,
    oneToneHz: 1_500
  },
  minimumConfidence: 0.8
};

export const BLACK_SKY_LAB_PROFILE_B: SensRadioBlackSkyProfile = {
  id: 'black-sky-lab-200',
  modem: {
    sampleRate: 12_000,
    symbolRate: 200,
    zeroToneHz: 1_200,
    oneToneHz: 2_400
  },
  minimumConfidence: 0.8
};

export function bytesToBitString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
}

export function bitStringToBytes(bits: string): Uint8Array {
  if (!/^[01]*$/.test(bits)) throw new Error('bit string must contain only 0 and 1');
  if (bits.length % 8 !== 0) throw new Error('bit string length must be byte aligned');
  return Uint8Array.from({ length: bits.length / 8 }, (_, index) =>
    Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)
  );
}

/**
 * Full no-RF reference path:
 *
 * canonical SENS payload bits
 *   -> SENS-RADIO frame bytes
 *   -> aligned BFSK audio samples
 *   -> BFSK decisions
 *   -> recovered frame bytes
 *   -> exact canonical SENS payload bits
 *
 * No tuner frequency, antenna, power or hardware state exists in this function.
 */
export function simulateBlackSkyRoundTrip(
  bits: string,
  profile: SensRadioBlackSkyProfile
): SensRadioBlackSkyResult {
  const frame = encodeSensRadioFrame(bits);
  const framedBits = bytesToBitString(frame);
  const bitAccounting = accountSensRadioV1Frame(bits.length, profile.modem.symbolRate);
  if (bitAccounting.total_wire_bits !== framedBits.length) {
    throw new Error('SENS-RADIO bit accounting does not match encoded frame length');
  }
  const idealAirtimeSeconds = bitAccounting.ideal_airtime_seconds;
  if (idealAirtimeSeconds === null) {
    throw new Error('SENS-RADIO black-sky profile requires a raw bit rate');
  }
  const waveform = encodeAlignedBfsk(framedBits, profile.modem);
  const decisions = decodeAlignedBfsk(waveform, profile.modem);
  const receivedBits = decisionsToBitString(decisions, profile.minimumConfidence);
  const recoveredFrame = bitStringToBytes(receivedBits);
  const decoded = decodeSensRadioFrame(recoveredFrame);

  const minimumObservedConfidence = decisions.length === 0
    ? 1
    : decisions.reduce((minimum, decision) => Math.min(minimum, decision.confidence), 1);

  return {
    profileId: profile.id,
    payloadBits: bits.length,
    frameBytes: frame.length,
    framedBits: framedBits.length,
    bitAccounting,
    waveformSamples: waveform.length,
    simulatedDurationMs: idealAirtimeSeconds * 1_000,
    minimumObservedConfidence,
    decodedBits: decoded.bits,
    recoveredFrame
  };
}

/**
 * Deterministic decoder fault corpus. These mutations are deliberately simple:
 * the benchmark is checking fail-closed framing, not modeling an RF channel.
 */
export function createDeterministicFrameFaults(frame: Uint8Array): SensRadioFrameFault[] {
  if (frame.length < 15) throw new Error('frame is too short for deterministic fault corpus');

  const trailing = new Uint8Array(frame.length + 1);
  trailing.set(frame, 0);
  trailing[trailing.length - 1] = 0x01;

  const headerFlip = frame.slice();
  headerFlip[4] ^= 0x01;

  const payloadFlip = frame.slice();
  payloadFlip[10] ^= 0x80;

  return [
    { id: 'truncated', frame: frame.slice(0, -1) },
    { id: 'trailing-byte', frame: trailing },
    { id: 'header-bit-flip', frame: headerFlip },
    { id: 'payload-bit-flip', frame: payloadFlip }
  ];
}

export function countRejectedFrameFaults(frame: Uint8Array): number {
  let rejected = 0;
  for (const fault of createDeterministicFrameFaults(frame)) {
    try {
      decodeSensRadioFrame(fault.frame);
    } catch {
      rejected += 1;
    }
  }
  return rejected;
}


/**
 * Deterministic loss/retry wrapper for CI.
 *
 * droppedAttempts models whole-attempt loss only. It does not infer or repair
 * any semantic content, and it never changes the payload between attempts.
 */
export function simulateBlackSkyDelivery(
  bits: string,
  profile: SensRadioBlackSkyProfile,
  droppedAttempts = 0,
  maxAttempts = 3
): SensRadioDeliveryResult {
  if (!Number.isInteger(droppedAttempts) || droppedAttempts < 0) {
    throw new Error('droppedAttempts must be a non-negative integer');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer');
  }
  if (droppedAttempts >= maxAttempts) {
    throw new Error('SENS-RADIO delivery exhausted retry budget');
  }

  const attempts = droppedAttempts + 1;
  const roundTrip = simulateBlackSkyRoundTrip(bits, profile);
  return {
    attempts,
    retries: attempts - 1,
    droppedAttempts,
    totalSimulatedDurationMs: roundTrip.simulatedDurationMs * attempts,
    roundTrip
  };
}
