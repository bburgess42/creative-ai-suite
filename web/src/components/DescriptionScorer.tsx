import { useMemo, useState } from "react";
import { scoreDescription, type DescScoreBreakdown } from "@toolkit/scoring/content-scorer.js";
import { ambientAudioProfile, tutorialProfile } from "@toolkit/scoring/profiles.js";

const PROFILES = {
  "ambient audio": ambientAudioProfile,
  tutorial: tutorialProfile,
} as const;

type ProfileKey = keyof typeof PROFILES;

// Max points per criterion, for rendering bars (mirrors the rubric).
const MAX: Record<keyof DescScoreBreakdown, number> = {
  firstFold: 20,
  length: 15,
  timestamps: 10,
  hashtags: 10,
  cta: 10,
  links: 10,
  naturalLanguage: 10,
  readability: 5,
  specSignal: 5,
  trustSignals: 5,
};

const SAMPLE = `Deep focus ambient music for relaxation and study — 8 hours of continuous, uninterrupted sound.

Press play and drift into calm, deep work. Designed for restful nights and long study sessions.

Chapters:
0:00 Intro
10:00 Deep focus
60:00 Night drift

Subscribe for a new mix every week, and check the full playlist linked below.
Playlist: https://example.com/playlist
Channel: https://example.com/channel

#ambient #relaxation #focus`;

export function DescriptionScorer() {
  const [text, setText] = useState(SAMPLE);
  const [profileKey, setProfileKey] = useState<ProfileKey>("ambient audio");

  const result = useMemo(
    () => scoreDescription(text, PROFILES[profileKey]),
    [text, profileKey],
  );

  const scoreClass = result.total >= 80 ? "good" : result.total >= 55 ? "mid" : "bad";

  return (
    <div className="grid">
      <section className="card">
        <label className="row">
          Profile
          <select value={profileKey} onChange={(e) => setProfileKey(e.target.value as ProfileKey)}>
            {Object.keys(PROFILES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <textarea
          aria-label="Description to score"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          spellCheck={false}
        />
        <div className="muted">{text.length} characters</div>
      </section>

      <section className="card">
        <div className={`score ${scoreClass}`}>
          <span className="score-num">{result.total}</span>
          <span className="score-den">/ 100</span>
        </div>

        <div className="bars">
          {(Object.keys(MAX) as Array<keyof DescScoreBreakdown>).map((k) => {
            const val = result.breakdown[k];
            const pct = (val / MAX[k]) * 100;
            return (
              <div className="bar-row" key={k}>
                <span className="bar-label">{k}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="bar-val">
                  {val}/{MAX[k]}
                </span>
              </div>
            );
          })}
        </div>

        {result.suggestions.length > 0 && (
          <div className="suggestions">
            <h4>Suggestions</h4>
            <ul>
              {result.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
