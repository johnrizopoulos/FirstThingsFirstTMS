import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  completeMilestone,
  uncompleteMilestone,
  getActiveMilestones,
  getCompletedMilestones,
  deleteMilestone,
  getTasks,
  getActiveTasks,
  getFocusTask,
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  getCompletedTasks,
  deleteTask,
  reorderTasks,
  reorderTasksInMilestone,
  cleanupTrash,
  emptyTrash,
  restoreTask,
  restoreMilestone,
} from "../api";
import { __resetOnlineStatusForTests, isOnline, reportNetworkError } from "../onlineStatus";
import { __resetOfflineQueueForTests, getQueueSnapshot } from "../offlineQueue";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

describe("api helpers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __resetOnlineStatusForTests();
    __resetOfflineQueueForTests();
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
    });
    fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls underlying fetch exactly once per API helper (no recursion)", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getMilestones();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/milestones", undefined);
  });

  it("propagates the parsed JSON body for GET helpers", async () => {
    const milestones = [{ id: "m1", title: "ship it" }];
    fetchMock.mockResolvedValue(jsonResponse(milestones));
    await expect(getMilestones()).resolves.toEqual(milestones);
  });

  it("uses POST + JSON body for createMilestone", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "m1", title: "x" }));
    await createMilestone({ title: "x" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ title: "x" });
  });

  it("returns null for 204 responses (e.g. deleteTask)", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));
    await expect(deleteTask("t1")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/t1", { method: "DELETE" });
  });

  it("throws with status + body when the response is not ok", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(getTasks()).rejects.toThrow("500: nope");
  });

  it("flips online status to offline when fetch throws a TypeError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(isOnline()).toBe(true);
    await expect(getTasks()).rejects.toThrow("Failed to fetch");
    expect(isOnline()).toBe(false);
  });

  it("clears a previously reported network error after a successful fetch", async () => {
    reportNetworkError();
    expect(isOnline()).toBe(false);
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getTasks();
    expect(isOnline()).toBe(true);
  });

  it("does not flag non-network errors (e.g. 500) as offline", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(getTasks()).rejects.toThrow("500: boom");
    expect(isOnline()).toBe(true);
  });

  it("each helper performs exactly one fetch call", async () => {
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "DELETE") return Promise.resolve(emptyResponse(204));
      return Promise.resolve(jsonResponse({}));
    });

    const calls: Array<() => Promise<unknown>> = [
      () => getMilestones(),
      () => createMilestone({ title: "x" }),
      () => updateMilestone("m1", { title: "y" }),
      () => completeMilestone("m1"),
      () => uncompleteMilestone("m1"),
      () => getActiveMilestones(),
      () => getCompletedMilestones(),
      () => deleteMilestone("m1"),
      () => getTasks(),
      () => getActiveTasks(),
      () => getFocusTask(),
      () => createTask({ title: "x" }),
      () => updateTask("t1", { title: "y" }),
      () => completeTask("t1"),
      () => uncompleteTask("t1"),
      () => getCompletedTasks(),
      () => deleteTask("t1"),
      () => reorderTasks(["a", "b"]),
      () => reorderTasksInMilestone(["a"], "m1"),
      () => cleanupTrash(),
      () => emptyTrash(),
      () => restoreTask("t1"),
      () => restoreMilestone("m1"),
    ];

    for (const fn of calls) {
      fetchMock.mockClear();
      await fn();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  describe("offline queueing", () => {
    function setOffline() {
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false },
        configurable: true,
      });
    }

    it("does not call fetch when offline and instead enqueues the mutation", async () => {
      setOffline();
      await createTask({ title: "queued" });
      expect(fetchMock).not.toHaveBeenCalled();
      const queue = getQueueSnapshot();
      expect(queue).toHaveLength(1);
      expect(queue[0].op).toBe("createTask");
      expect(queue[0].args).toEqual([{ title: "queued" }]);
    });

    it("returns a stub object so callers don't crash on the missing response", async () => {
      setOffline();
      const result = await createTask({ title: "queued" });
      expect(result).toBeTruthy();
      expect(result.title).toBe("queued");
      expect(typeof result.id).toBe("string");
    });

    it("queues every supported mutation when offline", async () => {
      setOffline();
      await createMilestone({ title: "m" });
      await updateMilestone("m1", { title: "x" });
      await completeMilestone("m1");
      await uncompleteMilestone("m1");
      await deleteMilestone("m1");
      await createTask({ title: "t" });
      await updateTask("t1", { title: "x" });
      await completeTask("t1");
      await uncompleteTask("t1");
      await deleteTask("t1");
      await reorderTasks(["a", "b"]);
      await reorderTasksInMilestone(["a"], "m1");
      await cleanupTrash();
      await emptyTrash();
      await restoreTask("t1");
      await restoreMilestone("m1");

      expect(fetchMock).not.toHaveBeenCalled();
      const queue = getQueueSnapshot();
      expect(queue.map((q) => q.op)).toEqual([
        "createMilestone",
        "updateMilestone",
        "completeMilestone",
        "uncompleteMilestone",
        "deleteMilestone",
        "createTask",
        "updateTask",
        "completeTask",
        "uncompleteTask",
        "deleteTask",
        "reorderTasks",
        "reorderTasksInMilestone",
        "cleanupTrash",
        "emptyTrash",
        "restoreTask",
        "restoreMilestone",
      ]);
    });

    it("queues the mutation when fetch fails with a network error mid-flight", async () => {
      // Online at decision time, but fetch throws — should still recover by queueing.
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const result = await createTask({ title: "midflight" });
      expect(result.title).toBe("midflight");
      expect(getQueueSnapshot()).toHaveLength(1);
      expect(isOnline()).toBe(false);
    });

    it("propagates non-network errors (does not queue) when online", async () => {
      fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
      await expect(createTask({ title: "x" })).rejects.toThrow("500: nope");
      expect(getQueueSnapshot()).toHaveLength(0);
    });
  });
});
