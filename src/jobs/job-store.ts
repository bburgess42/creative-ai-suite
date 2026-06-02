/**
 * Durable job store interface + an in-memory reference implementation.
 *
 * Long-running generation work (renders, animations, multi-minute API jobs)
 * outlives the request that started it, so the suite tracks every job in a
 * store that survives process restarts. The production dashboard backs this
 * with SQLite (better-sqlite3); the contract is captured here as an interface
 * so callers and tests don't depend on the storage engine. `InMemoryJobStore`
 * implements the same contract for tests and local runs.
 *
 * State machine:  queued -> running -> (complete | error)
 */

export type JobStatus = "queued" | "running" | "complete" | "error";

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  pid?: number;
  logPath?: string;
  resultPath?: string;
  error?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface JobStore {
  create(input: { id: string; type: string; meta?: Record<string, unknown> }): JobRecord;
  markRunning(input: { id: string; pid: number; logPath?: string }): void;
  markComplete(input: { id: string; resultPath?: string }): void;
  markError(input: { id: string; error: string }): void;
  get(id: string): JobRecord | undefined;
  list(): JobRecord[];
  /**
   * Mark any job still "queued"/"running" as errored. Run once at boot to
   * reap jobs orphaned by a crash so the UI never shows a phantom "running".
   */
  sweepOrphans(reason?: string): string[];
}

/** Terminal statuses can't transition further. */
const TERMINAL: ReadonlySet<JobStatus> = new Set<JobStatus>(["complete", "error"]);

export class InMemoryJobStore implements JobStore {
  private jobs = new Map<string, JobRecord>();

  /** Injectable clock so tests are deterministic; defaults to wall clock. */
  constructor(private now: () => string = () => new Date().toISOString()) {}

  create(input: { id: string; type: string; meta?: Record<string, unknown> }): JobRecord {
    if (this.jobs.has(input.id)) {
      throw new Error(`job ${input.id} already exists`);
    }
    const rec: JobRecord = {
      id: input.id,
      type: input.type,
      status: "queued",
      meta: input.meta,
      createdAt: this.now(),
    };
    this.jobs.set(rec.id, rec);
    return rec;
  }

  markRunning(input: { id: string; pid: number; logPath?: string }): void {
    const job = this.require(input.id);
    if (TERMINAL.has(job.status)) return; // never resurrect a finished job
    job.status = "running";
    job.pid = input.pid;
    if (input.logPath) job.logPath = input.logPath;
    job.startedAt = this.now();
  }

  markComplete(input: { id: string; resultPath?: string }): void {
    const job = this.require(input.id);
    if (TERMINAL.has(job.status)) return;
    job.status = "complete";
    if (input.resultPath) job.resultPath = input.resultPath;
    job.finishedAt = this.now();
  }

  markError(input: { id: string; error: string }): void {
    const job = this.require(input.id);
    if (TERMINAL.has(job.status)) return;
    job.status = "error";
    job.error = input.error;
    job.finishedAt = this.now();
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  list(): JobRecord[] {
    return [...this.jobs.values()];
  }

  sweepOrphans(reason = "orphaned by restart"): string[] {
    const swept: string[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === "queued" || job.status === "running") {
        job.status = "error";
        job.error = reason;
        job.finishedAt = this.now();
        swept.push(job.id);
      }
    }
    return swept;
  }

  private require(id: string): JobRecord {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`unknown job ${id}`);
    return job;
  }
}
