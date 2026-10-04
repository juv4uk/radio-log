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

export interface SensRadioAcquisitionContext {
  readonly profileId: string;
  readonly centerFrequencyHz: number | null;
  readonly bandwidthHz: number | null;
  readonly modulation: string;
  readonly capturedAt: string;
  readonly acquisitionSource: string;
  readonly buildRevision: string;
}

export interface SensRadioRawObservation {
  readonly kind: 'raw-observation';
  readonly frame: Uint8Array;
  readonly acquisition: SensRadioAcquisitionContext;
}

export interface SensRadioInterpretation {
  readonly kind: 'inferred-event' | 'unresolved';
  readonly status: 'INFERRED' | 'UNRESOLVED';
  readonly decoded: SensRadioFrame | null;
  readonly sourceObservation: 'raw-observation';
  readonly reason?: string;
}

export interface SensRadioRxEvidence {
  readonly profileId: string;
  readonly centerFrequencyHz: number | null;
  readonly receivedAt: string;
  readonly encrypted: boolean;
  readonly rawFrame: Uint8Array;
  readonly decoded: SensRadioFrame | null;
  readonly observation: SensRadioRawObservation;
  readonly interpretation: SensRadioInterpretation;
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

export function createSensRadioRxEvidence(
  profile: SensRadioProfile,
  encrypted: boolean,
  rawFrame: Uint8Array,
  receivedAt = new Date().toISOString(),
  acquisitionSource = 'unknown',
  buildRevision = 'unknown'
): SensRadioRxEvidence {
  const capturedFrame = rawFrame.slice();
  const acquisition: SensRadioAcquisitionContext = {
    profileId: profile.id,
    centerFrequencyHz: profile.centerFrequencyHz,
    bandwidthHz: profile.bandwidthHz,
    modulation: profile.modulation,
    capturedAt: receivedAt,
    acquisitionSource,
    buildRevision
  };
  const observation: SensRadioRawObservation = {
    kind: 'raw-observation',
    frame: capturedFrame,
    acquisition
  };
  try {
    const decoded = decodeSensRadioFrame(capturedFrame);
    return {
      profileId: profile.id,
      centerFrequencyHz: profile.centerFrequencyHz,
      receivedAt,
      encrypted,
      rawFrame: capturedFrame,
      decoded,
      observation,
      interpretation: {
        kind: 'inferred-event',
        status: 'INFERRED',
        decoded,
        sourceObservation: 'raw-observation'
      }
    };
  } catch (error) {
    return {
      profileId: profile.id,
      centerFrequencyHz: profile.centerFrequencyHz,
      receivedAt,
      encrypted,
      rawFrame: capturedFrame,
      decoded: null,
      observation,
      interpretation: {
        kind: 'unresolved',
        status: 'UNRESOLVED',
        decoded: null,
        sourceObservation: 'raw-observation',
        reason: error instanceof Error ? error.message : String(error)
      }
    };
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
    const evidence = createSensRadioRxEvidence(
      this.profile,
      request.encrypted,
      rawFrame,
      new Date().toISOString(),
      'loopback',
      'runtime'
    );
    for (const handler of this.handlers) handler(evidence);
    return rawFrame;
  }
}
