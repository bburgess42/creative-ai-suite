import { describe, it, expect } from "vitest";
import { parseStringList } from "../src/llm/generate.js";

describe("parseStringList", () => {
  it("parses a clean JSON array", () => {
    expect(parseStringList('["one", "two", "three"]')).toEqual(["one", "two", "three"]);
  });

  it("extracts a JSON array embedded in prose", () => {
    const resp = 'Here are your titles:\n["Alpha", "Beta"]\nHope these help!';
    expect(parseStringList(resp)).toEqual(["Alpha", "Beta"]);
  });

  it("falls back to line parsing when JSON is absent", () => {
    const resp = "1. First idea\n2. Second idea\n- Third idea";
    expect(parseStringList(resp)).toEqual(["First idea", "Second idea", "Third idea"]);
  });

  it("strips wrapping quotes and applies minLength + limit", () => {
    const resp = '["ok", "x", "also fine"]';
    expect(parseStringList(resp, { minLength: 2, limit: 1 })).toEqual(["ok"]);
  });
});
