import type { Milestone, Task, InsertMilestone, InsertTask } from "@shared/schema";
import { trackedFetch } from "./onlineStatus";

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

// Milestones
export async function getMilestones(): Promise<Milestone[]> {
  const response = await trackedFetch("/api/milestones");
  return handleResponse(response);
}

export async function createMilestone(milestone: Partial<InsertMilestone>): Promise<Milestone> {
  const response = await trackedFetch("/api/milestones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(milestone),
  });
  return handleResponse(response);
}

export async function updateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function completeMilestone(id: string): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}/complete`, {
    method: "PUT",
  });
  return handleResponse(response);
}

export async function uncompleteMilestone(id: string): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}/uncomplete`, {
    method: "PUT",
  });
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

export async function deleteMilestone(id: string): Promise<void> {
  const response = await trackedFetch(`/api/milestones/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

// Tasks
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

export async function createTask(task: Partial<InsertTask>): Promise<Task> {
  const response = await trackedFetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return handleResponse(response);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function completeTask(id: string): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}/complete`, {
    method: "PUT",
  });
  return handleResponse(response);
}

export async function uncompleteTask(id: string): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}/uncomplete`, {
    method: "PUT",
  });
  return handleResponse(response);
}

export async function getCompletedTasks(): Promise<Task[]> {
  const response = await trackedFetch("/api/tasks/completed");
  return handleResponse(response);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await trackedFetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  const response = await trackedFetch("/api/tasks/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  });
  return handleResponse(response);
}

export async function reorderTasksInMilestone(taskIds: string[], milestoneId: string): Promise<void> {
  const response = await trackedFetch("/api/tasks/reorder-in-milestone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds, milestoneId }),
  });
  return handleResponse(response);
}

export async function cleanupTrash(): Promise<void> {
  const response = await trackedFetch("/api/cleanup-trash", {
    method: "POST",
  });
  return handleResponse(response);
}

export async function emptyTrash(): Promise<void> {
  const response = await trackedFetch("/api/empty-trash", {
    method: "POST",
  });
  return handleResponse(response);
}

export async function restoreTask(id: string): Promise<Task> {
  const response = await trackedFetch(`/api/tasks/${id}/restore`, {
    method: "PUT",
  });
  return handleResponse(response);
}

export async function restoreMilestone(id: string): Promise<Milestone> {
  const response = await trackedFetch(`/api/milestones/${id}/restore`, {
    method: "PUT",
  });
  return handleResponse(response);
}
