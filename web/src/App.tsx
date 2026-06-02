import { useState } from "react";
import { CostRouterExplorer } from "./components/CostRouterExplorer.js";
import { DescriptionScorer } from "./components/DescriptionScorer.js";
import { PromptPreview } from "./components/PromptPreview.js";

type Tab = "router" | "scorer" | "prompt";

const TABS: Array<{ id: Tab; label: string; blurb: string }> = [
  { id: "router", label: "Cost Router", blurb: "Pick the cheapest animation backend that meets your constraints." },
  { id: "scorer", label: "Description Scorer", blurb: "Score a description against an SEO/quality rubric, live." },
  { id: "prompt", label: "Prompt Preview", blurb: "See exactly what a prompt pack sends to the model." },
];

export function App() {
  const [tab, setTab] = useState<Tab>("router");
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          creative-ai-suite <span className="tag">interactive demo</span>
        </h1>
        <p className="sub">
          Every panel below calls the <strong>real toolkit functions</strong> from{" "}
          <code>src/</code> — no mocked data. Pure logic runs in the browser; the
          production system wires the same functions to Next.js API routes with cost
          logging and live LLM/render calls.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <p className="panel-blurb">{active.blurb}</p>

      <main className="panel">
        {tab === "router" && <CostRouterExplorer />}
        {tab === "scorer" && <DescriptionScorer />}
        {tab === "prompt" && <PromptPreview />}
      </main>

      <footer className="app-footer">
        <span>
          Source: <code>web/src/components/</code> · drives <code>@toolkit/*</code>
        </span>
      </footer>
    </div>
  );
}
