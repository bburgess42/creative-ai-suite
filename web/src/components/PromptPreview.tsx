import { useMemo, useState } from "react";
import { titleIdeasPack } from "@toolkit/llm/prompt-pack.js";

export function PromptPreview() {
  const [topic, setTopic] = useState("a 3-hour deep focus ambient mix");
  const [count, setCount] = useState(6);
  const [keywords, setKeywords] = useState("study, calm, rain");

  const userPrompt = useMemo(
    () =>
      titleIdeasPack.buildUserPrompt({
        topic,
        count,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    [topic, count, keywords],
  );

  return (
    <div className="grid">
      <section className="card">
        <h3>Inputs</h3>
        <label className="stack">
          Topic
          <input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <label className="stack">
          Count
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label className="stack">
          Keywords (comma-separated)
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </label>
        <p className="muted">
          The pack id <code>{titleIdeasPack.id}</code> is used as the cost-ledger
          label when this runs server-side (<code>{titleIdeasPack.id}.generate</code>).
        </p>
      </section>

      <section className="card">
        <h3>System prompt</h3>
        <pre className="prompt">{titleIdeasPack.system}</pre>
        <h3>User prompt (built from inputs)</h3>
        <pre className="prompt">{userPrompt}</pre>
        <p className="muted">
          In production, <code>generateList(titleIdeasPack, vars)</code> sends these to
          Gemini, parses the JSON array out of the reply, and logs token cost — all
          from one call. Here we preview the prompt so the demo needs no API key.
        </p>
      </section>
    </div>
  );
}
