import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetOfflineQueueForTests,
  clearQueue,
  drainQueue,
  enqueue,
  getQueueSize,
  getQueueSnapshot,
  insertQueueEntry,
  registerHandlers,
  removeQueueEntry,
  retryQueueEntry,
  startQueueBridge,
  subscribeQueue,
  syncQueueOwner,
  executeOrQueue,
  type QueueEvent,
} from "../offlineQueue";
import {
  __resetOnlineStatusForTests,
  reportNetworkError,
  clearNetworkError,
} from "../onlineStatus";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: value },
    configurable: true,
  });
}

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
}

function installFakeStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  return storage;
}

describe("offlineQueue", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    __resetOnlineStatusForTests();
    __resetOfflineQueueForTests();
    setNavigatorOnline(true);
    storage = installFakeStorage();
  });

  describe("enqueue + persistence", () => {
    it("appends entries in order and reports size via emitted events", () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));

      enqueue("createTask", [{ title: "a" }]);
      enqueue("updateTask", ["t1", { title: "b" }]);

      const snapshot = getQueueSnapshot();
      expect(snapshot).toHaveLength(2);
      expect(snapshot[0].op).toBe("createTask");
      expect(snapshot[1].op).toBe("updateTask");
      expect(events).toEqual([
        { type: "queued", op: "createTask", size: 1 },
        { type: "queued", op: "updateTask", size: 2 },
      ]);
    });

    it("persists the queue to localStorage so it survives reload", () => {
      enqueue("createTask", [{ title: "persist me" }]);
      const raw = storage.getItem("fft.offlineMutationQueue.v1");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].op).toBe("createTask");
    });

    it("loads a previously persisted queue on first access", () => {
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          { id: "x", op: "createTask", args: [{ title: "from-disk" }], enqueuedAt: 1 },
        ]),
      );
      // Reset only in-memory state to force a fresh load from storage.
      __resetOfflineQueueForTests();
      // installFakeStorage is unaffected — but our reset cleared it. Reseed.
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          { id: "x", op: "createTask", args: [{ title: "from-disk" }], enqueuedAt: 1 },
        ]),
      );

      expect(getQueueSize()).toBe(1);
      const snap = getQueueSnapshot();
      expect(snap[0].args).toEqual([{ title: "from-disk" }]);
    });

    it("captures an optional label on the entry so the panel stays readable after a cold reload", () => {
      const entry = enqueue("completeTask", ["task-123"], "Buy milk");
      expect(entry.label).toBe("Buy milk");

      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].label).toBe("Buy milk");

      const raw = storage.getItem("fft.offlineMutationQueue.v1");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed[0].label).toBe("Buy milk");
    });

    it("does not store a label when the caller omits one (or passes empty)", () => {
      const a = enqueue("completeTask", ["task-1"]);
      const b = enqueue("completeTask", ["task-2"], "");
      expect(a.label).toBeUndefined();
      expect(b.label).toBeUndefined();

      const persisted = JSON.parse(
        storage.getItem("fft.offlineMutationQueue.v1")!,
      );
      expect(persisted[0]).not.toHaveProperty("label");
      expect(persisted[1]).not.toHaveProperty("label");
    });

    it("loads legacy persisted entries that have no label field (backward compat)", () => {
      // Simulate a queue persisted by an older version of the app — entries
      // have no `label` field. They must still load cleanly.
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          { id: "legacy", op: "completeTask", args: ["task-1"], enqueuedAt: 1 },
        ]),
      );
      __resetOfflineQueueForTests();
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          { id: "legacy", op: "completeTask", args: ["task-1"], enqueuedAt: 1 },
        ]),
      );

      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].id).toBe("legacy");
      expect(snap[0].op).toBe("completeTask");
      expect(snap[0].label).toBeUndefined();
    });

    it("preserves a previously persisted label across a reload", () => {
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          {
            id: "x",
            op: "completeTask",
            args: ["task-1"],
            enqueuedAt: 1,
            label: "Buy milk",
          },
        ]),
      );
      __resetOfflineQueueForTests();
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          {
            id: "x",
            op: "completeTask",
            args: ["task-1"],
            enqueuedAt: 1,
            label: "Buy milk",
          },
        ]),
      );

      const snap = getQueueSnapshot();
      expect(snap[0].label).toBe("Buy milk");
    });

    it("drops a corrupted (non-string / empty) label on load instead of poisoning the panel", () => {
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          { id: "a", op: "completeTask", args: ["t1"], enqueuedAt: 1, label: 42 },
          { id: "b", op: "completeTask", args: ["t2"], enqueuedAt: 1, label: "" },
        ]),
      );
      __resetOfflineQueueForTests();
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          { id: "a", op: "completeTask", args: ["t1"], enqueuedAt: 1, label: 42 },
          { id: "b", op: "completeTask", args: ["t2"], enqueuedAt: 1, label: "" },
        ]),
      );

      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(2);
      expect(snap[0].label).toBeUndefined();
      expect(snap[1].label).toBeUndefined();
    });

    it("removes the storage key once the queue is fully drained", async () => {
      registerHandlers({
        createTask: vi.fn().mockResolvedValue({ id: "t1" }),
      });
      enqueue("createTask", [{ title: "a" }]);
      expect(storage.getItem("fft.offlineMutationQueue.v1")).not.toBeNull();
      await drainQueue();
      expect(storage.getItem("fft.offlineMutationQueue.v1")).toBeNull();
    });
  });

  describe("drainQueue", () => {
    it("calls handlers in order and removes successful entries", async () => {
      const calls: string[] = [];
      registerHandlers({
        createTask: vi.fn().mockImplementation(async (input: { title: string }) => {
          calls.push(`createTask:${input.title}`);
        }),
        updateTask: vi.fn().mockImplementation(async (id: string) => {
          calls.push(`updateTask:${id}`);
        }),
      });

      enqueue("createTask", [{ title: "a" }]);
      enqueue("updateTask", ["t1", { title: "b" }]);
      enqueue("createTask", [{ title: "c" }]);

      const result = await drainQueue();
      expect(result).toEqual({ processed: 3, remaining: 0 });
      expect(calls).toEqual([
        "createTask:a",
        "updateTask:t1",
        "createTask:c",
      ]);
      expect(getQueueSize()).toBe(0);
    });

    it("stops draining when the network drops (network-like error) and keeps the entry", async () => {
      const handler = vi
        .fn()
        .mockResolvedValueOnce({ id: "ok" })
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));
      registerHandlers({ createTask: handler });

      enqueue("createTask", [{ title: "a" }]);
      enqueue("createTask", [{ title: "b" }]);

      const result = await drainQueue();
      expect(result.processed).toBe(1);
      expect(result.remaining).toBe(1);
      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].args).toEqual([{ title: "b" }]);
    });

    it("preserves FIFO order when a network drop interrupts the head op (no re-queue at tail)", async () => {
      // The head op fails with a network error. The queue must leave it at the
      // head — NOT shift it and re-append it at the tail — otherwise a follow-up
      // mutation for the same entity would now run before the create.
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });

      enqueue("createTask", [{ title: "first" }]);
      enqueue("createTask", [{ title: "second" }]);

      const result = await drainQueue();
      expect(result.processed).toBe(0);
      expect(result.remaining).toBe(2);
      const snap = getQueueSnapshot();
      expect(snap.map((e) => e.args[0])).toEqual([{ title: "first" }, { title: "second" }]);

      // Resume drain — the previously-failed head should be retried first.
      const result2 = await drainQueue();
      expect(result2.processed).toBe(2);
      expect(handler.mock.calls.map((c) => c[0])).toEqual([
        { title: "first" }, // first attempt failed
        { title: "first" }, // retried first on resume
        { title: "second" },
      ]);
    });

    it("emits a 'conflict' event and drops the entry when the server returns 404/409/410", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      registerHandlers({
        deleteTask: vi.fn().mockRejectedValue(new Error("404: gone")),
      });
      enqueue("deleteTask", ["missing"]);

      await drainQueue();

      expect(getQueueSize()).toBe(0);
      const conflict = events.find((e) => e.type === "conflict");
      expect(conflict).toBeTruthy();
      expect(conflict && conflict.type === "conflict" && conflict.op).toBe("deleteTask");
    });

    it("emits an 'error' event and drops the entry for unexpected errors", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      registerHandlers({
        createTask: vi.fn().mockRejectedValue(new Error("500: boom")),
      });
      enqueue("createTask", [{ title: "x" }]);

      await drainQueue();

      expect(getQueueSize()).toBe(0);
      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeTruthy();
    });

    it("is a no-op while offline and resumes when online", async () => {
      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });
      enqueue("createTask", [{ title: "a" }]);

      reportNetworkError(); // flips isOnline() to false
      const result1 = await drainQueue();
      expect(handler).not.toHaveBeenCalled();
      expect(result1.remaining).toBe(1);

      clearNetworkError();
      const result2 = await drainQueue();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(result2).toEqual({ processed: 1, remaining: 0 });
    });

    it("drops entries with no registered handler so the queue can't get stuck", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      enqueue("createTask", [{ title: "no handler" }]);

      await drainQueue();
      expect(getQueueSize()).toBe(0);
      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeTruthy();
    });

    it("concurrent drain calls do not double-process entries", async () => {
      let resolve: (() => void) | null = null;
      const blocking = new Promise<void>((r) => {
        resolve = r;
      });
      const handler = vi.fn().mockImplementation(async () => {
        await blocking;
      });
      registerHandlers({ createTask: handler });
      enqueue("createTask", [{ title: "a" }]);

      const p1 = drainQueue();
      const p2 = drainQueue(); // should detect in-flight drain and return immediately

      resolve!();
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(handler).toHaveBeenCalledTimes(1);
      // Exactly one of the two drains should have processed the entry.
      expect(r1.processed + r2.processed).toBe(1);
      expect(getQueueSize()).toBe(0);
    });
  });

  describe("startQueueBridge", () => {
    it("drains automatically when the online status flips back to online", async () => {
      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });
      enqueue("createTask", [{ title: "a" }]);

      reportNetworkError();
      const release = startQueueBridge();
      // Still offline — should not have drained.
      expect(handler).not.toHaveBeenCalled();

      clearNetworkError();
      // Allow microtasks to flush.
      await new Promise((r) => setTimeout(r, 0));
      expect(handler).toHaveBeenCalledTimes(1);
      release();
    });

    it("drains immediately on start if there's already a backlog and we're online", async () => {
      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });
      enqueue("createTask", [{ title: "a" }]);

      const release = startQueueBridge();
      await new Promise((r) => setTimeout(r, 0));
      expect(handler).toHaveBeenCalled();
      release();
    });
  });

  describe("executeOrQueue", () => {
    it("calls the function when online and returns its result", async () => {
      const fn = vi.fn().mockResolvedValue("real-result");
      const result = await executeOrQueue("createTask", [{ title: "x" }], "stub", fn);
      expect(result).toBe("real-result");
      expect(fn).toHaveBeenCalled();
      expect(getQueueSize()).toBe(0);
    });

    it("queues and returns the stub when offline", async () => {
      reportNetworkError();
      const fn = vi.fn().mockResolvedValue("real-result");
      const result = await executeOrQueue("createTask", [{ title: "x" }], "stub-value", fn);
      expect(result).toBe("stub-value");
      expect(fn).not.toHaveBeenCalled();
      expect(getQueueSize()).toBe(1);
    });

    it("queues and returns the stub when fetch throws a network-like error", async () => {
      const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      const result = await executeOrQueue("createTask", [{ title: "x" }], "stub-value", fn);
      expect(result).toBe("stub-value");
      expect(getQueueSize()).toBe(1);
    });

    it("rethrows non-network errors and does not enqueue", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("500: nope"));
      await expect(
        executeOrQueue("createTask", [{ title: "x" }], "stub", fn),
      ).rejects.toThrow("500: nope");
      expect(getQueueSize()).toBe(0);
    });

    it("passes the optional label through to the queued entry when offline", async () => {
      reportNetworkError();
      const fn = vi.fn().mockResolvedValue("real");
      await executeOrQueue(
        "completeTask",
        ["task-1"],
        "stub",
        fn,
        "Buy milk",
      );
      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].label).toBe("Buy milk");
    });

    it("passes the label through when fetch throws a network-like error", async () => {
      const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      await executeOrQueue(
        "deleteTask",
        ["task-9"],
        null,
        fn,
        "Old chore",
      );
      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].label).toBe("Old chore");
    });
  });

  describe("temp ID rewriting after a queued create resolves", () => {
    it("rewrites a follow-up completeTask op to use the server-assigned ID", async () => {
      // Scenario: user creates a task offline, completes it offline, then
      // reconnects. Both ops are queued in order. The create returns a real
      // server ID; the follow-up completeTask must target that real ID, not
      // the temp ID the server never knew about.
      const completed: string[] = [];
      registerHandlers({
        createTask: vi.fn().mockImplementation(async (input: { id: string }) => ({
          id: "task-real-1",
          title: "x",
          tempId: input.id,
        })),
        completeTask: vi.fn().mockImplementation(async (id: string) => {
          completed.push(id);
          return { id };
        }),
      });

      enqueue("createTask", [{ id: "task-offline-abc", title: "x" }]);
      enqueue("completeTask", ["task-offline-abc"]);

      const result = await drainQueue();

      expect(result).toEqual({ processed: 2, remaining: 0 });
      expect(completed).toEqual(["task-real-1"]);
    });

    it("rewrites updateTask, deleteTask, and reorder ops that reference the temp ID", async () => {
      const calls: Array<[string, unknown[]]> = [];
      registerHandlers({
        createTask: vi
          .fn()
          .mockResolvedValueOnce({ id: "task-real-1" })
          .mockResolvedValueOnce({ id: "task-real-2" }),
        updateTask: vi.fn().mockImplementation(async (id: string, updates: unknown) => {
          calls.push(["updateTask", [id, updates]]);
          return { id };
        }),
        deleteTask: vi.fn().mockImplementation(async (id: string) => {
          calls.push(["deleteTask", [id]]);
          return null;
        }),
        reorderTasks: vi.fn().mockImplementation(async (ids: string[]) => {
          calls.push(["reorderTasks", [ids]]);
          return null;
        }),
      });

      enqueue("createTask", [{ id: "task-offline-1", title: "first" }]);
      enqueue("createTask", [{ id: "task-offline-2", title: "second" }]);
      enqueue("updateTask", ["task-offline-1", { title: "edited" }]);
      enqueue("reorderTasks", [["task-offline-2", "task-offline-1", "untouched"]]);
      enqueue("deleteTask", ["task-offline-2"]);

      await drainQueue();

      expect(calls).toEqual([
        ["updateTask", ["task-real-1", { title: "edited" }]],
        ["reorderTasks", [["task-real-2", "task-real-1", "untouched"]]],
        ["deleteTask", ["task-real-2"]],
      ]);
    });

    it("rewrites a temp milestoneId on a follow-up createTask after the milestone create resolves", async () => {
      const created: unknown[] = [];
      registerHandlers({
        createMilestone: vi.fn().mockResolvedValue({ id: "milestone-real-1" }),
        createTask: vi.fn().mockImplementation(async (input: unknown) => {
          created.push(input);
          return { id: "task-real-1" };
        }),
      });

      enqueue("createMilestone", [{ id: "milestone-offline-1", title: "ms" }]);
      enqueue("createTask", [
        { id: "task-offline-1", title: "t", milestoneId: "milestone-offline-1" },
      ]);

      await drainQueue();

      expect(created).toEqual([
        { id: "task-offline-1", title: "t", milestoneId: "milestone-real-1" },
      ]);
    });

    it("rewrites both the id and a milestoneId in updateTask updates", async () => {
      const updates: Array<[string, unknown]> = [];
      registerHandlers({
        createTask: vi.fn().mockResolvedValue({ id: "task-real-1" }),
        createMilestone: vi.fn().mockResolvedValue({ id: "milestone-real-1" }),
        updateTask: vi.fn().mockImplementation(async (id: string, patch: unknown) => {
          updates.push([id, patch]);
          return { id };
        }),
      });

      enqueue("createTask", [{ id: "task-offline-1", title: "t" }]);
      enqueue("createMilestone", [{ id: "milestone-offline-1", title: "ms" }]);
      enqueue("updateTask", [
        "task-offline-1",
        { milestoneId: "milestone-offline-1", title: "moved" },
      ]);

      await drainQueue();

      expect(updates).toEqual([
        [
          "task-real-1",
          { milestoneId: "milestone-real-1", title: "moved" },
        ],
      ]);
    });

    it("rewrites reorderTasksInMilestone task IDs and milestoneId", async () => {
      const reorders: Array<[unknown, unknown]> = [];
      registerHandlers({
        createMilestone: vi.fn().mockResolvedValue({ id: "milestone-real-1" }),
        createTask: vi
          .fn()
          .mockResolvedValueOnce({ id: "task-real-1" })
          .mockResolvedValueOnce({ id: "task-real-2" }),
        reorderTasksInMilestone: vi
          .fn()
          .mockImplementation(async (taskIds: string[], milestoneId: string) => {
            reorders.push([taskIds, milestoneId]);
            return null;
          }),
      });

      enqueue("createMilestone", [{ id: "milestone-offline-1", title: "ms" }]);
      enqueue("createTask", [
        { id: "task-offline-1", title: "a", milestoneId: "milestone-offline-1" },
      ]);
      enqueue("createTask", [
        { id: "task-offline-2", title: "b", milestoneId: "milestone-offline-1" },
      ]);
      enqueue("reorderTasksInMilestone", [
        ["task-offline-2", "task-offline-1"],
        "milestone-offline-1",
      ]);

      await drainQueue();

      expect(reorders).toEqual([
        [["task-real-2", "task-real-1"], "milestone-real-1"],
      ]);
    });

    it("persists the rewritten args so a mid-drain crash doesn't lose the mapping", async () => {
      // Drain only the create, then simulate a crash by flipping offline before
      // the follow-up runs. The persisted queue should already carry the real
      // id so a fresh load -> drain still completes correctly.
      let createResolved = false;
      registerHandlers({
        createTask: vi.fn().mockImplementation(async () => {
          createResolved = true;
          return { id: "task-real-1" };
        }),
        completeTask: vi.fn().mockImplementation(async () => {
          if (!createResolved) throw new Error("ordering violated");
          // Simulate a network drop between ops on the first drain attempt.
          throw new TypeError("Failed to fetch");
        }),
      });

      enqueue("createTask", [{ id: "task-offline-xyz", title: "x" }]);
      enqueue("completeTask", ["task-offline-xyz"]);

      // First drain: create succeeds, completeTask fails network-like, queue
      // halts with the rewritten id at the head.
      const first = await drainQueue();
      expect(first.processed).toBe(1);
      expect(first.remaining).toBe(1);

      const persisted = JSON.parse(
        storage.getItem("fft.offlineMutationQueue.v1")!,
      );
      expect(persisted).toHaveLength(1);
      expect(persisted[0].op).toBe("completeTask");
      expect(persisted[0].args).toEqual(["task-real-1"]);
    });
  });

  describe("removeQueueEntry", () => {
    it("removes a single entry by id without touching the others", () => {
      const events: QueueEvent[] = [];
      const a = enqueue("createTask", [{ title: "a" }]);
      const b = enqueue("createTask", [{ title: "b" }]);
      const c = enqueue("createTask", [{ title: "c" }]);
      subscribeQueue((e) => events.push(e));

      const removed = removeQueueEntry(b.id);

      expect(removed).not.toBeNull();
      expect(removed!.entry.id).toBe(b.id);
      expect(removed!.index).toBe(1);
      expect(getQueueSnapshot().map((e) => e.id)).toEqual([a.id, c.id]);
      expect(events).toEqual([
        { type: "removed", id: b.id, size: 2 },
      ]);
    });

    it("returns null when no entry matches the given id", () => {
      enqueue("createTask", [{ title: "a" }]);
      const removed = removeQueueEntry("does-not-exist");
      expect(removed).toBeNull();
      expect(getQueueSize()).toBe(1);
    });

    it("re-persists the queue so a discard survives reload", () => {
      const a = enqueue("createTask", [{ title: "a" }]);
      enqueue("createTask", [{ title: "b" }]);
      removeQueueEntry(a.id);
      const raw = storage.getItem("fft.offlineMutationQueue.v1");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].args).toEqual([{ title: "b" }]);
    });

    it("removes the storage key when the last entry is discarded", () => {
      const a = enqueue("createTask", [{ title: "lonely" }]);
      expect(storage.getItem("fft.offlineMutationQueue.v1")).not.toBeNull();
      removeQueueEntry(a.id);
      expect(storage.getItem("fft.offlineMutationQueue.v1")).toBeNull();
    });
  });

  describe("insertQueueEntry (undo discard)", () => {
    it("restores a previously removed entry at the original index", () => {
      const a = enqueue("createTask", [{ title: "a" }]);
      const b = enqueue("createTask", [{ title: "b" }]);
      const c = enqueue("createTask", [{ title: "c" }]);

      const removed = removeQueueEntry(b.id)!;
      expect(getQueueSnapshot().map((e) => e.id)).toEqual([a.id, c.id]);

      insertQueueEntry(removed.entry, removed.index);

      expect(getQueueSnapshot().map((e) => e.id)).toEqual([a.id, b.id, c.id]);
    });

    it("clamps an out-of-range index instead of throwing", () => {
      const a = enqueue("createTask", [{ title: "a" }]);
      const removed = removeQueueEntry(a.id)!;
      insertQueueEntry(removed.entry, 999);
      expect(getQueueSnapshot()).toHaveLength(1);
    });

    it("emits a 'queued' event so subscribers refresh", () => {
      const a = enqueue("createTask", [{ title: "a" }]);
      const removed = removeQueueEntry(a.id)!;
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      insertQueueEntry(removed.entry, removed.index);
      expect(events).toEqual([
        { type: "queued", op: "createTask", size: 1 },
      ]);
    });
  });

  describe("retryQueueEntry", () => {
    it("runs the handler for that entry, removes it, and emits drained", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });

      const a = enqueue("createTask", [{ title: "a" }]);
      const b = enqueue("createTask", [{ title: "b" }]);

      const result = await retryQueueEntry(b.id);

      expect(result).toEqual({ status: "success" });
      expect(handler).toHaveBeenCalledWith({ title: "b" });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(getQueueSnapshot().map((e) => e.id)).toEqual([a.id]);
      expect(events.some((e) => e.type === "drained")).toBe(true);
    });

    it("returns 'not-found' for an unknown id and does not call any handler", async () => {
      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });
      enqueue("createTask", [{ title: "a" }]);

      const result = await retryQueueEntry("nope");
      expect(result).toEqual({ status: "not-found" });
      expect(handler).not.toHaveBeenCalled();
      expect(getQueueSize()).toBe(1);
    });

    it("returns 'offline' and leaves the entry in place when offline", async () => {
      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });
      const a = enqueue("createTask", [{ title: "a" }]);

      reportNetworkError();
      const result = await retryQueueEntry(a.id);

      expect(result).toEqual({ status: "offline" });
      expect(handler).not.toHaveBeenCalled();
      expect(getQueueSize()).toBe(1);
    });

    it("returns 'network' and keeps the entry when the handler reports a network-like error", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));
      registerHandlers({ createTask: handler });
      const a = enqueue("createTask", [{ title: "a" }]);

      const result = await retryQueueEntry(a.id);

      expect(result.status).toBe("network");
      expect(getQueueSize()).toBe(1);
      expect(getQueueSnapshot()[0].id).toBe(a.id);
    });

    it("emits 'conflict' and drops the entry on a 404/409/410", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      registerHandlers({
        deleteTask: vi.fn().mockRejectedValue(new Error("404: gone")),
      });
      const a = enqueue("deleteTask", ["missing"]);

      const result = await retryQueueEntry(a.id);

      expect(result.status).toBe("conflict");
      expect(getQueueSize()).toBe(0);
      expect(events.some((e) => e.type === "conflict")).toBe(true);
    });

    it("emits 'error' and drops the entry on an unexpected server error", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      registerHandlers({
        createTask: vi.fn().mockRejectedValue(new Error("500: boom")),
      });
      const a = enqueue("createTask", [{ title: "a" }]);

      const result = await retryQueueEntry(a.id);

      expect(result.status).toBe("error");
      expect(getQueueSize()).toBe(0);
      expect(events.some((e) => e.type === "error")).toBe(true);
    });

    it("drops the entry and emits 'error' when no handler is registered", async () => {
      const events: QueueEvent[] = [];
      subscribeQueue((e) => events.push(e));
      const a = enqueue("createTask", [{ title: "a" }]);

      const result = await retryQueueEntry(a.id);

      expect(result.status).toBe("no-handler");
      expect(getQueueSize()).toBe(0);
      expect(events.some((e) => e.type === "error")).toBe(true);
    });

    it("folds a successful create's temp -> real id mapping into the rest of the queue", async () => {
      const completed: string[] = [];
      registerHandlers({
        createTask: vi.fn().mockResolvedValue({ id: "task-real-1" }),
        completeTask: vi.fn().mockImplementation(async (id: string) => {
          completed.push(id);
          return { id };
        }),
      });
      const create = enqueue("createTask", [
        { id: "task-offline-abc", title: "x" },
      ]);
      enqueue("completeTask", ["task-offline-abc"]);

      const result = await retryQueueEntry(create.id);
      expect(result.status).toBe("success");

      const snap = getQueueSnapshot();
      expect(snap).toHaveLength(1);
      expect(snap[0].args).toEqual(["task-real-1"]);

      // Now drain the rest — the follow-up should target the real id.
      await drainQueue();
      expect(completed).toEqual(["task-real-1"]);
    });

    it("returns 'busy' if a drain is already in flight (no double-processing)", async () => {
      let resolveDrain: (() => void) | null = null;
      const blocking = new Promise<void>((r) => {
        resolveDrain = r;
      });
      const slowHandler = vi.fn().mockImplementation(async () => {
        await blocking;
        return { id: "ok" };
      });
      registerHandlers({ createTask: slowHandler });
      const a = enqueue("createTask", [{ title: "a" }]);
      enqueue("createTask", [{ title: "b" }]);

      const drainPromise = drainQueue();
      // While the drain is parked on the first handler, attempt a retry.
      const retryResult = await retryQueueEntry(a.id);
      expect(retryResult).toEqual({ status: "busy" });
      expect(slowHandler).toHaveBeenCalledTimes(1);

      resolveDrain!();
      await drainPromise;
    });
  });

  describe("clearQueue", () => {
    it("drops every entry and clears the persisted backlog", () => {
      enqueue("createTask", [{ title: "a" }]);
      enqueue("createTask", [{ title: "b" }]);
      expect(getQueueSize()).toBe(2);
      expect(storage.getItem("fft.offlineMutationQueue.v1")).toBeTruthy();

      clearQueue();

      expect(getQueueSize()).toBe(0);
      expect(getQueueSnapshot()).toHaveLength(0);
      expect(storage.getItem("fft.offlineMutationQueue.v1")).toBeNull();
    });

    it("is safe to call when the queue is already empty", () => {
      expect(() => clearQueue()).not.toThrow();
      expect(getQueueSize()).toBe(0);
    });
  });

  describe("syncQueueOwner", () => {
    it("clears the queue and records the owner on first run", () => {
      enqueue("createTask", [{ title: "stale" }]);
      expect(getQueueSize()).toBe(1);

      const cleared = syncQueueOwner("user-A");

      expect(cleared).toBe(true);
      expect(getQueueSize()).toBe(0);
      expect(storage.getItem("fft.offlineMutationQueueOwner.v1")).toBe("user-A");
    });

    it("preserves the queue when the same owner reconciles again", () => {
      syncQueueOwner("user-A");
      enqueue("createTask", [{ title: "mine" }]);
      enqueue("createTask", [{ title: "also mine" }]);

      const cleared = syncQueueOwner("user-A");

      expect(cleared).toBe(false);
      expect(getQueueSize()).toBe(2);
      expect(getQueueSnapshot().map((e) => e.args[0])).toEqual([
        { title: "mine" },
        { title: "also mine" },
      ]);
    });

    it("clears the queue when the owner switches to a different user (cross-account replay protection)", () => {
      // User A is the owner and queues some work.
      syncQueueOwner("user-A");
      enqueue("createTask", [{ title: "A's secret task" }]);
      enqueue("updateTask", ["task-1", { title: "edit by A" }]);
      expect(getQueueSize()).toBe(2);

      // User B signs in on the same browser. Their queue must NOT inherit A's
      // backlog — otherwise B would silently mutate data on B's account.
      const cleared = syncQueueOwner("user-B");

      expect(cleared).toBe(true);
      expect(getQueueSize()).toBe(0);
      expect(storage.getItem("fft.offlineMutationQueueOwner.v1")).toBe("user-B");
    });

    it("clears the queue when the user signs out (owner -> null)", () => {
      syncQueueOwner("user-A");
      enqueue("createTask", [{ title: "queued while signed in" }]);

      const cleared = syncQueueOwner(null);

      expect(cleared).toBe(true);
      expect(getQueueSize()).toBe(0);
      expect(storage.getItem("fft.offlineMutationQueueOwner.v1")).toBe("");
    });

    it("prevents draining a previously-queued backlog after an account switch", async () => {
      // Simulate user A persisting work, then leaving the browser.
      syncQueueOwner("user-A");
      enqueue("createTask", [{ title: "from A" }]);

      // Simulate a fresh page load: queue is loaded from storage, then user B
      // becomes the active account. syncQueueOwner runs BEFORE drain.
      __resetOfflineQueueForTests();
      // Restore storage as it would be after reload.
      storage.setItem(
        "fft.offlineMutationQueue.v1",
        JSON.stringify([
          {
            id: "abc",
            op: "createTask",
            args: [{ title: "from A" }],
            enqueuedAt: Date.now(),
          },
        ]),
      );
      storage.setItem("fft.offlineMutationQueueOwner.v1", "user-A");

      const handler = vi.fn().mockResolvedValue({ id: "ok" });
      registerHandlers({ createTask: handler });

      // App boots and reconciles owner before allowing drain.
      const cleared = syncQueueOwner("user-B");
      expect(cleared).toBe(true);

      const result = await drainQueue();
      expect(result.processed).toBe(0);
      expect(handler).not.toHaveBeenCalled();
      expect(getQueueSize()).toBe(0);
    });
  });
});
