/**
 * Example scoring profiles for content-scorer.ts.
 *
 * A profile is just the domain vocabulary the rubric scores against. Swap the
 * profile to retarget the scorer at a different niche without changing any
 * scoring logic.
 */

import type { ScoringProfile } from "./content-scorer.js";

/** Ambient / wellness audio content (long-form video, podcasts). */
export const ambientAudioProfile: ScoringProfile = {
  keywords: [
    "relaxation",
    "meditation",
    "ambient",
    "focus",
    "calm",
    "soothing",
    "nature sounds",
    "white noise",
    "study",
  ],
  trustSignals: ["continuous", "uninterrupted", "no talking", "all night", "non-stop"],
  // Reward mentioning a duration (e.g. "8 hours", "30 min") — a strong search signal here.
  specSignal: /\d+\s*(hours?|hrs?|minutes?|min)\b/i,
};

/** Generic tech / tutorial content. */
export const tutorialProfile: ScoringProfile = {
  keywords: ["tutorial", "guide", "how to", "beginner", "step by step", "example", "walkthrough"],
  trustSignals: ["free", "no signup", "open source", "full course"],
};
