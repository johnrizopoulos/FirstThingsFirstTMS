import type { Milestone, Task, InsertMilestone, InsertTask } from "@shared/schema";

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
  const response = await fetch("/api/milestones");
  return handleResponse(response);
}

export async function createMilestone(milestone: Partial<InsertMilestone>): Promise<Milestone> {
  const response = await fetch("/api/milestones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(milestone),
  });
  return handleResponse(response);
}

export async function updateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
  const response = await fetch(`/api/milestones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function deleteMilestone(id: string): Promise<void> {
  const response = await fetch(`/api/milestones/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

// Tasks
export async function getTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks");
  return handleResponse(response);
}

export async function createTask(task: Partial<InsertTask>): Promise<Task> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return handleResponse(response);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  const response = await fetch("/api/tasks/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  });
  return handleResponse(response);
}

export async function cleanupTrash(): Promise<void> {
  const response = await fetch("/api/cleanup-trash", {
    method: "POST",
  });
  return handleResponse(response);
}
