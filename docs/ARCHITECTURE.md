# Architecture

Deeper notes on the three subsystems that carry the most design weight: the
cost ledger, the animation router, and the job runner.

## 1. Cost ledger (`src/cost/`)

### Goal
Make every dollar of AI spend attributable after the fact, without standing up
a database or a metrics pipeline.

### Shape
A single append-only JSON file. Each entry:

```jsonc
{
  "timestamp": "2026-06-02T21:00:00.000Z",
  "date": "2026-06-02",          // denormalized for cheap day/month grouping
  "month": "2026-06",
  "service": "gemini",
  "model": "gemini-2.5-flash",
  "units": 1500,                  // tokens, images, seconds, or characters
  "cost_per_unit": 0.0000018,     // blended rate for this entry
  "total": 0.0027,
  "description": "titles.generate (in:1000 out:500)",
  "project": "creative-ai-suite"
}
```

### Design decisions
- **One blended rate per entry.** Gemini bills input and output tokens at
  different rates (and counts "thinking" tokens as output). Rather than store
  two columns, `logGeminiUsage` computes total cost, then back-solves a single
  blended per-token rate. Downstream rollups can `sum(total)` without
  re-deriving anything.
- **Denormalized `date`/`month`.** Grouping for a spend chart is a string
  prefix match instead of date parsing — the file is the query engine.
- **Writes never throw.** `saveLedger` catches and logs. The worst failure mode
  is a missing ledger line, never a failed user request.
- **Writes are atomic.** Each save writes a temp file then `rename`s it into
  place, so a crash mid-write can't truncate the live ledger (rename is atomic on
  one filesystem). The read-modify-write still assumes a single writer; concurrent
  processes should use distinct `COST_LEDGER_PATH`s or a queue.
- **Two runtimes, one file.** `python/cost_tracker.py` writes the identical
  record shape, so a Python CLI render and a TypeScript API call can land in the
  same ledger. Both resolve the path the same way (`COST_LEDGER_PATH`, else
  `./data/api-costs.json`) — note that default is **relative to the working
  directory**, so set `COST_LEDGER_PATH` explicitly to guarantee both runtimes
  hit one file. The pricing tables are per-runtime; only the ledger format is shared.

### Tradeoffs
A JSON file is fine into the low tens of thousands of entries (the real
workload). Past that you'd batch-roll into monthly files or move to SQLite —
the `LedgerEntry` shape is already row-friendly.

## 2. Animation router (`src/media/animation-router.ts`)

### Goal
Stop hard-coding a video provider. Let a feature declare its needs and get the
cheapest backend that satisfies them — or a clear reason none do.

### Algorithm
For each backend in the registry:
1. Reject if `maxQuality` is below the requested floor.
2. Reject if the clip is longer than `maxDurationSec`.
3. Reject if a native loop is required and unsupported.
4. Reject if generative motion is required and the backend is parallax-only.
5. Cost it at the *quality floor* (cheapest that still qualifies); reject if it
   exceeds `maxBudget`.

Survivors are sorted by cost ascending; the cheapest wins. On total failure the
result carries a `considered[]` list with a per-backend reason — so the caller
can surface "increase budget to $0.50" instead of a silent null.

### Why a quality floor, not a target
You almost never want to *pay for* more quality than you asked for. Costing each
candidate at the minimum acceptable quality makes the cheapest-wins sort
correct by construction.

## 3. Job runner (`src/jobs/`)

### State machine
```
create() ──▶ queued ──markRunning()──▶ running ──▶ complete   (markComplete)
                │                          │
                └──────────────────────────┴────▶ error       (markError)
```
`complete` and `error` are terminal: a late callback can't resurrect a finished
job. This matters because two things race to finish a job — the child process's
own progress reporter and the parent's `close` handler. Whoever lands first
wins; the other is a no-op.

### Durability + crash recovery
- The job row is created **before** the process is spawned, so a crash between
  "user clicked" and "process started" still leaves a visible, sweepable row.
- `sweepOrphans()` runs at boot and flips any `queued`/`running` row to `error`.
  Without it, a crash leaves phantom "running" jobs forever.
- A pidfile is written next to the log so an external sweep can kill a stuck OS
  process by PID.

### Storage inversion
`spawnTrackedJob` and all callers depend on the `JobStore` *interface*. The
in-repo `InMemoryJobStore` backs the tests and local runs; production provides a
SQLite-backed implementation of the same five methods. No caller knows which is
in use — and the tests need no database and no mocks.

### The detached-spawn lesson
A naive `spawn` puts the child in the parent's process group. In a hot-reloading
dev server, saving a file sends SIGTERM to that group and kills in-flight
renders. (This is exactly how a large upload died at ~70% in production.) The
fix: `detached: true` (own process group) + `proc.unref()` (don't hold the event
loop open) + tee stdio to a log file (forensics survive the parent). Documented
inline in `spawn.ts`.
