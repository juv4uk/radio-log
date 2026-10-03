# SENS radio link · SENS-радіоканал · SENS-Funkkanal

**Status: Foundation / Основа / Grundlage. Real RF transmission is not enabled.**

## English

### Layering

```text
SENS semantic bits
  -> public bit-exact SENS-RADIO frame
  -> modem/baseband
  -> RF profile / tuner / hardware
```

The current frame implementation is `src/lib/sens-radio/frame.ts`. It preserves the exact payload bit length, leading zeroes and non-byte-aligned tails, and uses CRC-32 only as transport corruption detection.

`src/lib/sens-radio/bfsk-rx.ts` is a receive-only aligned BFSK laboratory decoder. Synchronization, ARQ/FEC and physical transmitter support remain separate mechanism work.

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

## Українська

### Шари

```text
семантичні біти SENS
  -> відкритий bit-exact SENS-RADIO frame
  -> модем / baseband
  -> RF-профіль / тюнер / апаратура
```

`frame.ts` зберігає точну кількість бітів, початкові нулі й неповний останній байт; CRC-32 лише виявляє транспортне пошкодження. `bfsk-rx.ts` — поки що приймальний лабораторний BFSK-декодер із уже вирівняними символами.

Частота не входить у frame. Тому однаковий SENS payload через профілі 433.920 і 868.300 МГц повинен давати байт-в-байт однаковий кадр. Усі теперішні RF-профілі мають `txEnabled=false`: це лабораторні/кандидатні описи, а не дозвіл на випромінювання.

Для `ua-amateur-open` зашифрований payload відкидається політикою. Candidate SRD-профілі також не дозволяють encrypted mode, доки профіль окремо не пройшов правову/операторську валідацію. AES-GCM QSO Connect лишається окремим верхнім шаром.

Receive evidence зберігає профіль, частоту, час, сирий кадр і декодований frame окремо від SENS-семантики.

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
- profile-neutral SENS wire contract: [sens #2684](https://github.com/juv4uk/sens/issues/2684)
- SENS framing: [sens #2059](https://github.com/juv4uk/sens/issues/2059), [#2166](https://github.com/juv4uk/sens/issues/2166), [#2189](https://github.com/juv4uk/sens/issues/2189)
- ARQ/framing research: [sens #2646](https://github.com/juv4uk/sens/issues/2646)

**SENS owns the bits and domains. Radio owns only how those bits cross space.**
