import { decodeSensRadioFrame, encodeSensRadioFrame, type SensRadioFrame } from './frame.js';

export type SensRadioRegulatoryClass = 'lab' | 'srd-candidate' | 'amateur';
export type SensRadioEncryptionPolicy = 'allowed' | 'forbidden' | 'requires-legal-validation';
export type SensRadioCallsignPolicy = 'none' | 'required';

export interface SensRadioProfile {
  readonly id: string;
  readonly regulatoryClass: SensRadioRegulatoryClass;
  /** null means no RF or a frequency selected/validated outside this module. */
  readonly centerFrequencyHz: number | null;
  readonly bandwidthHz: number | null;
  readonly modulation: string;
  /** False for every profile in the current no-RF foundation. */
  readonly txEnabled: boolean;
  readonly encryptionPolicy: SensRadioEncryptionPolicy;
  readonly callsignPolicy: SensRadioCallsignPolicy;
  readonly status: 'lab' | 'candidate' | 'operator-validated';
}

export interface SensRadioSendRequest {
  /** Canonical SENS bit payload. */
  readonly bits: string;
  /** True only when a higher layer already encrypted the payload. */
  readonly encrypted: boolean;
}

export interface SensRadioRxEvidence {
  readonly profileId: string;
  readonly centerFrequencyHz: number | null;
  readonly receivedAt: string;
  readonly encrypted: boolean;
  readonly rawFrame: Uint8Array;
  readonly decoded: SensRadioFrame;
}

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
 * Candidate mechanism descriptors only. They deliberately do not authorize TX.
 * Current spectrum/service conditions must be validated outside SENS semantics.
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

export function assertSensRadioProfilePolicy(profile: SensRadioProfile, encrypted: boolean): void {
  if (encrypted && profile.encryptionPolicy === 'forbidden') {
    throw new Error(`profile ${profile.id} forbids encrypted payloads`);
  }
  if (
    encrypted &&
    profile.encryptionPolicy === 'requires-legal-validation' &&
    profile.status !== 'operator-validated'
  ) {
    throw new Error(`profile ${profile.id} requires legal validation before encrypted transport`);
  }
  if (profile.txEnabled && profile.status !== 'operator-validated') {
    throw new Error(`profile ${profile.id} cannot transmit before operator validation`);
  }
}

export type SensRadioEvidenceHandler = (evidence: SensRadioRxEvidence) => void;

/**
 * Reference transport only: no RF. The profile affects policy/provenance, never
 * encoded SENS frame bytes.
 */
export class SensRadioLoopbackTransport {
  private readonly handlers = new Set<SensRadioEvidenceHandler>();

  constructor(readonly profile: SensRadioProfile) {}

  subscribe(handler: SensRadioEvidenceHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(request: SensRadioSendRequest): Uint8Array {
    assertSensRadioProfilePolicy(this.profile, request.encrypted);
    const rawFrame = encodeSensRadioFrame(request.bits);
    const decoded = decodeSensRadioFrame(rawFrame);
    const evidence: SensRadioRxEvidence = {
      profileId: this.profile.id,
      centerFrequencyHz: this.profile.centerFrequencyHz,
      receivedAt: new Date().toISOString(),
      encrypted: request.encrypted,
      rawFrame: rawFrame.slice(),
      decoded
    };
    for (const handler of this.handlers) handler(evidence);
    return rawFrame;
  }
}
