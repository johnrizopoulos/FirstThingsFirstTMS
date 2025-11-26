import type { Milestone, Task, InsertMilestone, InsertTask } from "@shared/schema";
import { getAuthHeaders } from "./anonymousUser";

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
  const response = await fetch("/api/milestones", {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function createMilestone(milestone: Partial<InsertMilestone>): Promise<Milestone> {
  const response = await fetch("/api/milestones", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(milestone),
  });
  return handleResponse(response);
}

export async function updateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
  const response = await fetch(`/api/milestones/${id}`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function completeMilestone(id: string): Promise<Milestone> {
  const response = await fetch(`/api/milestones/${id}/complete`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getActiveMilestones(): Promise<Milestone[]> {
  const response = await fetch("/api/milestones/active", {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getCompletedMilestones(): Promise<Milestone[]> {
  const response = await fetch("/api/milestones/completed", {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function deleteMilestone(id: string): Promise<void> {
  const response = await fetch(`/api/milestones/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

// Tasks
export async function getTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks", {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function createTask(task: Partial<InsertTask>): Promise<Task> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(task),
  });
  return handleResponse(response);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function completeTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}/complete`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function getCompletedTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks/completed", {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  const response = await fetch("/api/tasks/reorder", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ taskIds }),
  });
  return handleResponse(response);
}

export async function cleanupTrash(): Promise<void> {
  const response = await fetch("/api/cleanup-trash", {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function restoreTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}/restore`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

export async function restoreMilestone(id: string): Promise<Milestone> {
  const response = await fetch(`/api/milestones/${id}/restore`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}
