/**
 * creative-ai-suite — public API.
 *
 * A cost-aware, multi-provider toolkit for AI-assisted creative content
 * production. See README.md for the architecture overview.
 */

// Cost observability
export * from "./cost/pricing.js";
export * from "./cost/cost-logger.js";

// LLM text generation
export * from "./llm/gemini.js";
export * from "./llm/prompt-pack.js";
export * from "./llm/generate.js";

// Cost-aware media routing
export * from "./media/animation-router.js";

// Content scoring
export * from "./scoring/content-scorer.js";
export * from "./scoring/profiles.js";

// Durable job running
export * from "./jobs/job-store.js";
export * from "./jobs/spawn.js";
