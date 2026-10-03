export const SENS_RADIO_MAGIC = new Uint8Array([0x53, 0x45, 0x4e, 0x53]); // "SENS"
export const SENS_RADIO_VERSION = 1;
export const SENS_RADIO_HEADER_BYTES = 10;
export const SENS_RADIO_CRC_BYTES = 4;
export const SENS_RADIO_MAX_PAYLOAD_BITS = 1_048_576;

export interface SensRadioFrame {
  version: 1;
  flags: 0;
  bitLength: number;
  bits: string;
}

function assertBits(bits: string): void {
  if (!/^[01]*$/.test(bits)) throw new Error('SENS-RADIO payload must contain only 0 and 1');
  if (bits.length > SENS_RADIO_MAX_PAYLOAD_BITS) throw new Error('SENS-RADIO payload exceeds maximum bit length');
}

function writeU32Be(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function readU32Be(source: Uint8Array, offset: number): number {
  return (
    source[offset] * 0x1000000 +
    (source[offset + 1] << 16) +
    (source[offset + 2] << 8) +
    source[offset + 3]
  ) >>> 0;
}

function packBits(bits: string): Uint8Array {
  const packed = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === '1') packed[i >>> 3] |= 1 << (7 - (i & 7));
  }
  return packed;
}

function unpackBits(bytes: Uint8Array, bitLength: number): string {
  let out = '';
  for (let i = 0; i < bitLength; i += 1) {
    out += ((bytes[i >>> 3] >>> (7 - (i & 7))) & 1) === 1 ? '1' : '0';
  }
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sameMagic(bytes: Uint8Array): boolean {
  return SENS_RADIO_MAGIC.every((value, index) => bytes[index] === value);
}

export function encodeSensRadioFrame(bits: string): Uint8Array {
  assertBits(bits);
  const payload = packBits(bits);
  const body = new Uint8Array(SENS_RADIO_HEADER_BYTES + payload.length);
  body.set(SENS_RADIO_MAGIC, 0);
  body[4] = SENS_RADIO_VERSION;
  body[5] = 0; // public clear frame; reserved flags must remain zero in v1.
  writeU32Be(body, 6, bits.length);
  body.set(payload, SENS_RADIO_HEADER_BYTES);

  const frame = new Uint8Array(body.length + SENS_RADIO_CRC_BYTES);
  frame.set(body, 0);
  writeU32Be(frame, body.length, crc32(body));
  return frame;
}

export function decodeSensRadioFrame(frame: Uint8Array): SensRadioFrame {
  if (frame.length < SENS_RADIO_HEADER_BYTES + SENS_RADIO_CRC_BYTES) {
    throw new Error('SENS-RADIO frame is truncated');
  }
  if (!sameMagic(frame)) throw new Error('SENS-RADIO magic mismatch');
  if (frame[4] !== SENS_RADIO_VERSION) throw new Error('Unsupported SENS-RADIO version');
  if (frame[5] !== 0) throw new Error('Unsupported SENS-RADIO flags');

  const bitLength = readU32Be(frame, 6);
  if (bitLength > SENS_RADIO_MAX_PAYLOAD_BITS) throw new Error('SENS-RADIO payload length exceeds maximum');

  const payloadBytes = Math.ceil(bitLength / 8);
  const expectedLength = SENS_RADIO_HEADER_BYTES + payloadBytes + SENS_RADIO_CRC_BYTES;
  if (frame.length !== expectedLength) throw new Error('SENS-RADIO frame length mismatch');

  const body = frame.subarray(0, expectedLength - SENS_RADIO_CRC_BYTES);
  const expectedCrc = readU32Be(frame, expectedLength - SENS_RADIO_CRC_BYTES);
  if (crc32(body) !== expectedCrc) throw new Error('SENS-RADIO CRC mismatch');

  const payload = frame.subarray(SENS_RADIO_HEADER_BYTES, SENS_RADIO_HEADER_BYTES + payloadBytes);
  const unusedTailBits = payloadBytes * 8 - bitLength;
  if (unusedTailBits > 0 && payloadBytes > 0) {
    const mask = (1 << unusedTailBits) - 1;
    if ((payload[payload.length - 1] & mask) !== 0) {
      throw new Error('SENS-RADIO non-zero tail padding');
    }
  }

  return {
    version: 1,
    flags: 0,
    bitLength,
    bits: unpackBits(payload, bitLength)
  };
}
