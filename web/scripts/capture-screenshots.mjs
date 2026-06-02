// Capture screenshots of each demo panel with Playwright.
//
// Usage:
//   1. Build + serve the app:  npm run build && npm run preview -- --port 4173
//   2. In another shell:       npm run screenshots
//
// Override the target with BASE_URL (default http://localhost:4173).

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(dir, "../screenshots");
const BASE = process.env.BASE_URL || "http://localhost:4173";

const PANELS = [
  { tab: "Cost Router", file: "cost-router.png" },
  { tab: "Description Scorer", file: "description-scorer.png" },
  { tab: "Prompt Preview", file: "prompt-preview.png" },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1180, height: 900 },
  deviceScaleFactor: 2, // crisp, retina-quality output
});

await page.goto(BASE, { waitUntil: "networkidle" });

for (const panel of PANELS) {
  await page.getByRole("tab", { name: panel.tab }).click();
  await page.waitForTimeout(250); // let bars/transitions settle
  const out = path.join(outDir, panel.file);
  await page.locator(".app").screenshot({ path: out });
  console.log(`captured ${panel.file}`);
}

await browser.close();
console.log(`\nDone -> ${outDir}`);
