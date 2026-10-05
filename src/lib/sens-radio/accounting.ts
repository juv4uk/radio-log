import { SENS_RADIO_CRC_BYTES, SENS_RADIO_HEADER_BYTES } from './frame.js';

export type SensRadioCarrierMode = 'exact-bitstream' | 'byte-container';

export interface SensRadioBitAccountingOptions {
  readonly carrierMode?: SensRadioCarrierMode;
  readonly framingBits?: number;
  readonly integrityBits?: number;
  readonly profileOverheadBits?: number;
  readonly rawBitRate?: number | null;
}

/**
 * Спільна machine-readable межа з juv4uk/sens#3605.
 *
 * Snake_case тут свідомий: ці поля мають без перейменування входити у
 * міжрепозиторний STORE -> AIR evidence, а не бути ще однією локальною схемою.
 */
export interface SensRadioBitAccounting {
  readonly semantic_payload_bits: number;
  readonly storage_container_bits: number;
  readonly tail_unused_bits: number;
  readonly carrier_mode: SensRadioCarrierMode;
  readonly carrier_payload_bits: number;
  readonly framing_bits: number;
  readonly integrity_bits: number;
  readonly profile_overhead_bits: number;
  readonly total_wire_bits: number;
  readonly physical_container_bytes: number;
  readonly payload_utilization: number | null;
  readonly ideal_airtime_seconds: number | null;
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}

function assertRawBitRate(value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value <= 0)) {
    throw new Error('rawBitRate must be a positive finite number or null');
  }
}

/**
 * Рахує фізичні наслідки вже відомої semantic bit length.
 *
 * Важлива межа:
 * - storage container завжди округлюється до байта;
 * - exact-bitstream carrier НЕ успадковує цей tail;
 * - byte-container carrier явно переносить повний контейнер.
 */
export function createSensRadioBitAccounting(
  semanticPayloadBits: number,
  options: SensRadioBitAccountingOptions = {}
): SensRadioBitAccounting {
  assertNonNegativeInteger('semanticPayloadBits', semanticPayloadBits);

  const carrierMode = options.carrierMode ?? 'exact-bitstream';
  const framingBits = options.framingBits ?? 0;
  const integrityBits = options.integrityBits ?? 0;
  const profileOverheadBits = options.profileOverheadBits ?? 0;
  const rawBitRate = options.rawBitRate ?? null;

  assertNonNegativeInteger('framingBits', framingBits);
  assertNonNegativeInteger('integrityBits', integrityBits);
  assertNonNegativeInteger('profileOverheadBits', profileOverheadBits);
  assertRawBitRate(rawBitRate);

  const physicalContainerBytes = Math.ceil(semanticPayloadBits / 8);
  const storageContainerBits = physicalContainerBytes * 8;
  const tailUnusedBits = storageContainerBits - semanticPayloadBits;
  const carrierPayloadBits =
    carrierMode === 'exact-bitstream' ? semanticPayloadBits : storageContainerBits;
  const totalWireBits =
    carrierPayloadBits + framingBits + integrityBits + profileOverheadBits;

  return {
    semantic_payload_bits: semanticPayloadBits,
    storage_container_bits: storageContainerBits,
    tail_unused_bits: tailUnusedBits,
    carrier_mode: carrierMode,
    carrier_payload_bits: carrierPayloadBits,
    framing_bits: framingBits,
    integrity_bits: integrityBits,
    profile_overhead_bits: profileOverheadBits,
    total_wire_bits: totalWireBits,
    physical_container_bytes: physicalContainerBytes,
    payload_utilization: totalWireBits === 0 ? null : semanticPayloadBits / totalWireBits,
    ideal_airtime_seconds: rawBitRate === null ? null : totalWireBits / rawBitRate
  };
}

/**
 * Чинний SENS-RADIO v1 frame є byte-oriented: payload container, 10-byte
 * header і 4-byte CRC реально проходять через modem як повні байти.
 */
export function accountSensRadioV1Frame(
  semanticPayloadBits: number,
  rawBitRate: number | null = null,
  profileOverheadBits = 0
): SensRadioBitAccounting {
  return createSensRadioBitAccounting(semanticPayloadBits, {
    carrierMode: 'byte-container',
    framingBits: SENS_RADIO_HEADER_BYTES * 8,
    integrityBits: SENS_RADIO_CRC_BYTES * 8,
    profileOverheadBits,
    rawBitRate
  });
}
