export type SensRadioRegulatoryClass = 'lab' | 'srd-candidate' | 'amateur';
export type SensRadioEncryptionPolicy = 'allowed' | 'forbidden' | 'requires-legal-validation';
export type SensRadioCallsignPolicy = 'none' | 'required';

export interface SensWirePayload {
  readonly wireVersion: number;
  /** Exact number of semantic/wire bits carried in payload. */
  readonly payloadBitLength: number;
  /** Packed bytes. Unused low bits in the final byte must be zero. */
  readonly payload: Uint8Array;
}

export interface SensRadioProfile {
  readonly id: string;
  readonly regulatoryClass: SensRadioRegulatoryClass;
  /**
   * RF center frequency for this mechanism profile.
   * null means no RF or operator-selected frequency outside this module.
   */
  readonly centerFrequencyHz: number | null;
  readonly bandwidthHz: number | null;
  readonly modulation: string;
  readonly txEnabled: boolean;
  readonly encryptionPolicy: SensRadioEncryptionPolicy;
  readonly callsignPolicy: SensRadioCallsignPolicy;
  readonly status: 'lab' | 'candidate' | 'operator-validated';
}

export interface SensRadioFrame {
  readonly version: 1;
  readonly streamId: number;
  readonly sequence: number;
  readonly encrypted: boolean;
  readonly wire: SensWirePayload;
}

export interface SensRadioRxEvidence {
  readonly profileId: string;
  readonly centerFrequencyHz: number | null;
  readonly receivedAt: string;
  readonly rawFrame: Uint8Array;
  readonly decoded: SensRadioFrame;
}

const MAGIC_0 = 0x53; // S
const MAGIC_1 = 0x52; // R
const FRAME_VERSION = 1;
const FLAG_ENCRYPTED = 0x01;
const HEADER_BYTES = 17;
const CRC_BYTES = 4;

export const LAB_LOOPBACK_PROFILE: SensRadioProfile = {
  id: 'lab-loopback',
  regulatoryClass: 'lab',
  centerFrequencyHz: null,
  bandwidthHz: null,
  modulation: 'loopback',
  txEnabled: false,
  encryptionPolicy: 'allowed',
  callsignPolicy: 'none',
  status: 'lab'
};

/**
 * Candidate mechanism profiles only. They never authorize real RF transmission.
 * Current spectrum rules must be validated before txEnabled may become true.
 */
export const UA_SRD_433_SIM_PROFILE: SensRadioProfile = {
  id: 'ua-srd-433-data-candidate',
  regulatoryClass: 'srd-candidate',
  centerFrequencyHz: 433_920_000,
  bandwidthHz: 25_000,
  modulation: 'external-modem',
  txEnabled: false,
  encryptionPolicy: 'requires-legal-validation',
  callsignPolicy: 'none',
  status: 'candidate'
};

export const UA_SRD_868_SIM_PROFILE: SensRadioProfile = {
  id: 'ua-srd-868-data-candidate',
  regulatoryClass: 'srd-candidate',
  centerFrequencyHz: 868_300_000,
  bandwidthHz: 25_000,
  modulation: 'external-modem',
  txEnabled: false,
  encryptionPolicy: 'requires-legal-validation',
  callsignPolicy: 'none',
  status: 'candidate'
};

export const UA_AMATEUR_OPEN_PROFILE: SensRadioProfile = {
  id: 'ua-amateur-open',
  regulatoryClass: 'amateur',
  centerFrequencyHz: null,
  bandwidthHz: null,
  modulation: 'operator-selected-open-data',
  txEnabled: false,
  encryptionPolicy: 'forbidden',
  callsignPolicy: 'required',
  status: 'candidate'
};

function assertUint32(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`${field} must be an unsigned 32-bit integer`);
  }
}

function payloadByteLength(payloadBitLength: number): number {
  return Math.ceil(payloadBitLength / 8);
}

function validateWirePayload(wire: SensWirePayload): void {
  if (!Number.isInteger(wire.wireVersion) || wire.wireVersion < 0 || wire.wireVersion > 255) {
    throw new Error('wireVersion must fit one byte');
  }
  assertUint32(wire.payloadBitLength, 'payloadBitLength');
  const expectedBytes = payloadByteLength(wire.payloadBitLength);
  if (wire.payload.length !== expectedBytes) {
    throw new Error('payload byte length does not match payloadBitLength');
  }

  const validTailBits = wire.payloadBitLength % 8;
  if (validTailBits !== 0 && wire.payload.length > 0) {
    // SENS wire bits are packed MSB first. Low unused bits are transport space
    // and must be zero so there is one canonical frame representation.
    const unusedBits = 8 - validTailBits;
    const unusedMask = (1 << unusedBits) - 1;
    if ((wire.payload[wire.payload.length - 1] & unusedMask) !== 0) {
      throw new Error('unused tail bits must be zero');
    }
  }
}

