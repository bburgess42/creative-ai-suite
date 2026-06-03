/**
 * Generic list-generation runner built on prompt packs.
 *
 * Most "give me N options" features (titles, taglines, hooks, tags) share the
 * same shape: build a prompt, call the model, parse a JSON array of strings
 * with a forgiving fallback for when the model ignores the format. That shared
 * logic lives here once instead of being copy-pasted per feature.
 */

import { callGemini, type GeminiCallOptions } from "./gemini.js";
import type { PromptPack, PromptVars } from "./prompt-pack.js";

export interface ParseListOptions {
  /** Drop items shorter than this (after trimming). Default 1. */
  minLength?: number;
  /** Cap the number of items returned. */
  limit?: number;
}

/**
 * Pull a list of strings out of a model response.
 *
 * Strategy: try to parse the first `[...]` block as JSON; if that fails, fall
 * back to splitting on newlines and stripping list markers / quotes. Models
 * drift between these two formats, so we handle both.
 */
export function parseStringList(response: string, opts: ParseListOptions = {}): string[] {
  const minLength = opts.minLength ?? 1;

  const clean = (items: string[]) => {
    const out = items
      .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
      .filter((s) => s.length >= minLength);
    return opts.limit ? out.slice(0, opts.limit) : out;
  };

  const match = response.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return clean(parsed.map((x) => String(x)));
    } catch {
      // fall through to line-based parsing
    }
  }

  const lines = response
    .split("\n")
    // Strip only real list markers ("- ", "* ", "1. ", "2) ") — not leading
    // digits that are part of the content (e.g. "2024.5 release notes").
    .map((l) => l.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""));
  return clean(lines);
}

/**
 * Run a prompt pack and return a parsed list of strings, with usage logged to
 * the cost ledger under the pack's id.
 */
export async function generateList(
  pack: PromptPack,
  vars: PromptVars,
  opts: ParseListOptions & Pick<GeminiCallOptions, "project" | "temperature" | "model"> = {},
): Promise<string[]> {
  const userPrompt = pack.buildUserPrompt(vars);
  const response = await callGemini(pack.system, userPrompt, {
    endpoint: `${pack.id}.generate`,
    project: opts.project,
    temperature: opts.temperature,
    model: opts.model,
  });
  return parseStringList(response, opts);
}
