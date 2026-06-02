/**
 * A "prompt pack" bundles a system instruction with a user-prompt builder for
 * one generation task. Packs make prompts reusable, testable, and swappable
 * without touching the model-call plumbing — the same `generateList` runner
 * drives any pack.
 *
 * This file ships one example pack. In a real product you'd keep a pack per
 * feature (titles, taglines, hooks, summaries) and select by id.
 */

export interface PromptVars {
  [key: string]: string | number | string[];
}

export interface PromptPack {
  /** Stable id, used as the cost-ledger endpoint label. */
  id: string;
  /** System instruction sent with every call for this pack. */
  system: string;
  /** Build the user prompt from caller-supplied variables. */
  buildUserPrompt(vars: PromptVars): string;
}

/** Example: generate a list of short, punchy content title ideas. */
export const titleIdeasPack: PromptPack = {
  id: "titles",
  system: [
    "You are a content title strategist.",
    "Write concise, specific, high-signal titles — no clickbait, no emoji.",
    "Return ONLY a JSON array of title strings, nothing else.",
  ].join(" "),
  buildUserPrompt: (vars) => {
    const topic = String(vars.topic ?? "");
    const count = Number(vars.count ?? 6);
    const keywords = Array.isArray(vars.keywords) ? vars.keywords.join(", ") : "";
    const lines = [
      `Generate ${count} title ideas for: "${topic}".`,
      keywords ? `Weave in these themes where natural: ${keywords}.` : "",
      "Each title under 70 characters.",
      `Return a JSON array of ${count} strings.`,
    ];
    return lines.filter(Boolean).join("\n");
  },
};
