# Features and user guide · Можливості та посібник · Funktionen und Benutzerhandbuch

**[English](#english) · [Українська](#українська) · [Deutsch](#deutsch)** · [Documentation home](README.md)

## English

### Product idea

Signal & Radio Log is an offline-first amateur-radio journal optimized for minimal typing and thumb operation. It works in portrait and landscape layouts and keeps the primary navigation at the bottom on small screens. English, Ukrainian, and German can be changed with one press in the header or from Station settings.

### New QSO — available

The entry screen starts a record with current UTC date/time and station defaults. A callsign is the only required field and is normalized to uppercase.

- Quick bands: `80M`, `40M`, `20M`, `15M`, `10M`, `2M`; the full selector also offers `160M`, `60M`, `30M`, `17M`, `12M`, `6M`, and `70CM`.
- Quick modes: `SSB`, `CW`, `FT8`, `FM`; the full selector also offers `FT4`, `AM`, `RTTY`, `PSK31`, and `DIGITALVOICE`.
- Default reports: `599` for CW/RTTY, `-10` for FT8/FT4, and `59` for other modes.
- Always visible: callsign, band, mode, RST sent, and RST received.
- Optional section: UTC date, UTC time, frequency, TX power in watts, name, QTH, remote grid square, and comment.
- QRPp power presets: `0.05`, `0.1`, `0.5`, `1`, and `5` W.
- Existing records can be edited without changing stored data until Update is pressed. Editing can be cancelled.

Power badges in the log classify values below 1 W as QRPp and values from 1 through 5 W as QRP. The application accepts any power; QRPp is an emphasis, not a restriction.

### Logbook — available

Records are sorted newest first. Search checks callsign, QTH, band, mode, name, and grid square. Cards show callsign, band, mode, UTC date/time, optional QTH, both reports, power class, and Edit/Delete actions. Delete requires confirmation.

ADIF import accepts `.adi`, `.adif`, and `.txt`. Export uses a native save dialog in Tauri and a browser download in Web builds. See [Data formats and security](data-and-security.md) for exact fields and round-trip rules.

### Field Notes — available

Notes are one autosaved Markdown document with an edit/preview loop. Rendering is delayed by 220 ms after typing. Markdown HTML and generated Mermaid SVG are sanitized before display; raw HTML is escaped.

Beginner templates are localized and always inserted at the very top of the document, newest first — the same reverse-chronological order as the Logbook and FT8 tabs:

1. Basic field note.
2. QSO report table.
3. QRPp experiment table.
4. TX power ladder.
5. Contact summary table.
6. Antenna comparison table.
7. Mermaid station signal path.

The current renderer displays the first fenced `mermaid` block and ordinary Markdown around it. A second Mermaid template is disabled while a Mermaid block already exists.

### FT8 decode — available

The FT8 tab decodes FT8 signals from the device microphone using [ft8js](https://github.com/e04/ft8js) (a WebAssembly build of `ft8_lib`, MIT). No WSJT-X, other companion program, or network connection is required; decoding runs entirely on-device.

Start listening to capture 15-second windows, resample them to 12,000 Hz mono, and decode them. Each decoded message shows signal strength (dB), frequency offset from the tuned tone (Hz), and the message text, newest first. A copy button extracts the likely callsign from a message onto the clipboard.

Capture windows are aligned to UTC 15-second slot boundaries (…00, …15, …30, …45) using a self-correcting timer, not a raw sample count, so cadence does not drift over a listening session. This only fixes buffer alignment — the app has no way to verify the device's system clock is itself within the roughly ±1 s of true UTC that FT8 needs; keep automatic clock sync enabled in the OS. Microphone capture and decode have been confirmed working end to end in the packaged Tauri desktop app with a real audio input device.

Decoded messages are parsed into their standard structure (CQ, grid exchange, signal report, RRR, RR73, 73) rather than guessed at, and each entry shows its recognized type. Entries that imply a completed exchange get a "Log QSO" button that saves a record straight to the log in one click — callsign, mode, report, grid, and UTC date/time from the decode. A wrong entry can be fixed afterward from the Logbook tab (Edit/Delete), same as any other saved QSO.

Known gaps: there is no transmit (encode/playback) screen yet — the codec supports it, but the UI is not built. Android requests the microphone permission at app start (fixed in r0.6.5); validation on a wide range of devices is still welcome. iOS microphone permission (`NSMicrophoneUsageDescription`) is not yet configured, since the platform's generated project is not committed to the repository yet.

### Station profile — available

The profile stores station callsign, operator, own grid square, default band, default mode, default power, and language. Defaults are copied into each new QSO. A legacy 100 W default is automatically migrated to the QRPp-first value of 0.5 W.

### Platforms and quick trial — available

Releases provide Windows, Linux, macOS, Android, iOS Simulator, ARM64 Linux/Raspberry Pi, Flatpak, AppImage, and a standalone Web HTML. The Web edition is one file with embedded JavaScript, CSS, and icons. Its `file://` build uses hash routing to avoid treating a Windows disk path as an application route.

### Implemented foundations, not yet UI features

- **Radio Rules 0.1:** Rust parser/evaluator returns suggested tags and notes. There is no editor or Apply button in the current screen.
- **QSO Connect:** invite creation, AES-GCM encryption, message decryption, and WebSocket relay transport exist and are tested. There is no chat screen and no production relay configured.
- **WebRTC and LoRa:** transport names are reserved in the interface boundary; implementations are planned, not shipped.

### Current limitations

- Data is local to the current browser/WebView profile; there is no account, cloud synchronization, or automatic backup.
- Import assigns new local IDs. Importing the same ADIF twice can create duplicates.
- Notes are a single document rather than per-QSO notes.
- The iOS artifact is for Simulator, not a signed App Store/device build.
- macOS packages are CI-built but are not described as notarized production distributions.
- FT8 has no transmit (encode/playback) UI yet. One-tap "Log QSO" from a completed decode is available; full auto-logging of every decode is not.

## Українська

### Ідея продукту

Signal & Radio Log — офлайн-журнал радіоаматора з мінімумом введення та керуванням одним пальцем. Інтерфейс пристосований до портретної й альбомної орієнтації. Мову можна одним натисканням перемикати між українською, англійською та німецькою.

### Нове QSO — доступно

Новий запис отримує поточні UTC дату/час і значення з профілю станції. Обов’язковий лише позивний; він автоматично переводиться у верхній регістр.

- Швидкі діапазони: `80M`, `40M`, `20M`, `15M`, `10M`, `2M`; повний список також містить `160M`, `60M`, `30M`, `17M`, `12M`, `6M`, `70CM`.
- Швидкі режими: `SSB`, `CW`, `FT8`, `FM`; повний список також містить `FT4`, `AM`, `RTTY`, `PSK31`, `DIGITALVOICE`.
- Типові RST: `599` для CW/RTTY, `-10` для FT8/FT4, `59` для інших режимів.
- Основні поля: позивний, діапазон, режим, переданий та отриманий RST.
- Додаткові поля: UTC дата/час, частота, потужність у ватах, ім’я, QTH, локатор кореспондента й коментар.
- Пресети QRPp: `0.05`, `0.1`, `0.5`, `1`, `5` Вт.
- Запис можна редагувати або скасувати редагування без передчасної зміни збережених даних.

У журналі потужність до 1 Вт позначається QRPp, від 1 до 5 Вт — QRP. Інші потужності також дозволені.

### Журнал — доступно

QSO впорядковано від нових до старих. Пошук працює за позивним, QTH, діапазоном, режимом, ім’ям і локатором. Записи можна редагувати та видаляти після підтвердження.

Імпорт підтримує `.adi`, `.adif`, `.txt`. У Tauri експорт відкриває системний діалог збереження, у Web — завантаження браузера. Точні правила описані в [даних і безпеці](data-and-security.md).

### Польові нотатки — доступно

Це один автозбережуваний Markdown-документ із живим попереднім переглядом через 220 мс після введення. HTML і Mermaid SVG очищаються перед показом, а сирий HTML екранується.

Доступні локалізовані навчальні шаблони: базова нотатка, звіт QSO, QRPp-експеримент, сходинки потужності, таблиця контактів, порівняння антен і Mermaid-схема станції. Кожен новий шаблон завжди вставляється на самий верх документа, найновіший — згори, як і в Журналі та на вкладці FT8. Нині відображається перший блок `mermaid`; додавання другого шаблону схеми блокується.

### Декодування FT8 — доступно

Вкладка FT8 декодує сигнали FT8 з мікрофона пристрою за допомогою [ft8js](https://github.com/e04/ft8js) (WebAssembly-збірка `ft8_lib`, MIT). WSJT-X, інша супутня програма чи мережа не потрібні — декодування відбувається повністю на пристрої.

Кнопка запускає прослуховування 15-секундних вікон, ресемплінг до 12000 Гц моно та декодування. Кожне повідомлення показує силу сигналу (дБ), зсув частоти від налаштованого тону (Гц) і текст, найновіші — згори. Кнопка копіювання виділяє ймовірний позивний із повідомлення в буфер обміну.

Вікна захоплення вирівняно по межах 15-секундних UTC-слотів (…00, …15, …30, …45) через самокорекційний таймер, а не лічильник семплів, тож темп не дрейфує протягом сесії прослуховування. Це виправляє лише вирівнювання буфера — застосунок не має способу перевірити, чи системний годинник пристрою сам перебуває в межах приблизно ±1с від справжнього UTC, що потрібно FT8; тримайте автоматичну синхронізацію часу увімкненою в ОС. Захоплення мікрофона й декодування підтверджено робочими наскрізь у зібраному desktop-застосунку Tauri з реальним аудіо-входом.

Декодовані повідомлення розбираються за стандартною структурою (CQ, обмін локаторами, сигнальний рапорт, RRR, RR73, 73), а не вгадуються, і кожен запис показує розпізнаний тип. Записи, що означають завершений обмін, отримують кнопку "Записати QSO", яка одним кліком зберігає запис одразу в журнал — позивний, режим, рапорт, локатор і UTC дату/час із декоду. Помилковий запис можна виправити потім із вкладки Журнал (Змінити/Видалити), так само як і будь-яке інше збережене QSO.

Відомі обмеження: екрана передачі (кодування й відтворення) ще немає — кодек це підтримує, але UI не побудовано. Android запитує дозвіл мікрофона при старті (виправлено в r0.6.5); перевірка на ширшому колі пристроїв вітається. Дозвіл мікрофона для iOS (`NSMicrophoneUsageDescription`) ще не налаштовано, бо згенерований проєкт платформи ще не закомічено в репозиторій.

### Профіль станції — доступно

Зберігає позивний станції, оператора, власний локатор, типовий діапазон, режим, потужність і мову. Ці значення копіюються в нове QSO. Старе типове значення 100 Вт автоматично мігрує на 0.5 Вт.

### Платформи — доступно

Релізи охоплюють Windows, Linux, macOS, Android, iOS Simulator, ARM64 Linux/Raspberry Pi, Flatpak, AppImage і автономний Web HTML. Web-версія містить код, стилі та іконки в одному файлі й коректно відкривається через `file://`.

### Реалізовані основи без екрана

- **Radio Rules 0.1:** Rust-парсер обчислює запропоновані теги й нотатки; редактора правил у UI ще немає.
- **QSO Connect:** створення запрошень, AES-GCM шифрування та WebSocket transport реалізовані й протестовані; чату й production relay ще немає.
- **WebRTC і LoRa:** передбачені архітектурою, але ще не реалізовані.

### Поточні обмеження

- Немає акаунта, хмарної синхронізації та автоматичних резервних копій.
- Повторний імпорт того самого ADIF може створити дублікати.
- Нотатки поки є одним документом, а не окремими для кожного QSO.
- iOS-пакет призначено для Simulator; macOS-збірка не заявлена як нотаризована production-версія.
- У FT8 ще немає екрана передачі. Кнопка «Записати QSO» з завершеного декоду доступна; повний автозапис кожного декоду — ні.

## Deutsch

### Produktidee

Signal & Radio Log ist ein Offline-Amateurfunk-Logbuch für möglichst wenig Texteingabe und Ein-Daumen-Bedienung. Hoch- und Querformat werden unterstützt. Englisch, Ukrainisch und Deutsch lassen sich mit einem Tastendruck wechseln.

### Neues QSO — verfügbar

Ein neuer Eintrag übernimmt aktuelle UTC-Zeit und Stationsvorgaben. Nur das Rufzeichen ist Pflicht und wird großgeschrieben. Schnellwahl: sechs häufige Bänder, `SSB/CW/FT8/FM` und QRPp-Leistungen `0.05/0.1/0.5/1/5` W. Vollständige Auswahllisten enthalten 13 Bänder und 9 Betriebsarten. Optionale Felder umfassen UTC-Datum/Zeit, Frequenz, Leistung, Name, QTH, Locator und Kommentar.

RST-Vorgaben sind `599` für CW/RTTY, `-10` für FT8/FT4 und `59` sonst. Leistungen unter 1 W werden als QRPp, 1 bis 5 W als QRP markiert. Andere Leistungen bleiben erlaubt.

### Logbuch — verfügbar

Kontakte sind absteigend nach Datum/Zeit sortiert. Die Suche umfasst Rufzeichen, QTH, Band, Betriebsart, Name und Locator. Bearbeiten und bestätigtes Löschen sind möglich. ADIF-Import akzeptiert `.adi`, `.adif`, `.txt`; Export verwendet nativ einen Speicherdialog und im Web einen Browser-Download.

### Feldnotizen — verfügbar

Ein automatisch gespeichertes Markdown-Dokument besitzt eine Live-Vorschau. Vorlagen erklären Grundnotizen, QSO-Bericht, QRPp-Experiment, Leistungsleiter, Kontakt- und Antennentabellen sowie einen Mermaid-Signalweg. Jede neu eingefügte Vorlage landet immer ganz oben im Dokument, neueste zuerst, wie im Logbuch und im FT8-Tab. HTML und SVG werden bereinigt. Derzeit wird der erste Mermaid-Block dargestellt.

### FT8-Dekodierung — verfügbar

Der FT8-Tab dekodiert FT8-Signale vom Gerätemikrofon mit [ft8js](https://github.com/e04/ft8js) (ein WebAssembly-Build von `ft8_lib`, MIT). WSJT-X, ein anderes Begleitprogramm oder eine Netzwerkverbindung sind nicht nötig — die Dekodierung läuft vollständig auf dem Gerät.

Der Start-Knopf erfasst 15-Sekunden-Fenster, resampelt sie auf 12.000 Hz mono und dekodiert sie. Jede dekodierte Nachricht zeigt Signalstärke (dB), Frequenzversatz zum abgestimmten Ton (Hz) und den Nachrichtentext, neueste zuerst. Ein Kopier-Knopf extrahiert das wahrscheinliche Rufzeichen in die Zwischenablage.

Erfassungsfenster sind an UTC-15-Sekunden-Slotgrenzen (…00, …15, …30, …45) ausgerichtet, über einen selbstkorrigierenden Timer statt einer reinen Samplezahl, sodass das Timing über eine Sitzung nicht abdriftet. Das korrigiert nur die Pufferausrichtung — die App kann nicht prüfen, ob die Systemuhr selbst innerhalb der von FT8 benötigten ca. ±1 s zur echten UTC liegt; automatische Zeitsynchronisierung im Betriebssystem aktiviert lassen. Mikrofonerfassung und Dekodierung wurden Ende-zu-Ende in der gepackten Tauri-Desktop-App mit echtem Audioeingabegerät bestätigt.

Dekodierte Nachrichten werden in ihre Standardstruktur zerlegt (CQ, Locator-Austausch, Signalbericht, RRR, RR73, 73) statt geraten, und jeder Eintrag zeigt seinen erkannten Typ. Einträge, die einen abgeschlossenen Austausch bedeuten, erhalten eine "QSO loggen"-Schaltfläche, die den Datensatz mit einem Klick direkt im Logbuch speichert — Rufzeichen, Betriebsart, Bericht, Locator und UTC-Datum/-Zeit aus der Dekodierung. Ein falscher Eintrag lässt sich danach im Logbuch-Tab korrigieren (Bearbeiten/Löschen), genau wie jedes andere gespeicherte QSO.

Bekannte Lücken: Es gibt noch keinen Sende-Bildschirm (Kodierung/Wiedergabe) — der Codec unterstützt es, die UI ist aber nicht gebaut. Android fragt die Mikrofonberechtigung beim Start an (behoben in r0.6.5); Tests auf weiteren Geräten sind willkommen. Die iOS-Mikrofonberechtigung (`NSMicrophoneUsageDescription`) ist noch nicht konfiguriert, da das generierte Plattformprojekt noch nicht im Repository committet ist.

### Stationsprofil — verfügbar

Gespeichert werden Stationsrufzeichen, Operator, eigener Locator, Standardband, Standardbetriebsart, Standardleistung und Sprache. Ein alter 100-W-Standard wird automatisch auf 0,5 W migriert.

### Plattformen — verfügbar

Pakete existieren für Windows, Linux, macOS, Android, iOS Simulator, ARM64 Linux/Raspberry Pi, Flatpak, AppImage und als einzelne portable Web-HTML-Datei.

### Grundlagen ohne Benutzeroberfläche

- **Radio Rules 0.1:** Rust-Auswertung für vorgeschlagene Tags/Notizen; noch kein Regeleditor.
- **QSO Connect:** Einladung, AES-GCM und WebSocket-Transport sind getestet; noch kein Chat und kein Produktions-Relay.
- **WebRTC/LoRa:** architektonisch vorgesehen, noch nicht implementiert.

### Grenzen

Keine Cloud-Synchronisierung oder automatische Sicherung; erneuter ADIF-Import kann Duplikate erzeugen; Notizen sind ein gemeinsames Dokument; iOS ist Simulator-only; macOS wird nicht als notarisiertes Produktionspaket bezeichnet; FT8 hat noch keine Sende-UI (Ein-Tipp-"QSO loggen" aus abgeschlossener Dekodierung ist verfügbar).
