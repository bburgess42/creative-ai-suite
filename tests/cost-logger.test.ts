import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logCost, logGeminiUsage, rollup, type LedgerEntry } from "../src/cost/cost-logger.js";

let ledgerFile: string;

beforeEach(() => {
  // Point the logger at a throwaway file via the env override.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cas-ledger-"));
  ledgerFile = path.join(dir, "api-costs.json");
  process.env.COST_LEDGER_PATH = ledgerFile;
});

afterEach(() => {
  delete process.env.COST_LEDGER_PATH;
  try {
    fs.rmSync(path.dirname(ledgerFile), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

function readLedger(): LedgerEntry[] {
  return JSON.parse(fs.readFileSync(ledgerFile, "utf-8"));
}

describe("cost-logger", () => {
  it("appends an entry and returns the rounded total", () => {
    const total = logCost({ service: "gemini", model: "gemini-2.5-flash", units: 1000, costPerUnit: 0.0001 });
    expect(total).toBeCloseTo(0.1, 6);
    const ledger = readLedger();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].service).toBe("gemini");
    expect(ledger[0].total).toBeCloseTo(0.1, 6);
    expect(ledger[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accumulates multiple entries", () => {
    logCost({ service: "a", model: "m", units: 1, costPerUnit: 1 });
    logCost({ service: "b", model: "m", units: 1, costPerUnit: 2 });
    expect(readLedger()).toHaveLength(2);
  });

  it("folds thinking tokens into the output bucket", () => {
    const cost = logGeminiUsage({
      endpoint: "test.endpoint",
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 500, thoughtsTokenCount: 500 },
    });
    // input: 1000 * 0.30/1M, output: 1000 * 2.50/1M
    expect(cost).toBeCloseTo(0.0003 + 0.0025, 6);
    const entry = readLedger()[0];
    expect(entry.description).toContain("out:1000");
  });

  it("is a no-op for missing/empty usage metadata", () => {
    expect(logGeminiUsage({ endpoint: "x", usageMetadata: null })).toBe(0);
    expect(logGeminiUsage({ endpoint: "x", usageMetadata: {} })).toBe(0);
    expect(fs.existsSync(ledgerFile)).toBe(false);
  });

  it("rolls up totals by month and service", () => {
    logCost({ service: "gemini", model: "m", units: 1, costPerUnit: 1 });
    logCost({ service: "gemini", model: "m", units: 1, costPerUnit: 2 });
    logCost({ service: "luma", model: "m", units: 1, costPerUnit: 5 });
    const months = rollup(readLedger());
    const month = Object.keys(months)[0];
    expect(months[month].gemini).toBeCloseTo(3, 6);
    expect(months[month].luma).toBeCloseTo(5, 6);
  });
});
