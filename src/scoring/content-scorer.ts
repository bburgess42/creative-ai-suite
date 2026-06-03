/**
 * Heuristic scorer for long-form video/article descriptions.
 *
 * Originally the keyword and trust-signal lists were hard-coded for one niche.
 * They've been lifted into an injectable `ScoringProfile` so the same rubric
 * works for any domain — you supply the vocabulary, the rubric stays put. A
 * ready-made profile lives in ./profiles.ts.
 *
 * The rubric rewards the things that actually move SEO + click-through on a
 * description: a keyworded first fold, sensible length, chapter timestamps,
 * 3-5 hashtags, a call to action, a couple of links, no keyword stuffing,
 * readable language, and domain-specific signals.
 */

export interface ScoringProfile {
  /** Primary keywords for the niche; presence + non-stuffing is scored. */
  keywords: string[];
  /** Phrases that build trust / match high-intent searches. */
  trustSignals: string[];
  /** Optional regex flagging a domain "spec" signal (e.g. duration, size). */
  specSignal?: RegExp;
}

export interface DescScoreBreakdown {
  firstFold: number; // 0-20
  length: number; // 0-15
  timestamps: number; // 0-10
  hashtags: number; // 0-10
  cta: number; // 0-10
  links: number; // 0-10
  naturalLanguage: number; // 0-10
  readability: number; // 0-5
  specSignal: number; // 0-5
  trustSignals: number; // 0-5
}

export interface DescScore {
  total: number; // 0-100
  breakdown: DescScoreBreakdown;
  suggestions: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scoreDescription(description: string, profile: ScoringProfile): DescScore {
  const suggestions: string[] = [];
  const lower = description.toLowerCase();
  const charCount = description.length;

  // 1. First fold (0-20): the first 157 chars are what search results show.
  let firstFold: number;
  const first157 = lower.slice(0, 157);
  const hasKeywordInFold = profile.keywords.some((kw) => first157.includes(kw.toLowerCase()));
  if (hasKeywordInFold && first157.length >= 100) {
    firstFold = 20;
  } else if (hasKeywordInFold) {
    firstFold = 15;
  } else if (first157.length >= 50) {
    firstFold = 8;
    suggestions.push("Put a primary keyword in the first 157 chars (shown in search results).");
  } else {
    firstFold = 3;
    suggestions.push("First 157 chars are critical — add keywords + a value prop.");
  }

  // 2. Length (0-15): 800-1300 is the sweet spot.
  let length: number;
  if (charCount >= 800 && charCount <= 1300) {
    length = 15;
  } else if (charCount >= 500 && charCount <= 2000) {
    length = 10;
  } else if (charCount >= 200) {
    length = 5;
    suggestions.push(`Description is ${charCount} chars — aim for 800-1300.`);
  } else {
    length = 2;
    suggestions.push("Description is too short — aim for 800-1300 characters.");
  }

  // 3. Timestamps (0-10): chapters need a 0:00 anchor.
  let timestamps: number;
  const hasTimestamps = /\d{1,2}:\d{2}/.test(description);
  const startsWithZero = /(^|\s)0?0:00/.test(description);
  if (hasTimestamps && startsWithZero) {
    timestamps = 10;
  } else if (hasTimestamps) {
    timestamps = 7;
    suggestions.push("Timestamps should start at 0:00 for chapters to register.");
  } else {
    timestamps = 0;
    suggestions.push("Add timestamps for chapters (boosts retention + SEO).");
  }

  // 4. Hashtags (0-10): 3-5 is ideal. Unicode-aware so non-ASCII tags count.
  const hashtagCount = (description.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  let hashtags: number;
  if (hashtagCount >= 3 && hashtagCount <= 5) {
    hashtags = 10;
  } else if (hashtagCount >= 1 && hashtagCount <= 8) {
    hashtags = 6;
  } else if (hashtagCount > 8) {
    hashtags = 3;
    suggestions.push("Too many hashtags — use 3-5.");
  } else {
    hashtags = 0;
    suggestions.push("Add 3-5 hashtags (the first 3 surface above the title).");
  }

  // 5. CTA (0-10).
  const hasCta = /subscribe|playlist|watch next|full version|check out|listen to|more videos|follow/i.test(
    description,
  );
  const cta = hasCta ? 10 : 0;
  if (!hasCta) suggestions.push("Add a call to action (subscribe / playlist / watch next).");

  // 6. Links (0-10): 2-5 is healthy.
  const linkCount = (description.match(/https?:\/\/\S+/g) || []).length;
  let links: number;
  if (linkCount >= 2 && linkCount <= 5) {
    links = 10;
  } else if (linkCount === 1) {
    links = 5;
    suggestions.push("Add at least 2 links (e.g. playlist + channel).");
  } else if (linkCount > 5) {
    links = 7;
  } else {
    links = 0;
    suggestions.push("Add links to your playlist and channel.");
  }

  // 7. Natural language (0-10): penalize keyword stuffing.
  let naturalLanguage = 10;
  for (const kw of profile.keywords) {
    const count = (lower.match(new RegExp(escapeRegExp(kw.toLowerCase()), "g")) || []).length;
    if (count > 4) {
      naturalLanguage = 3;
      suggestions.push(`"${kw}" appears ${count} times — reduce repetition.`);
      break;
    }
  }

  // 8. Readability (0-5): crude avg-word-length proxy for grade level.
  const words = description.split(/\s+/).filter(Boolean);
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);
  let readability: number;
  if (avgWordLen <= 5.5) readability = 5;
  else if (avgWordLen <= 6.5) readability = 3;
  else {
    readability = 1;
    suggestions.push("Use simpler language — aim for ~grade 8 readability.");
  }

  // 9. Spec signal (0-5): optional domain regex (duration, dimensions, etc.).
  let specSignal = 0;
  if (profile.specSignal) {
    if (profile.specSignal.test(description)) specSignal = 5;
    else suggestions.push("Include a domain spec signal (e.g. duration / size) for search discovery.");
  } else {
    specSignal = 5; // no spec requirement for this profile
  }

  // 10. Trust signals (0-5).
  const hasTrust = profile.trustSignals.some((ts) => lower.includes(ts.toLowerCase()));
  const trustSignals = hasTrust ? 5 : 0;
  if (!hasTrust && profile.trustSignals.length > 0) {
    suggestions.push("Add a trust signal (a high-intent phrase your audience searches for).");
  }

  const breakdown: DescScoreBreakdown = {
    firstFold,
    length,
    timestamps,
    hashtags,
    cta,
    links,
    naturalLanguage,
    readability,
    specSignal,
    trustSignals,
  };

  return {
    total: Object.values(breakdown).reduce((a, b) => a + b, 0),
    breakdown,
    suggestions,
  };
}
