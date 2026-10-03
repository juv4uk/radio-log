# SENS-RADIO transport boundary

SENS-RADIO is a public transport experiment for exact SENS bit payloads.

## Separation

```text
SENS payload semantics
        !=
SENS-RADIO framing
        !=
radio bearer / frequency / modulation
```

A frequency is never a SENS identity. The same exact payload/frame may be carried
over an audio loopback, receive-only SDR recording, HF narrowband experiment,
VHF/UHF packet experiment, or another explicitly configured bearer.

## Transmit policy

The software must default to receive/research operation. A profile marked
`operator-authorized` is only a mechanical application guard: it does **not**
certify legal authorization.

Before RF transmission the operator remains responsible for current national
rules, licence/qualification conditions, permitted band/mode/bandwidth/power,
station identification, checking that the selected channel is free, avoiding
interference, and using the minimum power necessary.

For Ukraine, the current amateur-radio regulation (NCEC Resolution No. 173,
10 May 2023) requires operation within authorized bands/modes/power and open
communication, and prohibits codes/ciphers used to conceal the content unless
defined for the amateur service.

IARU Region 1 band plans are operating guidance for compatible spectrum use;
national regulation remains authoritative.

## Encryption boundary

QSO Connect AES-GCM is an Internet/private-transport feature. SENS-RADIO amateur
bearers must not reuse encrypted QSO Connect envelopes as on-air payloads.

## First implementation order

1. public bit-exact frame + CRC;
2. multi-bearer RX/profile model;
3. deterministic audio/SDR receive-only loopback;
4. measure framing/ARQ/FEC using SENS research results;
5. only then consider a separate TX implementation behind an explicit operator gate.
