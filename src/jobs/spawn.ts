/**
 * Spawn a long-running child process detached from the parent's lifecycle and
 * track it in a JobStore.
 *
 * Why detached: in a dev server with hot-reload, a reload sends SIGTERM to the
 * server's process group. A naive `spawn` puts the child in that group too, so
 * a code save mid-render kills a multi-minute job. (This bit us in production:
 * a large upload was killed at ~70% when the dev server hot-reloaded.) Running
 * the child `detached` in its own process group, with `unref()`, isolates it
 * from the parent's signals and event loop.
 *
 * What it gives you:
 *   - A JobStore row from t=0 (status=queued -> running -> complete/error), so
 *     the crash-recovery sweep and any dashboard can see the job immediately.
 *   - stdout/stderr both piped (for live progress) AND tee'd to a log file
 *     (for forensics after the fact).
 *   - A pidfile so an orphan sweep can cancel a stuck job by PID.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { JobStore } from "./job-store.js";

export interface SpawnOptions {
  jobId: string;
  command: string; // executable (e.g. a python interpreter path)
  args: string[];
  cwd: string;
  /** Directory for {jobId}.log and {jobId}.pid. Created if missing. */
  jobsDir: string;
  type?: string;
  meta?: Record<string, unknown>;
}

export interface SpawnedJob {
  proc: ChildProcess;
  pid: number;
  logPath: string;
  pidPath: string;
}

export function spawnTrackedJob(store: JobStore, opts: SpawnOptions): SpawnedJob {
  fs.mkdirSync(opts.jobsDir, { recursive: true });
  const logPath = path.join(opts.jobsDir, `${opts.jobId}.log`);
  const pidPath = path.join(opts.jobsDir, `${opts.jobId}.pid`);

  // Register the row BEFORE spawning so an orphan sweep has visibility even if
  // the spawn itself fails. A failed insert (e.g. duplicate id) is non-fatal.
  let registered = false;
  try {
    store.create({ id: opts.jobId, type: opts.type ?? "job", meta: opts.meta });
    registered = true;
  } catch (e) {
    console.warn(`[spawn] create failed for ${opts.jobId}: ${(e as Error).message}`);
  }

  // Hand the job id to the child so a progress reporter can update the same row.
  const childEnv = registered ? { ...process.env, JOB_ID: opts.jobId } : process.env;

  const proc = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: childEnv,
  });

  if (!proc.pid) {
    if (registered) {
      try {
        store.markError({ id: opts.jobId, error: "spawn returned no PID" });
      } catch {
        /* ignore */
      }
    }
    throw new Error("spawn returned no PID");
  }

  proc.unref();
  fs.writeFileSync(pidPath, String(proc.pid));
  if (registered) {
    try {
      store.markRunning({ id: opts.jobId, pid: proc.pid, logPath });
    } catch {
      /* ignore */
    }
  }

  // Tee stdio to a log file. The caller can still attach its own data
  // listeners — Node streams support multiple consumers.
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  // A log-file write error (EACCES/ENOSPC) emits 'error'; without a handler that
  // becomes an unhandled exception and crashes the parent — exactly what the job
  // runner is supposed to prevent. Swallow + report instead.
  logStream.on("error", (e) => console.error(`[spawn] log stream error for ${opts.jobId}:`, e));
  logStream.write(
    `--- ${new Date().toISOString()} pid=${proc.pid} cmd=${path.basename(opts.command)} ${opts.args.join(" ")} ---\n`,
  );
  proc.stdout?.pipe(logStream, { end: false });
  proc.stderr?.pipe(logStream, { end: false });

  proc.on("close", (code, signal) => {
    try {
      fs.unlinkSync(pidPath);
    } catch {
      /* already gone */
    }
    logStream.end();
    if (!registered) return;
    // Only set a terminal status if the child didn't already report one
    // (a progress reporter may have called markComplete/markError first).
    try {
      const current = store.get(opts.jobId);
      if (current && (current.status === "running" || current.status === "queued")) {
        if (code === 0) {
          store.markComplete({ id: opts.jobId });
        } else {
          const reason = signal ? `killed by ${signal}` : `exit code ${code ?? "null"}`;
          store.markError({ id: opts.jobId, error: reason });
        }
      }
    } catch {
      /* ignore */
    }
  });

  return { proc, pid: proc.pid, logPath, pidPath };
}
