import { describe, it, expect } from "vitest";
import { scoreDescription } from "../src/scoring/content-scorer.js";
import { ambientAudioProfile } from "../src/scoring/profiles.js";

const STRONG = [
  "Deep focus ambient music for relaxation and study — 8 hours of continuous, uninterrupted sound.",
  "",
  "Press play and drift. This mix is designed for calm, deep work, and restful nights.",
  "",
  "Chapters:",
  "0:00 Intro",
  "10:00 Deep focus",
  "60:00 Night drift",
  "",
  "Subscribe for new mixes every week, and check out the full playlist linked below.",
  "Playlist: https://example.com/playlist",
  "Channel: https://example.com/channel",
  "",
  "#ambient #relaxation #focus",
].join("\n");

describe("content-scorer", () => {
  it("scores a well-formed description highly", () => {
    const result = scoreDescription(STRONG, ambientAudioProfile);
    expect(result.total).toBeGreaterThanOrEqual(85);
    expect(result.breakdown.firstFold).toBe(20);
    expect(result.breakdown.timestamps).toBe(10);
    expect(result.breakdown.trustSignals).toBe(5);
  });

  it("penalizes a thin description and suggests fixes", () => {
    const result = scoreDescription("short clip", ambientAudioProfile);
    expect(result.total).toBeLessThan(40);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.join(" ")).toMatch(/157 chars/);
  });

  it("flags keyword stuffing", () => {
    const stuffed =
      "relaxation relaxation relaxation relaxation relaxation music for sleep and relaxation tonight.";
    const result = scoreDescription(stuffed, ambientAudioProfile);
    expect(result.breakdown.naturalLanguage).toBe(3);
    expect(result.suggestions.join(" ")).toMatch(/reduce repetition/i);
  });

  it("rewards the duration spec signal", () => {
    const withDuration = scoreDescription("ambient focus mix, 8 hours continuous", ambientAudioProfile);
    const without = scoreDescription("ambient focus mix, continuous", ambientAudioProfile);
    expect(withDuration.breakdown.specSignal).toBe(5);
    expect(without.breakdown.specSignal).toBe(0);
  });
});
