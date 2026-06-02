# creative-ai-suite — demo UI

An interactive front end for the toolkit. Every panel calls the **real functions
from `../src`** (aliased as `@toolkit`) — there's no mocked data and no copied
logic, so the UI can't drift from the library.

```bash
cd web
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build
npm run typecheck
```

No API keys needed: the panels exercise the toolkit's pure functions
(cost routing, scoring, prompt building) directly in the browser.

## Panels

- **Cost Router** — move the duration/quality/loop/motion/budget controls and
  watch `selectBackend()` choose the cheapest qualifying backend live, with a
  per-backend cost table.

  ![Cost Router](screenshots/cost-router.png)

- **Description Scorer** — type a description and see `scoreDescription()` grade
  it 0–100 with a per-criterion breakdown and concrete suggestions; switch
  scoring profiles to retarget the rubric at a different niche.

  ![Description Scorer](screenshots/description-scorer.png)

- **Prompt Preview** — edit inputs and see the exact system + user prompt a
  prompt pack builds before it's sent to the model.

  ![Prompt Preview](screenshots/prompt-preview.png)

## Regenerating screenshots

```bash
npm run build && npm run preview -- --port 4173   # serve in one shell
npm run screenshots                                # capture in another (needs: npx playwright install chromium)
```

## Why Vite, not Next.js?

The production system this was extracted from is a **Next.js 16 / React 19** app
where these same functions run in API routes (with cost logging and live
LLM/render calls). This demo is a zero-config Vite SPA on purpose: a reviewer
can `npm run dev` and interact with the real logic immediately, with no keys,
env, or backend to stand up.

Built with React 19 + TypeScript (strict).
