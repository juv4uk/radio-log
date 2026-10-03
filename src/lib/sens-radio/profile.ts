export type SensRadioBearerKind =
  | 'audio-loopback'
  | 'sdr-rx'
  | 'hf-narrowband'
  | 'vhf-uhf-packet'
  | 'lora-experimental'
  | 'external';

export type SensRadioTxPolicy = 'disabled' | 'operator-authorized';

export interface SensRadioChannelProfile {
  id: string;
  kind: SensRadioBearerKind;
  centerFrequencyHz?: number;
  occupiedBandwidthHz?: number;
  symbolRate?: number;
  modulation: string;
  txPolicy: SensRadioTxPolicy;
  regulatoryAuthority?: string;
  operatorCallsign?: string;
  operatorNote?: string;
}

export interface SensRadioTransmitContext {
  channelClearConfirmed: boolean;
  minimumNecessaryPowerConfirmed: boolean;
}

export function validateSensRadioChannelProfile(profile: SensRadioChannelProfile): void {
  if (!profile.id.trim()) throw new Error('SENS-RADIO profile id is required');
  if (!profile.modulation.trim()) throw new Error('SENS-RADIO modulation is required');

  if (profile.centerFrequencyHz !== undefined && (!Number.isFinite(profile.centerFrequencyHz) || profile.centerFrequencyHz <= 0)) {
    throw new Error('SENS-RADIO center frequency must be positive');
  }
  if (profile.occupiedBandwidthHz !== undefined && (!Number.isFinite(profile.occupiedBandwidthHz) || profile.occupiedBandwidthHz <= 0)) {
    throw new Error('SENS-RADIO occupied bandwidth must be positive');
  }
  if (profile.symbolRate !== undefined && (!Number.isFinite(profile.symbolRate) || profile.symbolRate <= 0)) {
    throw new Error('SENS-RADIO symbol rate must be positive');
  }

  if (profile.kind !== 'audio-loopback' && profile.centerFrequencyHz === undefined) {
    throw new Error('RF/SDR SENS-RADIO profile requires center frequency');
  }

  if (profile.txPolicy === 'operator-authorized') {
    if (profile.kind === 'audio-loopback' || profile.kind === 'sdr-rx') {
      throw new Error('Receive/loopback bearer cannot declare RF transmit authorization');
    }
    if (!profile.regulatoryAuthority?.trim()) {
      throw new Error('Transmit profile requires explicit regulatory authority/reference');
    }
    if (!profile.operatorCallsign?.trim()) {
      throw new Error('Transmit profile requires operator callsign');
    }
  }
}

/**
 * Mechanical safety gate only.
 *
 * This does not decide whether a frequency, mode, power, station or operator is
 * legally authorized. It merely prevents the application from silently treating
 * an RX/research profile as transmit-ready.
 */
export function assertSensRadioTransmitReady(
  profile: SensRadioChannelProfile,
  context: SensRadioTransmitContext
): void {
  validateSensRadioChannelProfile(profile);
  if (profile.txPolicy !== 'operator-authorized') {
    throw new Error('SENS-RADIO transmit is disabled for this profile');
  }
  if (!context.channelClearConfirmed) {
    throw new Error('SENS-RADIO transmit requires a fresh channel-clear confirmation');
  }
  if (!context.minimumNecessaryPowerConfirmed) {
    throw new Error('SENS-RADIO transmit requires minimum-necessary-power confirmation');
  }
}
