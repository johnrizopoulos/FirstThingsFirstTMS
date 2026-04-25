import type { Milestone, Task, InsertMilestone, InsertTask } from "@shared/schema";
import { trackedFetch } from "./onlineStatus";
import { executeOrQueue, type OfflineOpName } from "./offlineQueue";
import { queryClient } from "./queryClient";

// =============================================================================
// Cache-backed label lookup
//
// When a queued mutation only carries an entity id (complete/uncomplete/delete/
// restore), we resolve a friendly title from the React Query cache so the
// pending-changes panel can show "complete task: Buy milk" instead of the bare
// op name. The resolved label is stashed on the QueuedOp so it survives a
// cold reload that would otherwise leave the cache empty.
// =============================================================================

const TASK_CACHE_KEYS = [
  "/api/tasks",
  "/api/tasks/active",
  "/api/tasks/focus",
  "/api/tasks/completed",
] as const;

const MILESTONE_CACHE_KEYS = [
  "/api/milestones",
  "/api/milestones/active",
  "/api/milestones/completed",
] as const;

function nonEmptyTitle(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function lookupTitleById(kind: "task" | "milestone", id: string): string | undefined {
  const keys = kind === "task" ? TASK_CACHE_KEYS : MILESTONE_CACHE_KEYS;
  for (const key of keys) {
    const data = queryClient.getQueryData<unknown>([key]);
    if (Array.isArray(data)) {
      const match = (data as Array<{ id?: unknown; title?: unknown }>).find(
        (item) => item && typeof item === "object" && item.id === id,
      );
      const title = nonEmptyTitle(match?.title);
      if (title) return title;
    } else if (data && typeof data === "object") {
      // Single-object caches like /api/tasks/focus return one task or null.
      const item = data as { id?: unknown; title?: unknown };
      if (item.id === id) {
        const title = nonEmptyTitle(item.title);
        if (title) return title;
      }
    }
  }
  return undefined;
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function tempId(prefix: string): string {
  return `${prefix}-offline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function taskStub(input: Partial<InsertTask>, overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: input.id ?? tempId("task"),
    userId: input.userId ?? "",
    milestoneId: input.milestoneId ?? null,
    title: input.title ?? "",
    description: input.description ?? "",
    definitionOfDone: input.definitionOfDone ?? "",
    milestoneOrder: input.milestoneOrder ?? 0,
    globalOrder: input.globalOrder ?? 0,
    isCompleted: input.isCompleted ?? false,
    completedAt: input.completedAt ?? null,
    isDeleted: input.isDeleted ?? false,
    deletedAt: input.deletedAt ?? null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Task;
}

export function milestoneStub(
  input: Partial<InsertMilestone>,
  overrides: Partial<Milestone> = {},
): Milestone {
  const now = new Date();
  return {
    id: input.id ?? tempId("milestone"),
    userId: input.userId ?? "",
    title: input.title ?? "",
    description: input.description ?? "",
    definitionOfDone: input.definitionOfDone ?? "",
    displayOrder: input.displayOrder ?? 0,
    isCompleted: input.isCompleted ?? false,
    completedAt: input.completedAt ?? null,
    isDeleted: input.isDeleted ?? false,
    deletedAt: input.deletedAt ?? null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Milestone;
}

// =============================================================================
// Raw mutation helpers — fetch only, NO offline queueing.
//
// These are exposed via `rawMutations` so the offline-queue replay path can
// invoke the underlying network call without recursively re-queueing on a
// transient network failure (which would re-order the queue).
// Public mutation helpers below wrap these with `executeOrQueue`.
// =============================================================================

async function rawCreateMilestone(milestone: Partial<InsertMilestone>): Promise<Milestone> {
  const response = await trackedFetch("/api/milestones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(milestone),
  });
  return handleResponse(response);
}

async function rawUpdateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

async function rawCompleteMilestone(id: string): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}/complete`, { method: "PUT" });
  return handleResponse(response);
}

async function rawUncompleteMilestone(id: string): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}/uncomplete`, { method: "PUT" });
  return handleResponse(response);
}

async function rawDeleteMilestone(id: string): Promise<null> {
  const response = await trackedFetch(`/api/milestones/${id}`, { method: "DELETE" });
  return handleResponse(response);
}

async function rawCreateTask(task: Partial<InsertTask>): Promise<Task> {
  const response = await trackedFetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return handleResponse(response);
}

async function rawUpdateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

async function rawCompleteTask(id: string): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}/complete`, { method: "PUT" });
  return handleResponse(response);
}