function validatePolicy(profile: SensRadioProfile, frame: SensRadioFrame): void {
  if (frame.encrypted && profile.encryptionPolicy === 'forbidden') {
    throw new Error(`profile ${profile.id} forbids encrypted payloads`);
  }
  if (
    frame.encrypted &&
    profile.encryptionPolicy === 'requires-legal-validation' &&
    profile.status !== 'operator-validated'
  ) {
    throw new Error(`profile ${profile.id} requires legal validation before encrypted transport`);
  }
  if (profile.txEnabled && profile.status !== 'operator-validated') {
    throw new Error(`profile ${profile.id} cannot transmit before operator validation`);
  }
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, false);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

/** Standard CRC-32/ISO-HDLC used only as radio-frame corruption detection. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb8_8320 & mask);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

export function encodeSensRadioFrame(frame: SensRadioFrame): Uint8Array {
  if (frame.version !== FRAME_VERSION) throw new Error('unsupported radio frame version');
  assertUint32(frame.streamId, 'streamId');
  assertUint32(frame.sequence, 'sequence');
  validateWirePayload(frame.wire);

  const output = new Uint8Array(HEADER_BYTES + frame.wire.payload.length + CRC_BYTES);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  output[0] = MAGIC_0;
  output[1] = MAGIC_1;
  output[2] = FRAME_VERSION;
  output[3] = frame.wire.wireVersion;
  output[4] = frame.encrypted ? FLAG_ENCRYPTED : 0;
  writeU32(view, 5, frame.streamId);
  writeU32(view, 9, frame.sequence);
  writeU32(view, 13, frame.wire.payloadBitLength);
  output.set(frame.wire.payload, HEADER_BYTES);
  writeU32(view, output.length - CRC_BYTES, crc32(output.subarray(0, output.length - CRC_BYTES)));
  return output;
}

export function decodeSensRadioFrame(bytes: Uint8Array): SensRadioFrame {
  if (bytes.length < HEADER_BYTES + CRC_BYTES) throw new Error('truncated SENS radio frame');
  if (bytes[0] !== MAGIC_0 || bytes[1] !== MAGIC_1) throw new Error('invalid SENS radio frame magic');
  if (bytes[2] !== FRAME_VERSION) throw new Error('unsupported SENS radio frame version');
  const wireVersion = bytes[3];
  if ((bytes[4] & ~FLAG_ENCRYPTED) !== 0) throw new Error('unknown SENS radio frame flags');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payloadBitLength = readU32(view, 13);
  const expectedPayloadBytes = payloadByteLength(payloadBitLength);
  const expectedLength = HEADER_BYTES + expectedPayloadBytes + CRC_BYTES;
  if (bytes.length !== expectedLength) throw new Error('SENS radio frame length mismatch');

  const expectedCrc = readU32(view, bytes.length - CRC_BYTES);
  const actualCrc = crc32(bytes.subarray(0, bytes.length - CRC_BYTES));
  if (actualCrc !== expectedCrc) throw new Error('SENS radio frame CRC mismatch');

  const payload = bytes.slice(HEADER_BYTES, bytes.length - CRC_BYTES);
  const wire: SensWirePayload = { wireVersion, payloadBitLength, payload };
  validateWirePayload(wire);

  return {
    version: 1,
    streamId: readU32(view, 5),
    sequence: readU32(view, 9),
    encrypted: (bytes[4] & FLAG_ENCRYPTED) !== 0,
    wire
  };
}

export type SensRadioEvidenceHandler = (evidence: SensRadioRxEvidence) => void;

/**
 * Reference transport: no RF. A profile only changes acquisition provenance
 * and policy checks; it never rewrites the encoded SENS radio frame.
 */
export class SensRadioLoopbackTransport {
  private readonly handlers = new Set<SensRadioEvidenceHandler>();

  constructor(readonly profile: SensRadioProfile) {}

  subscribe(handler: SensRadioEvidenceHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(frame: SensRadioFrame): Uint8Array {
    validatePolicy(this.profile, frame);
    const rawFrame = encodeSensRadioFrame(frame);
    const decoded = decodeSensRadioFrame(rawFrame);
    const evidence: SensRadioRxEvidence = {
      profileId: this.profile.id,
      centerFrequencyHz: this.profile.centerFrequencyHz,
      receivedAt: new Date().toISOString(),
      rawFrame: rawFrame.slice(),
      decoded
    };
    for (const handler of this.handlers) handler(evidence);
    return rawFrame;
  }
}

export function assertSensRadioProfilePolicy(profile: SensRadioProfile, encrypted: boolean): void {
  const emptyFrame: SensRadioFrame = {
    version: 1,
    streamId: 0,
    sequence: 0,
    encrypted,
    wire: { wireVersion: 1, payloadBitLength: 0, payload: new Uint8Array() }
  };
  validatePolicy(profile, emptyFrame);
}
