<script lang="ts">
  import { decodeFt8, FT8_SAMPLE_RATE, FT8_CYCLE_SECONDS, type Ft8ReceivedMessage } from './codec';
  import { parseFt8Message, impliesCompletedExchange, otherStationCall } from './message';
  import type { MessageKey } from '../i18n';

  type QsoLogRequest = { call: string; grid?: string; rstSent?: string; rstRcvd?: string; capturedAt: string };

  let { t, myCall = '', onLogQso }: { t: (key: MessageKey) => string; myCall?: string; onLogQso?: (request: QsoLogRequest) => void } = $props();

  type LogEntry = Ft8ReceivedMessage & { id: string; capturedAt: string };

  let listening = $state(false);
  let statusMessage = $state('');
  let entries = $state<LogEntry[]>([]);
  let nextSlotSeconds = $state(0);
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let chunk: number[] = [];
  let inputRate = 0;
  let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let awaitingFirstBoundary = true;

  const SLOT_MS = FT8_CYCLE_SECONDS * 1000;

  // EN: FT8 slots start on UTC 15-second boundaries (…00, …15, …30, …45).
  // Cutting the capture buffer by elapsed sample count instead drifts away
  // from those boundaries within a cycle or two, so messages land on the
  // seam between two buffers and never decode. Instead we schedule the cut
  // itself against the wall clock, recomputing the delay to the *next*
  // boundary every time (self-correcting — no drift accumulates even if a
  // single setTimeout fires a few ms late). The very first tick after
  // pressing Start is discarded: it covers whatever partial, unaligned
  // audio arrived between the click and the first boundary, not a full
  // inter-boundary window.
  // UK: Слоти FT8 починаються рівно на межах UTC по 15с (…00, …15, …30,
  // …45). Різати буфер за кількістю семплів дрейфує від цих меж уже за
  // цикл-два, і повідомлення потрапляють на стик двох буферів і не
  // декодуються. Натомість момент розрізу планується по годиннику,
  // з перерахунком затримки до *наступної* межі щоразу — самокорекція без
  // накопичення дрейфу. Перший тик після натискання Start відкидається:
  // він покриває нестійкий шматок аудіо між кліком і першою межею, а не
  // повне міжмежове вікно.
  // DE: FT8-Slots beginnen exakt an UTC-15-Sekunden-Grenzen. Den Puffer
  // nach Samplezahl zu schneiden driftet innerhalb weniger Zyklen von
  // diesen Grenzen ab. Stattdessen wird der Schnitt selbst per Wanduhr
  // geplant, mit Neuberechnung der Verzögerung bei jedem Tick —
  // selbstkorrigierend, kein Drift. Der erste Tick nach dem Start wird
  // verworfen.
  function msUntilNextBoundary(): number {
    return SLOT_MS - (Date.now() % SLOT_MS);
  }

  function scheduleBoundary() {
    boundaryTimer = setTimeout(onBoundary, msUntilNextBoundary());
  }

  function onBoundary() {
    const captured = chunk;
    chunk = [];
    if (!awaitingFirstBoundary && captured.length > 0) {
      void processCapture(new Float32Array(captured), inputRate);
    }
    awaitingFirstBoundary = false;
    scheduleBoundary();
  }

  async function startListening() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
    } catch (error) {
      // Browsers/WebViews surface raw internal messages here ("Permission
      // dismissed", "The request is not allowed"…). Map the known error
      // names to honest, localized, actionable text instead of leaking them.
      const name = (error as Error)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        statusMessage = t('ft8MicDenied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        statusMessage = t('ft8MicNotFound');
      } else if (name === 'NotReadableError') {
        statusMessage = t('ft8MicBusy');
      } else {
        statusMessage = String((error as Error)?.message ?? error);
      }
      return;
    }

    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(stream);
    // ScriptProcessorNode is deprecated but remains the most portable way to
    // reach raw PCM across the Tauri webview targets this app ships for; an
    // AudioWorklet migration is worth revisiting once mobile audio capture
    // is validated on-device.
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    inputRate = audioContext.sampleRate;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) chunk.push(input[i]);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    awaitingFirstBoundary = true;
    scheduleBoundary();
    countdownInterval = setInterval(() => {
      nextSlotSeconds = Math.ceil(msUntilNextBoundary() / 1000);
    }, 200);

    listening = true;
    statusMessage = '';
  }

  function stopListening() {
    processor?.disconnect();
    source?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    void audioContext?.close();
    if (boundaryTimer) clearTimeout(boundaryTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    processor = null;
    source = null;
    stream = null;
    audioContext = null;
    boundaryTimer = null;
    countdownInterval = null;
    chunk = [];
    listening = false;
  }

  async function processCapture(samples: Float32Array, inputRate: number) {
    const resampled = await resampleTo12kHzMono(samples, inputRate);
    try {
      const messages = await decodeFt8(resampled);
      if (messages.length === 0) return;
      const capturedAt = new Date().toISOString();
      entries = [
        ...messages.map((message) => ({ ...message, id: crypto.randomUUID(), capturedAt })),
        ...entries
      ].slice(0, 200);
    } catch (error) {
      statusMessage = String((error as Error)?.message ?? error);
    }
  }

  async function resampleTo12kHzMono(samples: Float32Array, inputRate: number): Promise<Float32Array> {
    if (inputRate === FT8_SAMPLE_RATE) return samples;
    const durationSeconds = samples.length / inputRate;
    const offline = new OfflineAudioContext(1, Math.ceil(durationSeconds * FT8_SAMPLE_RATE), FT8_SAMPLE_RATE);
    const buffer = offline.createBuffer(1, samples.length, inputRate);
    buffer.copyToChannel(samples, 0);
    const bufferSource = offline.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(offline.destination);
    bufferSource.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  }

  function copyCallsign(text: string) {
    const call = text.split(' ').find((token, index) => index > 0 && /^[A-Z0-9/]{3,}$/.test(token));
    if (call) void navigator.clipboard?.writeText(call);
  }

  function logEntry(entry: LogEntry) {
    const message = parseFt8Message(entry.text);
    if (!impliesCompletedExchange(message) || !onLogQso) return;
    const call = otherStationCall(message, myCall);
    onLogQso({
      call,
      grid: message.type === 'GRID' ? message.grid : undefined,
      rstSent: message.type === 'REPORT' ? message.report : undefined,
      capturedAt: entry.capturedAt
    });
  }
</script>

<section class="ft8-panel">
  <div class="ft8-controls">
    {#if !listening}
      <button class="ft8-toggle" onclick={startListening}>{t('ft8Start')}</button>
    {:else}
      <button class="ft8-toggle ft8-toggle--active" onclick={stopListening}>{t('ft8Stop')}</button>
    {/if}
    {#if listening}
      <span class="ft8-countdown">{t('ft8NextSlot')} {nextSlotSeconds}s</span>
    {/if}
    <span class="ft8-hint">{t('ft8Hint')}</span>
  </div>

  {#if statusMessage}
    <p class="ft8-error">{statusMessage}</p>
  {/if}

  {#if entries.length === 0}
    <div class="ft8-empty">◇ {t('ft8Empty')}</div>
  {:else}
    <ul class="ft8-list">
      {#each entries as entry (entry.id)}
        {@const message = parseFt8Message(entry.text)}
        <li class="ft8-entry">
          <span class="ft8-db">{entry.db > 0 ? '+' : ''}{entry.db.toFixed(0)} dB</span>
          <span class="ft8-df">{entry.df.toFixed(0)} Hz</span>
          <span class="ft8-type" class:ft8-type--exchange={impliesCompletedExchange(message)}>{message.type}</span>
          <span class="ft8-text">{entry.text}</span>
          {#if impliesCompletedExchange(message) && onLogQso}
            <button class="ft8-log" onclick={() => logEntry(entry)} title={t('ft8LogQso')}>{t('ft8LogQso')}</button>
          {/if}
          <button class="ft8-copy" onclick={() => copyCallsign(entry.text)} title={t('ft8CopyCall')}>⧉</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .ft8-panel { display: flex; flex-direction: column; gap: 14px; }
  .ft8-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .ft8-toggle {
    padding: 10px 18px; border-radius: 12px; border: 1px solid #47556966;
    background: var(--cyan); color: #0b1220; font-weight: 800; cursor: pointer;
    white-space: nowrap; flex-shrink: 0;
  }
  .ft8-toggle--active { background: #ff948c; }
  .ft8-hint { color: #64748b; font-size: 12px; }
  .ft8-countdown { color: var(--cyan); font-size: 12px; font-weight: 800; font-family: monospace; }
  .ft8-error { color: #ff948c; }
  .ft8-empty { display: grid; place-items: center; min-height: 160px; color: #475569; font-size: 40px; }
  .ft8-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ft8-entry {
    display: grid; grid-template-columns: 60px 70px 64px 1fr auto auto; align-items: center; gap: 10px;
    padding: 8px 12px; border: 1px solid #47556966; border-radius: 10px; background: #172033e6;
    font-family: monospace; font-size: 13px;
  }
  .ft8-db { color: var(--cyan); }
  .ft8-df { color: #94a3b8; }
  .ft8-type { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
  .ft8-type--exchange { color: var(--cyan); font-weight: 800; }
  .ft8-log {
    padding: 4px 10px; border-radius: 8px; border: 1px solid var(--cyan); background: transparent;
    color: var(--cyan); font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap;
  }
  .ft8-copy { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; }
</style>