async function rawUncompleteTask(id: string): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}/uncomplete`, { method: "PUT" });
  return handleResponse(response);
}

async function rawDeleteTask(id: string): Promise<null> {
  const response = await trackedFetch(`/api/tasks/${id}`, { method: "DELETE" });
  return handleResponse(response);
}

async function rawReorderTasks(taskIds: string[]): Promise<null> {
  const response = await trackedFetch("/api/tasks/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  });
  return handleResponse(response);
}

async function rawReorderTasksInMilestone(taskIds: string[], milestoneId: string): Promise<null> {
  const response = await trackedFetch("/api/tasks/reorder-in-milestone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds, milestoneId }),
  });
  return handleResponse(response);
}

async function rawCleanupTrash(): Promise<null> {
  const response = await trackedFetch("/api/cleanup-trash", { method: "POST" });
  return handleResponse(response);
}

async function rawEmptyTrash(): Promise<null> {
  const response = await trackedFetch("/api/empty-trash", { method: "POST" });
  return handleResponse(response);
}

async function rawRestoreTask(id: string): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}/restore`, { method: "PUT" });
  return handleResponse(response);
}

async function rawRestoreMilestone(id: string): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}/restore`, { method: "PUT" });
  return handleResponse(response);
}

/**
 * Map of raw, non-queueing mutation handlers keyed by `OfflineOpName`.
 * The offline queue uses these during drain to avoid re-queueing on a
 * transient network failure (which would otherwise re-order the queue).
 */
type RawHandler = (...args: unknown[]) => Promise<unknown>;

export const rawMutations: Record<OfflineOpName, RawHandler> = {
  createMilestone: rawCreateMilestone as RawHandler,
  updateMilestone: rawUpdateMilestone as RawHandler,
  completeMilestone: rawCompleteMilestone as RawHandler,
  uncompleteMilestone: rawUncompleteMilestone as RawHandler,
  deleteMilestone: rawDeleteMilestone as RawHandler,
  createTask: rawCreateTask as RawHandler,
  updateTask: rawUpdateTask as RawHandler,
  completeTask: rawCompleteTask as RawHandler,
  uncompleteTask: rawUncompleteTask as RawHandler,
  deleteTask: rawDeleteTask as RawHandler,
  reorderTasks: rawReorderTasks as RawHandler,
  reorderTasksInMilestone: rawReorderTasksInMilestone as RawHandler,
  cleanupTrash: rawCleanupTrash as RawHandler,
  emptyTrash: rawEmptyTrash as RawHandler,
  restoreTask: rawRestoreTask as RawHandler,
  restoreMilestone: rawRestoreMilestone as RawHandler,
};

// =============================================================================
// Read-only queries (always fetch directly — never queue).
// =============================================================================

export async function getMilestones(): Promise<Milestone[]> {
  const response = await trackedFetch("/api/milestones");
  return handleResponse(response);
}

export async function getActiveMilestones(): Promise<Milestone[]> {
  const response = await trackedFetch("/api/milestones/active");
  return handleResponse(response);
}

export async function getCompletedMilestones(): Promise<Milestone[]> {
  const response = await trackedFetch("/api/milestones/completed");
  return handleResponse(response);
}

export async function getTasks(): Promise<Task[]> {
  const response = await trackedFetch("/api/tasks");
  return handleResponse(response);
}

export async function getActiveTasks(): Promise<Task[]> {
  const response = await trackedFetch("/api/tasks/active");
  return handleResponse(response);
}

export async function getFocusTask(): Promise<Task | null> {
  const response = await trackedFetch("/api/tasks/focus");
  return handleResponse(response);
}

export async function getCompletedTasks(): Promise<Task[]> {
  const response = await trackedFetch("/api/tasks/completed");
  return handleResponse(response);
}

// =============================================================================
// Public mutation helpers — wrap raw mutations with the offline queue.
// =============================================================================

export async function createMilestone(milestone: Partial<InsertMilestone>): Promise<Milestone> {
  return executeOrQueue<Milestone>(
    "createMilestone",
    [milestone],
    milestoneStub(milestone),
    () => rawCreateMilestone(milestone),
    nonEmptyTitle(milestone.title),
  );
}

export async function updateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
  return executeOrQueue<Milestone>(
    "updateMilestone",
    [id, updates],
    milestoneStub({ id, ...(updates as Partial<InsertMilestone>) }, updates),
    () => rawUpdateMilestone(id, updates),
    nonEmptyTitle(updates.title) ?? lookupTitleById("milestone", id),
  );
}

export async function completeMilestone(id: string): Promise<Milestone> {
  return executeOrQueue<Milestone>(
    "completeMilestone",
    [id],
    milestoneStub({ id }, { isCompleted: true, completedAt: new Date() }),
    () => rawCompleteMilestone(id),
    lookupTitleById("milestone", id),
  );
}

export async function uncompleteMilestone(id: string): Promise<Milestone> {
  return executeOrQueue<Milestone>(
    "uncompleteMilestone",
    [id],
    milestoneStub({ id }, { isCompleted: false, completedAt: null }),
    () => rawUncompleteMilestone(id),
    lookupTitleById("milestone", id),
  );
}

export async function deleteMilestone(id: string): Promise<null> {
  return executeOrQueue<null>(
    "deleteMilestone",
    [id],
    null,
    () => rawDeleteMilestone(id),
    lookupTitleById("milestone", id),
  );
}

export async function createTask(task: Partial<InsertTask>): Promise<Task> {
  return executeOrQueue<Task>(
    "createTask",
    [task],
    taskStub(task),
    () => rawCreateTask(task),
    nonEmptyTitle(task.title),
  );
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  return executeOrQueue<Task>(
    "updateTask",
    [id, updates],
    taskStub({ id, ...(updates as Partial<InsertTask>) }, updates),
    () => rawUpdateTask(id, updates),
    nonEmptyTitle(updates.title) ?? lookupTitleById("task", id),
  );
}

export async function completeTask(id: string): Promise<Task> {
  return executeOrQueue<Task>(
    "completeTask",
    [id],
    taskStub({ id }, { isCompleted: true, completedAt: new Date() }),
    () => rawCompleteTask(id),
    lookupTitleById("task", id),
  );
}

export async function uncompleteTask(id: string): Promise<Task> {
  return executeOrQueue<Task>(
    "uncompleteTask",
    [id],
    taskStub({ id }, { isCompleted: false, completedAt: null }),
    () => rawUncompleteTask(id),
    lookupTitleById("task", id),
  );
}

export async function deleteTask(id: string): Promise<null> {
  return executeOrQueue<null>(
    "deleteTask",
    [id],
    null,
    () => rawDeleteTask(id),
    lookupTitleById("task", id),
  );
}

export async function reorderTasks(taskIds: string[]): Promise<null> {
  return executeOrQueue<null>(
    "reorderTasks",
    [taskIds],
    null,
    () => rawReorderTasks(taskIds),
  );
}

export async function reorderTasksInMilestone(taskIds: string[], milestoneId: string): Promise<null> {
  return executeOrQueue<null>(
    "reorderTasksInMilestone",
    [taskIds, milestoneId],
    null,
    () => rawReorderTasksInMilestone(taskIds, milestoneId),
  );
}

export async function cleanupTrash(): Promise<null> {
  return executeOrQueue<null>("cleanupTrash", [], null, () => rawCleanupTrash());
}

export async function emptyTrash(): Promise<null> {
  return executeOrQueue<null>("emptyTrash", [], null, () => rawEmptyTrash());
}

export async function restoreTask(id: string): Promise<Task> {
  return executeOrQueue<Task>(
    "restoreTask",
    [id],
    taskStub({ id }, { isDeleted: false, deletedAt: null }),
    () => rawRestoreTask(id),
    lookupTitleById("task", id),
  );
}

export async function restoreMilestone(id: string): Promise<Milestone> {
  return executeOrQueue<Milestone>(
    "restoreMilestone",
    [id],
    milestoneStub({ id }, { isDeleted: false, deletedAt: null }),
    () => rawRestoreMilestone(id),
    lookupTitleById("milestone", id),
  );
}
