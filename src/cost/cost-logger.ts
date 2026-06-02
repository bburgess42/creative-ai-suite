/**
 * Append-only writer for a shared JSON cost ledger.
 *
 * Every paid AI call in the suite routes through here so spend is observable
 * after the fact: which endpoint, which model, how many units, how much it
 * cost. The same file format is read/written by the Python CLI (see
 * python/cost_tracker.py), so a TypeScript service and a Python script can
 * share one ledger without a database.
 *
 * Writing directly from TypeScript (rather than shelling out to Python for
 * every sub-cent text call) avoids paying more in process-spawn overhead than
 * the API call itself costs.
 */

import fs from "node:fs";
import path from "node:path";
import { GEMINI_PRICING } from "./pricing.js";

/** Where the ledger lives. Override with COST_LEDGER_PATH. */
function ledgerPath(): string {
  return process.env.COST_LEDGER_PATH || path.join(process.cwd(), "data", "api-costs.json");
}

export interface LedgerEntry {
  timestamp: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  service: string;
  model: string;
  units: number;
  cost_per_unit: number;
  total: number;
  description: string;
  project: string;
}

const DEFAULT_PROJECT = "creative-ai-suite";

function loadLedger(): LedgerEntry[] {
  try {
    const p = ledgerPath();
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf-8")) as LedgerEntry[];
  } catch {
    return [];
  }
}

function saveLedger(entries: LedgerEntry[]): void {
  try {
    const p = ledgerPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(entries, null, 2));
  } catch (err) {
    // Cost logging must NEVER crash the calling request. Swallow + report.
    console.error("[cost-logger] failed to write ledger:", err);
  }
}

/**
 * Log a single cost entry. Returns the entry's total cost in USD.
 */
export function logCost(opts: {
  service: string;
  model: string;
  units: number;
  costPerUnit: number;
  description?: string;
  project?: string;
}): number {
  const total = Math.round(opts.units * opts.costPerUnit * 10000) / 10000;
  const now = new Date();
  const iso = now.toISOString();
  const entry: LedgerEntry = {
    timestamp: iso,
    date: iso.slice(0, 10),
    month: iso.slice(0, 7),
    service: opts.service,
    model: opts.model,
    units: opts.units,
    cost_per_unit: opts.costPerUnit,
    total,
    description: (opts.description || "").slice(0, 200),
    project: opts.project || DEFAULT_PROJECT,
  };
  const ledger = loadLedger();
  ledger.push(entry);
  saveLedger(ledger);
  return total;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
}

/**
 * Log Gemini token usage straight from a response's `usageMetadata` block.
 * No-op (returns 0) when metadata is missing or empty.
 *
 * Gemini bills thinking tokens as output, so `thoughtsTokenCount` is folded
 * into the output bucket. The ledger records a single blended per-token rate
 * so downstream rollups can sum `total` without re-deriving input/output.
 */
export function logGeminiUsage(opts: {
  endpoint: string;
  model?: keyof typeof GEMINI_PRICING;
  usageMetadata: GeminiUsageMetadata | null | undefined;
  project?: string;
}): number {
  const meta = opts.usageMetadata;
  if (!meta) return 0;
  const model = opts.model || "gemini-2.5-flash";
  const inputTok = meta.promptTokenCount || 0;
  const outputTok = (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0);
  if (inputTok === 0 && outputTok === 0) return 0;

  const pricing = GEMINI_PRICING[model];
  const totalCost = inputTok * pricing.input + outputTok * pricing.output;
  const totalTok = inputTok + outputTok;
  const blendedRate = totalTok > 0 ? totalCost / totalTok : 0;

  return logCost({
    service: "gemini",
    model,
    units: totalTok,
    costPerUnit: blendedRate,
    description: `${opts.endpoint} (in:${inputTok} out:${outputTok})`,
    project: opts.project,
  });
}

/** Sum the ledger by month, then by service — handy for a spend dashboard. */
export function rollup(entries: LedgerEntry[] = loadLedger()): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    const byService = (out[e.month] ??= {});
    byService[e.service] = (byService[e.service] ?? 0) + e.total;
  }
  return out;
}
