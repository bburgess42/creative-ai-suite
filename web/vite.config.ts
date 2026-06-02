import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Import the real toolkit source directly so the demo exercises the same
    // code that ships in src/ — no copy, no drift.
    alias: { "@toolkit": path.resolve(dir, "../src") },
  },
});
