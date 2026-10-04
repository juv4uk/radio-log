# SENS radio link · SENS-радіоканал · SENS-Funkkanal

**Status: Working no-RF laboratory path / Робочий лабораторний шлях без RF. Real RF transmission is not enabled.**

## English

### Layering

```text
SENS semantic bits
  -> public bit-exact SENS-RADIO frame
  -> modem/baseband
  -> RF profile / tuner / hardware
```

The current frame implementation is `src/lib/sens-radio/frame.ts`. It preserves the exact payload bit length, leading zeroes and non-byte-aligned tails, and uses CRC-32 only as transport corruption detection.

`src/lib/sens-radio/bfsk-tx.ts` and `bfsk-rx.ts` form a deterministic aligned BFSK laboratory modem pair. `black-sky.ts` composes the complete no-RF witness: canonical payload -> frame -> audio samples -> RX decisions -> recovered frame -> exact payload. Synchronization, real channel acquisition, FEC and physical RF transmitter support remain separate mechanism work.

### Black-sky CI witness

The complete laboratory path is executable:

```bash
npm test
npm run bench:emrg
```

`bench:emrg` emits `artifacts/emrg-black-sky.json`. GitHub Actions uploads the same JSON as the `emrg-black-sky` artifact.

The benchmark currently checks:

- two distinct no-RF modem profiles;
- byte-identical recovered SENS frames;
- leading-zero and non-byte-aligned payloads;
- deterministic corruption/truncation rejection;
- one whole-attempt simulated loss followed by bounded retry;
- frame overhead, waveform sample count, simulated duration and minimum detector confidence.

The local bit fixtures are transport witnesses only. They are not emergency semantic authority; canonical EMRG form fixtures belong to SENS and will be consumed once exported by `sens#3111`.

### Frequency profiles

`profiles.ts` deliberately keeps center frequency and policy outside the frame. The same frame bytes must therefore survive different profile descriptors unchanged.

Current non-transmitting descriptors:

| Profile | Center | Meaning |
|---|---:|---|
| `lab-loopback` | none | deterministic CI/reference |
| `ua-srd-433-data-candidate` | 433.920 MHz | candidate SRD mechanism profile |
| `ua-srd-868-data-candidate` | 868.300 MHz | candidate SRD mechanism profile |
| `ua-amateur-open` | operator-selected | open amateur-service policy template |

Every profile currently has `txEnabled=false`. Candidate frequencies are configuration/evidence, not SENS identities and not authorization to transmit.

### Encryption boundary

The public SENS-RADIO frame itself does not encrypt content.

- `ua-amateur-open` rejects a payload marked as already encrypted.
- candidate SRD profiles reject encrypted mode until a separate operator/legal validation marks the profile validated.
- `lab-loopback` may exercise encrypted higher-layer payloads without RF.

QSO Connect AES-GCM remains a separate application layer. It must not be silently reused on an amateur profile.

### Provenance

Loopback receive evidence records profile ID, configured center frequency, timestamp, raw frame bytes, encryption-policy fact and decoded frame. Acquisition facts remain outside SENS identity, matching radio-log #8.

The evidence contract keeps the two epistemic layers explicit:

- `observation.kind = "raw-observation"` preserves received frame bytes and acquisition context (profile, frequency, bandwidth, modulation, capture time, source and build revision);
- `interpretation.kind = "inferred-event"` records a successful decode derived from that observation;
- `interpretation.kind = "unresolved"` preserves malformed or undecodable raw evidence without inventing a semantic event;
- `interpretation.sourceObservation` links the derived result back to the raw observation.

`createSensRadioRxEvidence()` is the shared boundary for this conversion. A raw frame is copied before storage, so later decoding or caller mutation cannot erase the evidence. The loopback path supplies `acquisitionSource = "loopback"` and `buildRevision = "runtime"`; hardware adapters must provide their own acquisition source and build identity.

## Українська

### Шари

```text
семантичні біти SENS
  -> відкритий bit-exact SENS-RADIO frame
  -> модем / baseband
  -> RF-профіль / тюнер / апаратура
```

`frame.ts` зберігає точну кількість бітів, початкові нулі й неповний останній байт; CRC-32 лише виявляє транспортне пошкодження. `bfsk-tx.ts` + `bfsk-rx.ts` уже утворюють детерміновану лабораторну пару модемів, а `black-sky.ts` проганяє повний шлях без RF: payload → frame → аудіосемпли → RX → відновлений frame → точний payload.

Частота не входить у frame. Тому однаковий SENS payload через профілі 433.920 і 868.300 МГц повинен давати байт-в-байт однаковий кадр. Усі теперішні RF-профілі мають `txEnabled=false`: це лабораторні/кандидатні описи, а не дозвіл на випромінювання.

Для `ua-amateur-open` зашифрований payload відкидається політикою. Candidate SRD-профілі також не дозволяють encrypted mode, доки профіль окремо не пройшов правову/операторську валідацію. AES-GCM QSO Connect лишається окремим верхнім шаром.

Receive evidence зберігає профіль, частоту, час, сирий кадр і декодований frame окремо від SENS-семантики.

Лабораторний свідок запускається командами `npm test` та `npm run bench:emrg`. Бенчмарк формує JSON-артефакт із розміром payload/frame, overhead, кількістю семплів, модельованим часом, confidence, відкинутими пошкодженнями та retry при одній детермінованій втраті спроби.

## Deutsch

### Schichten

```text
SENS-Bedeutungsbits
  -> öffentlicher bitgenauer SENS-RADIO-Rahmen
  -> Modem / Basisband
  -> HF-Profil / Tuner / Hardware
```

Frequenz und Funkprofil liegen außerhalb des Rahmens. Derselbe SENS-Payload muss deshalb über die 433.920- und 868.300-MHz-Kandidatenprofile bytegleich bleiben.

Alle aktuellen Profile haben `txEnabled=false`. Das Amateurprofil verwirft verschlüsselte Payloads; Kandidaten-SRD-Profile erlauben sie erst nach separater rechtlicher/operativer Validierung. QSO Connect bleibt eine getrennte Anwendungsschicht.

## Authority and next work

- product/RF integration: [radio-log #16](https://github.com/juv4uk/radio-log/issues/16)
- waveform laboratory: [radio-log #22](https://github.com/juv4uk/radio-log/issues/22)
- EMRG black-sky benchmark: [radio-log #26](https://github.com/juv4uk/radio-log/issues/26)
- EMRG native-language UI: [radio-log #27](https://github.com/juv4uk/radio-log/issues/27)
- profile-neutral SENS wire contract: [sens #2684](https://github.com/juv4uk/sens/issues/2684)
- SENS framing: [sens #2059](https://github.com/juv4uk/sens/issues/2059), [#2166](https://github.com/juv4uk/sens/issues/2166), [#2189](https://github.com/juv4uk/sens/issues/2189)
- ARQ/framing research: [sens #2646](https://github.com/juv4uk/sens/issues/2646)

**SENS owns the bits and domains. Radio owns only how those bits cross space.**
