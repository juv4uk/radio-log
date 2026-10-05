# GPU candidate inventory for SENS-RADIO

Tracking: #39  
Shared CUDA mechanism: `juv4uk/cml#472`  
Canonical host capability: `juv4uk/ecosystem#60`

This inventory starts from code that already exists in `radio-log`. It does
not create DSP work merely to use a GPU.

The machine-readable source of this table is
`docs/sens-radio-gpu-candidates.json`.

## First candidates

| Priority | Existing function | Why it can parallelize | Current verdict |
|---|---|---|---|
| P0 | `decodeAlignedBpsk` | one independent reduction per aligned symbol | **BLOCKED-MECHANISM** |
| P0 | `decodeAlignedBfsk` | two independent tone-energy reductions per aligned symbol | **BLOCKED-MECHANISM** |
| P1 | `resampleLinear` | each output sample reads at most two input samples | **BLOCKED-NUMERIC-CONTRACT** |
| P2 | `encodeAlignedBpsk` | each sample is determined by global index + symbol sign | **BLOCKED-NUMERIC-CONTRACT** |

The current CML shared-worker protocol exposes only bounded integer operations
(`add-i32`, `chain-file-i32`, and provenance form). There is no float/trig
reduction capability yet. Therefore this repository must not invent a private
CUDA path around CML.

## Why aligned decode is the strongest first workload

The current laboratory profiles use 8,000 samples/s and 100 symbols/s, so one
symbol is **80 Float64 samples**. A `Float64Array` is contiguous and each
sample occupies 8 bytes.

For BPSK, one symbol reduces those 80 samples into three accumulators:
correlation, observed energy and reference energy. Different symbols do not
share mutable state after alignment.

For BFSK, one symbol evaluates two tones independently. Each tone accumulates
real and imaginary correlation components, then computes energy. The current
implementation therefore performs four trigonometric evaluations per input
sample across the two tone-energy calls. This is substantially heavier than a
plain map and is a plausible GPU research workload.

What does **not** move with that kernel:

```text
samples
  -> [GPU candidate: aligned per-symbol reduction]
  -> bit/confidence decisions
  -> [CPU] threshold / frame bytes / CRC / acquisition / semantic verdict
```

The CPU implementation remains the oracle.

## Numeric parity boundary

A GPU result must never define the expected radio result.

For the first BPSK/BFSK experiment:

1. CPU generates or receives the same aligned sample corpus.
2. CPU decoder produces expected decisions.
3. GPU candidate consumes exactly the same sample values.
4. **Decision bits must match exactly.**
5. Correlation/energy/confidence values need a separately ratified floating
   relation before those numbers may be called parity evidence.
6. Complete recovered SENS-RADIO frame identity remains an exact CPU check.
7. Only after parity passes do we compare transfer, queue, kernel and total time.

This is deliberately stricter than “both decoded the same friendly fixture”:
near a decision boundary, different floating reduction orders can alter a bit.

## Candidates deliberately kept off GPU for now

### Deterministic AWGN

`addDeterministicAwgn` uses a sequential xorshift32 state followed by
Box-Muller pairs. Its deterministic sample stream depends on that order.
Replacing it with one random stream per GPU thread would silently change the
test corpus. A GPU version needs a proven skip-ahead/equivalence rule or should
consume CPU-pre-generated noise.

### BFSK transmit

`encodeAlignedBfsk` carries a rolling phase from one sample/symbol to the
next. A closed-form global phase could be parallel, but equivalence to the
current waveform must be proven first. It is not the first offload target.

### Frame acquisition and CRC

`acquireSensRadioFromAlignedBpsk` contains scanning, variable frame lengths,
CRC validation, two phase polarities, confidence filtering and candidate
deduplication. That is control/oracle logic, not a reason to turn the entire
receiver into a GPU kernel.

CRC/packing could become useful across a very large batch of independent
frames, but one frame is too small to justify transfer/launch overhead.

### FT8

`src/lib/ft8/codec.ts` deliberately delegates to the existing `ft8js`
Emscripten/WASM implementation. Rewriting that decoder for CUDA is a different
project and would create a second semantic/mechanism surface. Keep WASM as the
current substrate/oracle unless profiling identifies one explicit bounded
kernel.

## CPU baseline

Run:

```bash
npm run bench:gpu-candidates
```

The baseline writes `artifacts/sens-radio-gpu-cpu-baseline.json`.

Default modem sizes are 1,024 / 10,000 / 100,000 bits. At 80 samples/bit, the
100k case materializes 8,000,000 Float64 samples — 64 MB of raw waveform before
JavaScript object overhead. A 1,000,000-bit modem case would require about
640 MB for one raw Float64 waveform alone, so it is intentionally not the
default on the 16-GB owner host. The resampler has its own sample ladder up to
1,000,000 because its input is only one Float64 vector.

Every modem row must recover the exact original bit string. The script records
CPU time and corpus hashes as **baseline evidence**, not as a GPU performance
claim.

## Next CML contract

The first useful CML child is not “generic DSP”. It is a bounded operation with
an explicit shape, for example:

```text
aligned BPSK/BFSK symbol-reduction batch
input:  contiguous f64 samples + validated fixed config
output: per-symbol reduction evidence
oracle: radio-log CPU implementation
verdict: exact decision bits + separately defined float relation
```

Until that bounded capability exists, #39 is correctly
`BLOCKED-MECHANISM` rather than “GPU ready”.
