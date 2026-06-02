import { useMemo, useState } from "react";
import {
  BACKENDS,
  estimateCost,
  selectBackend,
  type AnimationBackend,
  type Quality,
} from "@toolkit/media/animation-router.js";

const BACKEND_ORDER: AnimationBackend[] = ["immersity", "luma", "kling"];

export function CostRouterExplorer() {
  const [durationSec, setDurationSec] = useState(8);
  const [minQuality, setMinQuality] = useState<Quality>("720p");
  const [needsLoop, setNeedsLoop] = useState(false);
  const [needsGenerativeMotion, setNeedsGenerativeMotion] = useState(true);
  const [maxBudget, setMaxBudget] = useState(0.5);

  const result = useMemo(
    () =>
      selectBackend({ durationSec, minQuality, needsLoop, needsGenerativeMotion, maxBudget }),
    [durationSec, minQuality, needsLoop, needsGenerativeMotion, maxBudget],
  );

  const chosen = result.backend;

  return (
    <div className="grid">
      <section className="controls card">
        <h3>Constraints</h3>

        <label>
          Duration: <strong>{durationSec}s</strong>
          <input
            type="range"
            min={2}
            max={30}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
          />
        </label>

        <label className="row">
          Minimum quality
          <select value={minQuality} onChange={(e) => setMinQuality(e.target.value as Quality)}>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={needsLoop} onChange={(e) => setNeedsLoop(e.target.checked)} />
          Needs seamless loop
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={needsGenerativeMotion}
            onChange={(e) => setNeedsGenerativeMotion(e.target.checked)}
          />
          Needs generative motion (not just parallax)
        </label>

        <label>
          Max budget: <strong>${maxBudget.toFixed(2)}</strong>
          <input
            type="range"
            min={0.05}
            max={2}
            step={0.05}
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="card">
        <h3>Decision</h3>
        {chosen ? (
          <div className="decision ok">
            <div className="decision-backend">{result.spec.label}</div>
            <div className="decision-cost">${result.estimatedCost.toFixed(2)}</div>
            <div className="decision-note">cheapest backend that meets every constraint</div>
          </div>
        ) : (
          <div className="decision fail">
            <div className="decision-backend">No backend qualifies</div>
            <div className="decision-note">{result.reason}</div>
          </div>
        )}

        <table className="backends">
          <thead>
            <tr>
              <th>Backend</th>
              <th>Max</th>
              <th>Loop</th>
              <th>Motion</th>
              <th>Cost @ {durationSec}s</th>
            </tr>
          </thead>
          <tbody>
            {BACKEND_ORDER.map((id) => {
              const spec = BACKENDS[id];
              const cost = estimateCost(id, durationSec, minQuality);
              return (
                <tr key={id} className={id === chosen ? "chosen" : ""}>
                  <td>
                    {id === chosen ? "✓ " : ""}
                    {spec.label}
                  </td>
                  <td>
                    {spec.maxQuality} / {spec.maxDurationSec}s
                  </td>
                  <td>{spec.supportsLoop ? "yes" : "no"}</td>
                  <td>{spec.generativeMotion ? "generative" : "parallax"}</td>
                  <td>${cost.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
