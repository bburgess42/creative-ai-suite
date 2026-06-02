import { describe, it, expect } from "vitest";
import {
  geminiCost,
  imagenCost,
  animationCost,
  elevenlabsCost,
} from "../src/cost/pricing.js";

describe("pricing helpers", () => {
  it("computes Gemini cost from input/output tokens", () => {
    // 1M input + 1M output on flash = $0.30 + $2.50
    expect(geminiCost("gemini-2.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(2.8, 6);
  });

  it("scales Imagen cost by image count and tier", () => {
    expect(imagenCost("imagen-4.0-ultra", 4)).toBeCloseTo(0.24, 6);
    expect(imagenCost("imagen-4.0-fast", 4)).toBeCloseTo(0.08, 6);
  });

  it("computes animation cost per second", () => {
    expect(animationCost("kling", 10)).toBeCloseTo(0.75, 6);
    expect(animationCost("immersity", 10)).toBeCloseTo(0.1, 6);
  });

  it("computes TTS cost per character", () => {
    expect(elevenlabsCost(1000)).toBeCloseTo(0.22, 6);
  });

  it("ranks backends cheapest-to-priciest for equal duration", () => {
    const d = 10;
    expect(animationCost("immersity", d)).toBeLessThan(animationCost("luma", d));
    expect(animationCost("luma", d)).toBeLessThan(animationCost("kling", d));
  });
});
