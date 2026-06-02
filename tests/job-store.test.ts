import { describe, it, expect } from "vitest";
import { InMemoryJobStore } from "../src/jobs/job-store.js";

// Deterministic clock so timestamps are predictable in assertions.
function fixedClock() {
  let n = 0;
  return () => `2026-01-01T00:00:0${n++}.000Z`;
}

describe("InMemoryJobStore", () => {
  it("walks the happy path queued -> running -> complete", () => {
    const store = new InMemoryJobStore(fixedClock());
    store.create({ id: "j1", type: "render" });
    expect(store.get("j1")?.status).toBe("queued");

    store.markRunning({ id: "j1", pid: 1234, logPath: "/tmp/j1.log" });
    const running = store.get("j1")!;
    expect(running.status).toBe("running");
    expect(running.pid).toBe(1234);
    expect(running.startedAt).toBeDefined();

    store.markComplete({ id: "j1", resultPath: "/out/j1.mp4" });
    const done = store.get("j1")!;
    expect(done.status).toBe("complete");
    expect(done.resultPath).toBe("/out/j1.mp4");
    expect(done.finishedAt).toBeDefined();
  });

  it("does not resurrect a terminal job", () => {
    const store = new InMemoryJobStore(fixedClock());
    store.create({ id: "j1", type: "render" });
    store.markError({ id: "j1", error: "boom" });
    // A late completion callback must not overwrite the error.
    store.markComplete({ id: "j1", resultPath: "/out/j1.mp4" });
    expect(store.get("j1")?.status).toBe("error");
    expect(store.get("j1")?.error).toBe("boom");
  });

  it("rejects duplicate ids", () => {
    const store = new InMemoryJobStore(fixedClock());
    store.create({ id: "j1", type: "render" });
    expect(() => store.create({ id: "j1", type: "render" })).toThrow(/already exists/);
  });

  it("throws on unknown job transitions", () => {
    const store = new InMemoryJobStore(fixedClock());
    expect(() => store.markRunning({ id: "ghost", pid: 1 })).toThrow(/unknown job/);
  });

  it("sweeps orphaned queued/running jobs to error", () => {
    const store = new InMemoryJobStore(fixedClock());
    store.create({ id: "queued", type: "render" });
    store.create({ id: "running", type: "render" });
    store.markRunning({ id: "running", pid: 2 });
    store.create({ id: "done", type: "render" });
    store.markComplete({ id: "done" });

    const swept = store.sweepOrphans("server restarted");
    expect(swept.sort()).toEqual(["queued", "running"]);
    expect(store.get("queued")?.status).toBe("error");
    expect(store.get("running")?.status).toBe("error");
    expect(store.get("done")?.status).toBe("complete"); // untouched
  });
});
