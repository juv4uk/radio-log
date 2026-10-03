# SENS radio link foundation · Основа SENS-радіоканалу · SENS-Funkkanal-Grundlage

**Status: Foundation / Основа / Grundlage. No real RF transmitter is enabled by this module.**

## English

### Boundary

The SENS radio layer carries an already-defined SENS wire payload. It does not assign language meaning to a frequency, modulation, bandwidth, radio chipset, checksum, or retry policy.

```text
SENS semantics
  -> exact SENS wire payload
  -> SENS radio frame
  -> RF profile / modem / hardware
```

The radio frame contains only transport metadata: frame version, SENS wire version, stream ID, sequence number, exact payload bit length, packed payload bytes, and CRC-32. The RF profile is deliberately outside the frame, so moving the same frame between two frequencies cannot rewrite SENS identity.

Packed payload bits are MSB-first. When the final byte is only partly used, all unused low bits must be zero. The explicit bit length is authoritative for the transport boundary; padding is never language meaning.

### Profiles

The first code ships only non-transmitting/reference profiles:

| Profile | Purpose | RF TX | Encryption |
|---|---|---:|---|
| `lab-loopback` | deterministic CI/reference channel | no | allowed for tests |
| `ua-srd-433-data-candidate` | candidate 433 MHz-class data profile | no | requires separate legal validation |
| `ua-srd-868-data-candidate` | candidate 868 MHz-class data profile | no | requires separate legal validation |
| `ua-amateur-open` | amateur-service open-data policy template | no | forbidden |

The numeric candidate frequencies are mechanism configuration only. They are not SENS codes and do not authorize transmission. Current spectrum conditions, equipment limits, operator permissions, and the selected emission must be validated before a future hardware adapter enables TX.

For amateur operation, this project keeps the radio payload open and separate from QSO Connect encryption. QSO Connect AES-GCM may be reused only by a distinct transport profile whose regulatory/service policy explicitly permits encrypted data.

### Evidence

`SensRadioLoopbackTransport` records:
- RF profile ID;
- configured center frequency;
- receive timestamp;
- raw frame bytes;
- decoded SENS frame.

That gives radio-log a provenance record without making acquisition metadata part of SENS semantics.

## Українська

### Межа

SENS-радіошар переносить уже сформований SENS-wire payload. Частота, модуляція, ширина каналу, радіочип, CRC чи ARQ не стають значенням мови.

```text
семантика SENS
  -> точний SENS wire
  -> радіокадр SENS
  -> RF-профіль / модем / апаратура
```

Радіокадр містить тільки транспортні дані: версію кадру, версію SENS wire, ID потоку, номер кадру, точну кількість корисних бітів, упаковані байти та CRC-32. RF-профіль навмисно не входить у кадр. Тому той самий кадр на 433 і 868 МГц лишається тим самим SENS payload.

Біти пакуються від старшого біта. Якщо останній байт використаний не повністю, невикористані молодші біти мусять бути нульовими. Кінець payload визначає явна довжина, а не padding.

Перші профілі є лабораторними/кандидатними та мають `txEnabled=false`. Вони не дають дозволу на випромінювання. Перед майбутнім реальним TX треба окремо перевірити чинні умови використання спектра, параметри обладнання, права оператора та вид випромінювання.

Для аматорського профілю `ua-amateur-open` шифрування заборонене політикою модуля. AES-GCM з QSO Connect може використовуватися лише в окремому профілі/службі, де зашифровані дані явно дозволені.

`SensRadioLoopbackTransport` зберігає provenance: ID профілю, частоту профілю, час прийому, сирі байти кадру та декодований SENS frame. Це сумісно з принципом radio-log #8: спочатку спостереження, потім інтерпретація.

## Deutsch

### Grenze

Die SENS-Funkschicht transportiert einen bereits definierten SENS-Wire-Payload. Frequenz, Modulation, Bandbreite, Funkchip, CRC und ARQ sind Mechanismusdaten und keine SENS-Semantik.

```text
SENS-Semantik
  -> exakter SENS-Wire
  -> SENS-Funkrahmen
  -> HF-Profil / Modem / Hardware
```

Der Funkrahmen enthält nur Transportmetadaten: Rahmenversion, SENS-Wire-Version, Stream-ID, Sequenznummer, exakte Payload-Bitlänge, gepackte Payload-Bytes und CRC-32. Das HF-Profil liegt absichtlich außerhalb des Rahmens.

Die ersten Profile sind Labor-/Kandidatenprofile mit `txEnabled=false`. Sie erteilen keine Sendeberechtigung. Vor realem Sendebetrieb müssen aktuelle Frequenzbedingungen, Gerätegrenzen, Betreiberberechtigung und Aussendungsart separat geprüft werden.

Das Amateurprofil `ua-amateur-open` verbietet verschlüsselte Payloads. QSO-Connect-AES-GCM darf nur in einem getrennten Profil verwendet werden, dessen Funkdienst verschlüsselte Daten ausdrücklich zulässt.

## Cross-repository authority

- radio-log implementation/product profile: [radio-log #16](https://github.com/juv4uk/radio-log/issues/16)
- SENS profile-neutral wire contract: [sens #2684](https://github.com/juv4uk/sens/issues/2684)
- exact SENS framing work: [sens #2059](https://github.com/juv4uk/sens/issues/2059), [#2166](https://github.com/juv4uk/sens/issues/2166), [#2189](https://github.com/juv4uk/sens/issues/2189)
- radio ARQ research: [sens #2646](https://github.com/juv4uk/sens/issues/2646)

**Principle: SENS owns the bits and domains. Radio owns only how those bits cross space.**
