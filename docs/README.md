# Signal & Radio Log documentation

**[English](#english) · [Українська](#українська) · [Deutsch](#deutsch)**

This directory is the technical and user documentation for Signal & Radio Log. Documentation describes version **0.6.5** and distinguishes shipped features from foundations that are not yet exposed in the interface.

| Document | Purpose |
|---|---|
| [Features and user guide](features.md) | Every visible screen, workflow, supported value, Notes template, and current limitation |
| [Architecture](architecture.md) | SvelteKit/Tauri/Rust structure, modules, runtime boundaries, and data flow |
| [Data formats and security](data-and-security.md) | QSO model, ADIF behavior, local storage, Markdown sanitization, Radio Rules, and QSO Connect cryptography |
| [Development, builds, and releases](development.md) | Local commands, tests, platform packages, CI, signing, and release process |
| [Radio Rules 0.1](radio-rules.md) | Reference for the safe Lisp-like rules language |

## English

Start with [Features and user guide](features.md) if you use the application. Contributors should then read [Architecture](architecture.md), [Data formats and security](data-and-security.md), and [Development](development.md).

Status words used throughout the documentation:

- **Available** — accessible in the current user interface.
- **Foundation** — implemented and tested in code, but not yet connected to a user-facing screen.
- **Planned** — a direction, not a promise or currently shipped feature.

## Українська

Ця папка містить користувацьку й технічну документацію Signal & Radio Log версії **0.6.5**. Для знайомства з програмою почніть із [можливостей і посібника](features.md). Розробникам варто також прочитати [архітектуру](architecture.md), [дані та безпеку](data-and-security.md) і [розробку та релізи](development.md).

Позначення стану:

- **Доступно** — функція є в поточному інтерфейсі.
- **Основа** — код реалізовано й протестовано, але користувацького екрана ще немає.
- **Заплановано** — напрям розвитку, а не готова функція чи обіцянка строку.

## Deutsch

Dieser Ordner enthält die Benutzer- und Technikdokumentation für Signal & Radio Log **0.6.5**. Benutzer beginnen mit [Funktionen und Benutzerhandbuch](features.md). Mitwirkende lesen anschließend [Architektur](architecture.md), [Daten und Sicherheit](data-and-security.md) sowie [Entwicklung und Releases](development.md).

Statusbegriffe:

- **Verfügbar** — in der aktuellen Oberfläche erreichbar.
- **Grundlage** — implementiert und getestet, aber noch ohne Benutzeroberfläche.
- **Geplant** — Entwicklungsrichtung, keine bereits ausgelieferte Funktion.
