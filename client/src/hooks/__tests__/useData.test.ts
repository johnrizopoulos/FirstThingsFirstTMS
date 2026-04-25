// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useCreateTask,
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  useCreateMilestone,
  useUpdateMilestone,
  useCompleteMilestone,
  useDeleteMilestone,
} from "../useData";
import { __resetOnlineStatusForTests } from "@/lib/onlineStatus";
import { __resetOfflineQueueForTests, getQueueSnapshot } from "@/lib/offlineQueue";
import type { Milestone, Task } from "@shared/schema";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: "t-real",
    userId: "u1",
    milestoneId: null,
    title: "real",
    description: "",
    definitionOfDone: "",
    milestoneOrder: 0,
    globalOrder: 0,
    isCompleted: false,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Task;
}

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  const now = new Date();
  return {
    id: "m-real",
    userId: "u1",
    title: "milestone",
    description: "",
    definitionOfDone: "",
    displayOrder: 0,
    isCompleted: false,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Milestone;
}

function buildClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function setOffline() {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: false },
    configurable: true,
  });
}

function setOnline() {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
}

describe("useData mutation hooks — optimistic updates", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __resetOnlineStatusForTests();
    __resetOfflineQueueForTests();
    setOnline();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("useCreateTask", () => {
    it("inserts an optimistic task into the cache while offline", async () => {
      setOffline();
      const client = buildClient();
      client.setQueryData(["/api/tasks/active"], [] as Task[]);
      client.setQueryData(["/api/tasks"], [] as Task[]);

      const { result } = renderHook(() => useCreateTask(), { wrapper: wrapper(client) });

      result.current.mutate({ title: "do laundry" });

      await waitFor(() => {
        const active = client.getQueryData<Task[]>(["/api/tasks/active"]);
        expect(active).toHaveLength(1);
      });

      const active = client.getQueryData<Task[]>(["/api/tasks/active"])!;
      expect(active[0].title).toBe("do laundry");
      expect(active[0].id).toMatch(/^task-offline-/);
      // The same temp id is reflected in the global tasks cache.
      const all = client.getQueryData<Task[]>(["/api/tasks"])!;
      expect(all[0].id).toBe(active[0].id);
      // Focus task surfaces the new task.
      expect(client.getQueryData<Task | null>(["/api/tasks/focus"])?.id).toBe(active[0].id);
      // Mutation was queued for later replay.
      const queue = getQueueSnapshot();
      expect(queue).toHaveLength(1);
      expect(queue[0].op).toBe("createTask");
    });

    it("replaces the optimistic stub with the server task on success", async () => {
      const client = buildClient();
      client.setQueryData(["/api/tasks/active"], [] as Task[]);

      const serverTask = makeTask({ id: "t-real", title: "real" });
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(serverTask), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const { result } = renderHook(() => useCreateTask(), { wrapper: wrapper(client) });
      result.current.mutate({ title: "real" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const active = client.getQueryData<Task[]>(["/api/tasks/active"])!;
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("t-real");
    });
  });

  describe("useUpdateTask", () => {
    it("merges updates into every cached task list optimistically", async () => {
      setOffline();
      const client = buildClient();
      const original = makeTask({ id: "t1", title: "old" });
      client.setQueryData(["/api/tasks"], [original]);
      client.setQueryData(["/api/tasks/active"], [original]);
      client.setQueryData(["/api/tasks/focus"], original);

      const { result } = renderHook(() => useUpdateTask(), { wrapper: wrapper(client) });
      result.current.mutate({ id: "t1", updates: { title: "new" } });

      await waitFor(() => {
        expect(client.getQueryData<Task[]>(["/api/tasks/active"])![0].title).toBe("new");
      });
      expect(client.getQueryData<Task[]>(["/api/tasks"])![0].title).toBe("new");
      expect(client.getQueryData<Task | null>(["/api/tasks/focus"])!.title).toBe("new");
    });
  });

  describe("useCompleteTask", () => {
    it("removes a task from active and adds it to completed optimistically", async () => {
      setOffline();
      const client = buildClient();
      const t1 = makeTask({ id: "t1", title: "one", globalOrder: 0 });
      const t2 = makeTask({ id: "t2", title: "two", globalOrder: 1 });
      client.setQueryData(["/api/tasks"], [t1, t2]);
      client.setQueryData(["/api/tasks/active"], [t1, t2]);
      client.setQueryData(["/api/tasks/focus"], t1);
      client.setQueryData(["/api/tasks/completed"], [] as Task[]);

      const { result } = renderHook(() => useCompleteTask(), { wrapper: wrapper(client) });
      result.current.mutate("t1");

      await waitFor(() => {
        expect(client.getQueryData<Task[]>(["/api/tasks/active"])).toHaveLength(1);
      });
      const active = client.getQueryData<Task[]>(["/api/tasks/active"])!;
      expect(active[0].id).toBe("t2");
      // Focus now points to the next active task.
      expect(client.getQueryData<Task | null>(["/api/tasks/focus"])?.id).toBe("t2");
      // Completed list received the closed-out task.
      const completed = client.getQueryData<Task[]>(["/api/tasks/completed"])!;
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe("t1");
      expect(completed[0].isCompleted).toBe(true);
    });
  });

  describe("useDeleteTask", () => {
    it("removes the task from every cached task list optimistically", async () => {
      setOffline();
      const client = buildClient();
      const t1 = makeTask({ id: "t1", globalOrder: 0 });
      const t2 = makeTask({ id: "t2", globalOrder: 1 });
      client.setQueryData(["/api/tasks"], [t1, t2]);
      client.setQueryData(["/api/tasks/active"], [t1, t2]);
      client.setQueryData(["/api/tasks/focus"], t1);

      const { result } = renderHook(() => useDeleteTask(), { wrapper: wrapper(client) });
      result.current.mutate("t1");

      await waitFor(() => {
        expect(client.getQueryData<Task[]>(["/api/tasks/active"])).toHaveLength(1);
      });
      expect(client.getQueryData<Task[]>(["/api/tasks/active"])![0].id).toBe("t2");
      expect(client.getQueryData<Task | null>(["/api/tasks/focus"])?.id).toBe("t2");
      // Global list keeps the entry but flags it as deleted.
      const all = client.getQueryData<Task[]>(["/api/tasks"])!;
      expect(all.find((t) => t.id === "t1")?.isDeleted).toBe(true);
    });

    it("rolls the cache back when the server rejects the delete", async () => {
      const client = buildClient();
      const t1 = makeTask({ id: "t1" });
      client.setQueryData(["/api/tasks/active"], [t1]);
      client.setQueryData(["/api/tasks"], [t1]);

      fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));

      const { result } = renderHook(() => useDeleteTask(), { wrapper: wrapper(client) });
      result.current.mutate("t1");

      await waitFor(() => expect(result.current.isError).toBe(true));
      // Restored to original state.
      expect(client.getQueryData<Task[]>(["/api/tasks/active"])).toEqual([t1]);
      expect(client.getQueryData<Task[]>(["/api/tasks"])).toEqual([t1]);
    });
  });

  describe("milestone mutations", () => {
    it("useCreateMilestone inserts an optimistic milestone offline", async () => {
      setOffline();
      const client = buildClient();
      client.setQueryData(["/api/milestones"], [] as Milestone[]);
      client.setQueryData(["/api/milestones/active"], [] as Milestone[]);

      const { result } = renderHook(() => useCreateMilestone(), { wrapper: wrapper(client) });
      result.current.mutate({ title: "Q1 launch" });

      await waitFor(() => {
        expect(client.getQueryData<Milestone[]>(["/api/milestones/active"])).toHaveLength(1);
      });
      const active = client.getQueryData<Milestone[]>(["/api/milestones/active"])!;
      expect(active[0].title).toBe("Q1 launch");
      expect(active[0].id).toMatch(/^milestone-offline-/);
    });

    it("useUpdateMilestone merges updates optimistically", async () => {
      setOffline();
      const client = buildClient();
      const m = makeMilestone({ id: "m1", title: "old" });
      client.setQueryData(["/api/milestones"], [m]);
      client.setQueryData(["/api/milestones/active"], [m]);

      const { result } = renderHook(() => useUpdateMilestone(), { wrapper: wrapper(client) });
      result.current.mutate({ id: "m1", updates: { title: "new" } });

      await waitFor(() => {
        expect(client.getQueryData<Milestone[]>(["/api/milestones/active"])![0].title).toBe("new");
      });
    });

    it("useCompleteMilestone moves it to the completed list and cascades to its tasks", async () => {
      setOffline();
      const client = buildClient();
      const m = makeMilestone({ id: "m1" });
      const childTask = makeTask({ id: "t1", milestoneId: "m1", globalOrder: 0 });
      const otherTask = makeTask({ id: "t2", milestoneId: null, globalOrder: 1 });
      client.setQueryData(["/api/milestones"], [m]);
      client.setQueryData(["/api/milestones/active"], [m]);
      client.setQueryData(["/api/milestones/completed"], [] as Milestone[]);
      client.setQueryData(["/api/tasks"], [childTask, otherTask]);
      client.setQueryData(["/api/tasks/active"], [childTask, otherTask]);
      client.setQueryData(["/api/tasks/focus"], childTask);

      const { result } = renderHook(() => useCompleteMilestone(), { wrapper: wrapper(client) });
      result.current.mutate("m1");

      await waitFor(() => {
        expect(client.getQueryData<Milestone[]>(["/api/milestones/active"])).toHaveLength(0);
      });
      expect(client.getQueryData<Milestone[]>(["/api/milestones/completed"])).toHaveLength(1);
      // Linked task is gone from the active list and focus advances.
      const activeTasks = client.getQueryData<Task[]>(["/api/tasks/active"])!;
      expect(activeTasks.map((t) => t.id)).toEqual(["t2"]);
      expect(client.getQueryData<Task | null>(["/api/tasks/focus"])?.id).toBe("t2");
    });

    it("useDeleteMilestone soft-deletes it and cascades to its tasks", async () => {
      setOffline();
      const client = buildClient();
      const m = makeMilestone({ id: "m1" });
      const childTask = makeTask({ id: "t1", milestoneId: "m1", globalOrder: 0 });
      client.setQueryData(["/api/milestones"], [m]);
      client.setQueryData(["/api/milestones/active"], [m]);
      client.setQueryData(["/api/tasks"], [childTask]);
      client.setQueryData(["/api/tasks/active"], [childTask]);
      client.setQueryData(["/api/tasks/focus"], childTask);

      const { result } = renderHook(() => useDeleteMilestone(), { wrapper: wrapper(client) });
      result.current.mutate("m1");

      await waitFor(() => {
        expect(client.getQueryData<Milestone[]>(["/api/milestones/active"])).toHaveLength(0);
      });
      expect(client.getQueryData<Milestone[]>(["/api/milestones"])![0].isDeleted).toBe(true);
      expect(client.getQueryData<Task[]>(["/api/tasks/active"])).toHaveLength(0);
      expect(client.getQueryData<Task | null>(["/api/tasks/focus"])).toBeNull();
      expect(client.getQueryData<Task[]>(["/api/tasks"])![0].isDeleted).toBe(true);
    });
  });
});
