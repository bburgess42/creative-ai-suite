/**
 * Single source of truth for AI API pricing used across the suite.
 *
 * Rates verified April 2026 against the providers' published pricing pages
 * (Gemini text/image, Luma, Kling, ElevenLabs). Kept dependency-free so this
 * module can be imported from anywhere — server, CLI, or browser.
 *
 * All rates are expressed in USD.
 */

// Per-token rates ($/token), derived from the $/1M figures in the docs.
export const GEMINI_PRICING = {
  "gemini-2.5-flash": {
    input: 0.3 / 1_000_000,
    output: 2.5 / 1_000_000, // includes thinking tokens
  },
  "gemini-2.5-pro": {
    input: 1.25 / 1_000_000, // <=200k context tier
    output: 10.0 / 1_000_000, // <=200k context tier
  },
  "gemini-2.5-flash-lite": {
    input: 0.1 / 1_000_000,
    output: 0.4 / 1_000_000,
  },
} as const;

// Per-image rates ($/image) for the Imagen 4 tiers.
export const IMAGEN_PRICING = {
  "imagen-4.0-ultra": 0.06,
  "imagen-4.0-standard": 0.04,
  "imagen-4.0-fast": 0.02,
} as const;

// Per-second rates ($/sec) for video animation backends. See media/animation-router.ts.
export const ANIMATION_PRICING = {
  kling: 0.075, // Kling 3.0 720p via EvoLink
  "kling-1080p": 0.1, // Kling 3.0 1080p via EvoLink
  luma: 0.06, // Luma Ray2
  immersity: 0.01, // depth-based parallax only
} as const;

// Per-character rate ($/char) for text-to-speech.
// Effective ElevenLabs Creator-plan rate: $22/mo for 100k chars = $0.00022/char.
export const ELEVENLABS_PRICING = {
  eleven_multilingual_v2: 0.00022,
  eleven_v3: 0.00022,
} as const;

// ---------- Cost calculation helpers ----------

export function geminiCost(
  model: keyof typeof GEMINI_PRICING,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = GEMINI_PRICING[model];
  return inputTokens * p.input + outputTokens * p.output;
}

export function imagenCost(tier: keyof typeof IMAGEN_PRICING, imageCount: number): number {
  return IMAGEN_PRICING[tier] * imageCount;
}

export function animationCost(
  backend: keyof typeof ANIMATION_PRICING,
  durationSec: number,
): number {
  return ANIMATION_PRICING[backend] * durationSec;
}

export function elevenlabsCost(
  charCount: number,
  model: keyof typeof ELEVENLABS_PRICING = "eleven_multilingual_v2",
): number {
  return ELEVENLABS_PRICING[model] * charCount;
}
