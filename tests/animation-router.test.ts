import { describe, it, expect } from "vitest";
import { selectBackend, estimateCost, type SelectionResult } from "../src/media/animation-router.js";

describe("animation-router.selectBackend", () => {
  it("picks the cheapest qualifying backend by default", () => {
    const r = selectBackend({ durationSec: 10 }) as SelectionResult;
    // immersity is cheapest at $0.01/s
    expect(r.backend).toBe("immersity");
    expect(r.estimatedCost).toBeCloseTo(0.1, 6);
  });

  it("excludes parallax-only backends when generative motion is required", () => {
    const r = selectBackend({ durationSec: 8, needsGenerativeMotion: true }) as SelectionResult;
    // immersity is out; luma ($0.06) beats kling ($0.075)
    expect(r.backend).toBe("luma");
  });

  it("respects duration limits", () => {
    // 12s exceeds kling/luma (10/9s) but immersity (30s) survives
    const r = selectBackend({ durationSec: 12, needsGenerativeMotion: false }) as SelectionResult;
    expect(r.backend).toBe("immersity");

    const fail = selectBackend({ durationSec: 12, needsGenerativeMotion: true });
    expect(fail.backend).toBeNull();
  });

  it("fails with per-backend reasons when budget is too low", () => {
    const r = selectBackend({ durationSec: 10, needsGenerativeMotion: true, maxBudget: 0.01 });
    expect(r.backend).toBeNull();
    if (r.backend === null) {
      expect(r.considered.some((c) => c.note.includes("budget"))).toBe(true);
    }
  });

  it("estimateCost charges the 1080p premium for kling", () => {
    expect(estimateCost("kling", 10, "720p")).toBeCloseTo(0.75, 6);
    expect(estimateCost("kling", 10, "1080p")).toBeCloseTo(1.0, 6);
  });
});
