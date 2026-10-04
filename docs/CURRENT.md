# Current documentation

**Status: active source of truth · updated 2026-10-04**

This page is the entry point for the current product, architecture, security, and development documentation. Historical, observational, superseded, and experimental records do not define current behavior; they are preserved under [`docs/archive/`](archive/).

## Current documents

| Area | Current source | What it covers |
|---|---|---|
| Product behavior | [Features and user guide](features.md) | Shipped screens, workflows, supported values, and current limitations |
| Architecture | [Architecture](architecture.md) | SvelteKit/Tauri/Rust structure, runtime boundaries, and data flow |
| Data and security | [Data formats and security](data-and-security.md) | QSO model, ADIF, local storage, sanitization, Radio Rules, and QSO Connect |
| Development | [Development, builds, and releases](development.md) | Local commands, tests, builds, CI, signing, and releases |
| Radio Rules | [Radio Rules 0.1](radio-rules.md) | Safe local rules-language reference |
| SENS radio foundation | [SENS radio link](sens-radio.md) | Bit-exact framing, no-RF laboratory paths, profiles, and provenance |

## Status vocabulary

- **Available / Доступно / Verfügbar** — exposed in the current user interface.
- **Foundation / Основа / Grundlage** — implemented and tested, but not connected to a user-facing screen.
- **Planned / Заплановано / Geplant** — a direction or open design, not a shipped feature or promise.

## Authority rules

1. Current documents linked above define the repository's present behavior and active design boundaries.
2. Code, tests, and CI are authoritative for implemented behavior; documentation must not claim more than they prove.
3. SENS owns SENS semantic bits and domains. This repository owns transport, application integration, and observation/provenance boundaries.
4. Archived records are retained for history and context only. They are non-normative unless a current document explicitly links to a specific historical fact.

## Historical archive

See [`docs/archive/README.md`](archive/README.md) for the archive policy and the list of preserved records.
