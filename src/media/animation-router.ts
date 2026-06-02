/**
 * Cost-aware backend selection for image-to-video animation.
 *
 * The suite can animate a still image through several providers with very
 * different economics and capabilities. Rather than hard-coding one provider,
 * features describe what they need (duration, quality floor, whether the clip
 * must loop, an optional budget cap) and this router picks the cheapest
 * backend that satisfies the constraints — or explains why none fit.
 *
 * Per-second rates live in cost/pricing.ts so billing math has one home.
 */

import { ANIMATION_PRICING } from "../cost/pricing.js";

export type AnimationBackend = "kling" | "luma" | "immersity";
export type Quality = "720p" | "1080p";

export interface BackendSpec {
  backend: AnimationBackend;
  label: string;
  /** Highest quality this backend can emit. */
  maxQuality: Quality;
  /** Longest single clip, in seconds. */
  maxDurationSec: number;
  /** Whether the backend can produce a seamless loop natively. */
  supportsLoop: boolean;
  /** True for true generative motion; false for depth/parallax only. */
  generativeMotion: boolean;
}

const QUALITY_RANK: Record<Quality, number> = { "720p": 0, "1080p": 1 };

export const BACKENDS: Record<AnimationBackend, BackendSpec> = {
  kling: {
    backend: "kling",
    label: "Kling 3.0 (EvoLink)",
    maxQuality: "1080p",
    maxDurationSec: 10,
    supportsLoop: true,
    generativeMotion: true,
  },
  luma: {
    backend: "luma",
    label: "Luma Ray2",
    maxQuality: "1080p",
    maxDurationSec: 9,
    supportsLoop: true,
    generativeMotion: true,
  },
  immersity: {
    backend: "immersity",
    label: "Immersity (depth parallax)",
    maxQuality: "1080p",
    maxDurationSec: 30,
    supportsLoop: true,
    generativeMotion: false,
  },
};

/** Estimated cost in USD for a clip on a given backend. */
export function estimateCost(
  backend: AnimationBackend,
  durationSec: number,
  quality: Quality = "720p",
): number {
  const key =
    backend === "kling" && quality === "1080p" ? "kling-1080p" : backend;
  const rate = ANIMATION_PRICING[key as keyof typeof ANIMATION_PRICING];
  return Math.round(rate * durationSec * 10000) / 10000;
}

export interface SelectionRequest {
  durationSec: number;
  /** Minimum acceptable quality. Defaults to "720p". */
  minQuality?: Quality;
  /** Require a natively seamless loop. */
  needsLoop?: boolean;
  /** Require true generative motion (excludes depth-only parallax). */
  needsGenerativeMotion?: boolean;
  /** Maximum spend in USD for this clip. */
  maxBudget?: number;
}

export interface SelectionResult {
  backend: AnimationBackend;
  spec: BackendSpec;
  quality: Quality;
  estimatedCost: number;
}

export interface SelectionFailure {
  backend: null;
  reason: string;
  /** Every backend considered, with why it was rejected (or its cost). */
  considered: Array<{ backend: AnimationBackend; ok: boolean; note: string }>;
}

/**
 * Pick the cheapest backend that satisfies the request. Returns a
 * SelectionResult on success or a SelectionFailure (with per-backend reasons)
 * when nothing qualifies.
 */
export function selectBackend(
  req: SelectionRequest,
): SelectionResult | SelectionFailure {
  const minQuality: Quality = req.minQuality ?? "720p";
  const considered: SelectionFailure["considered"] = [];
  const candidates: SelectionResult[] = [];

  for (const spec of Object.values(BACKENDS)) {
    if (QUALITY_RANK[spec.maxQuality] < QUALITY_RANK[minQuality]) {
      considered.push({ backend: spec.backend, ok: false, note: `max quality ${spec.maxQuality} < required ${minQuality}` });
      continue;
    }
    if (req.durationSec > spec.maxDurationSec) {
      considered.push({ backend: spec.backend, ok: false, note: `max duration ${spec.maxDurationSec}s < required ${req.durationSec}s` });
      continue;
    }
    if (req.needsLoop && !spec.supportsLoop) {
      considered.push({ backend: spec.backend, ok: false, note: "no native loop support" });
      continue;
    }
    if (req.needsGenerativeMotion && !spec.generativeMotion) {
      considered.push({ backend: spec.backend, ok: false, note: "depth/parallax only, no generative motion" });
      continue;
    }

    // Use the lowest quality that still meets the floor — cheapest that qualifies.
    const quality = minQuality;
    const estimatedCost = estimateCost(spec.backend, req.durationSec, quality);
    if (req.maxBudget !== undefined && estimatedCost > req.maxBudget) {
      considered.push({ backend: spec.backend, ok: false, note: `cost $${estimatedCost.toFixed(2)} > budget $${req.maxBudget.toFixed(2)}` });
      continue;
    }
    considered.push({ backend: spec.backend, ok: true, note: `$${estimatedCost.toFixed(2)}` });
    candidates.push({ backend: spec.backend, spec, quality, estimatedCost });
  }

  if (candidates.length === 0) {
    return { backend: null, reason: "no backend satisfies the constraints", considered };
  }

  candidates.sort((a, b) => a.estimatedCost - b.estimatedCost);
  return candidates[0]!;
}
