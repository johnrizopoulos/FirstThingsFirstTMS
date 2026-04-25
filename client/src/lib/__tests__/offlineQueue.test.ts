import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetOfflineQueueForTests,
  clearQueue,
  drainQueue,
  enqueue,
  getQueueSize,
  getQueueSnapshot,
  registerHandlers,
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
