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
});
