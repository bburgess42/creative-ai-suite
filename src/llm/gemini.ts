/**
 * Thin Gemini client with built-in cost logging.
 *
 * `callGemini` is the canonical entry point: it makes the request and
 * automatically records token usage to the shared ledger, tagged with the
 * call site so spend is attributable per feature. Use `callGeminiWithUsage`
 * when the caller needs the raw usage metadata in addition to the text.
 */

import { logGeminiUsage, type GeminiUsageMetadata } from "../cost/cost-logger.js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface GeminiCallResult {
  text: string;
  usageMetadata: GeminiUsageMetadata | null;
}

export interface GeminiCallOptions {
  /** Identifies the call site in the cost ledger (e.g. "titles.generate"). */
  endpoint?: string;
  /** Project tag for the ledger entry. */
  project?: string;
  /** 0..2, higher = more creative. Defaults to 0.9. */
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Call Gemini and return both the text and the usage metadata, without
 * logging. Prefer `callGemini` unless you need the metadata yourself.
 */
export async function callGeminiWithUsage(
  systemPrompt: string,
  userPrompt: string,
  opts: GeminiCallOptions = {},
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.9,
        maxOutputTokens: opts.maxOutputTokens ?? 4096,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  // Gemini's response shape is loosely typed; narrow only the fields we read.
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; text?: string }> } }>;
    usageMetadata?: GeminiUsageMetadata;
  };
  // Gemini 2.5 Flash thinks by default — parts[0] may be the thought, and the
  // real answer is the last non-thought part. Fall back to parts[0] defensively.
  const parts: Array<{ thought?: boolean; text?: string }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  for (const part of parts) {
    if (!part.thought && part.text) text = part.text;
  }
  if (!text) text = parts[0]?.text ?? "";

  // Strip markdown code fences Gemini often wraps JSON in.
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  return { text, usageMetadata: data?.usageMetadata ?? null };
}

/**
 * Call Gemini and auto-log token usage to the shared ledger. This is the
 * canonical way to call the model from a feature/route handler.
 */
export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  opts: GeminiCallOptions = {},
): Promise<string> {
  const result = await callGeminiWithUsage(systemPrompt, userPrompt, opts);
  logGeminiUsage({
    endpoint: opts.endpoint || "gemini-call",
    usageMetadata: result.usageMetadata,
    project: opts.project,
  });
  return result.text;
}
