import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { Milestone, Task } from "@shared/schema";
import confetti from "canvas-confetti";

export function useMilestones() {
  return useQuery({
    queryKey: ["/api/milestones"],
    queryFn: api.getMilestones,
  });
}

export function useActiveMilestones() {
  return useQuery({
    queryKey: ["/api/milestones/active"],
    queryFn: api.getActiveMilestones,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["/api/tasks"],
    queryFn: api.getTasks,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones/active"] });
    },
    onError: (error: any) => {
      console.error("Error creating milestone:", error);
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Milestone> }) =>
      api.updateMilestone(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
    onError: (error: any) => {
      console.error("Error updating milestone:", error);
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      console.error("Error deleting milestone:", error);
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      console.error("Error creating task:", error);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      api.updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      console.error("Error updating task:", error);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      console.error("Error deleting task:", error);
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderTasks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      console.error("Error reordering tasks:", error);
    },
  });
}

export function useCompleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeMilestone,
    onSuccess: () => {
      // Trigger confetti animation (with more intensity for milestone completion)
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/milestones/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      console.error("Error completing milestone:", error);
    },
  });
}

export function useGetCompletedMilestones() {
  return useQuery({
    queryKey: ["/api/milestones/completed"],
    queryFn: api.getCompletedMilestones,
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeTask,
    onSuccess: () => {
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completed"] });
    },
    onError: (error: any) => {
      console.error("Error completing task:", error);
    },
  });
}

export function useGetCompletedTasks() {
  return useQuery({
    queryKey: ["/api/tasks/completed"],
    queryFn: api.getCompletedTasks,
  });
}

export function useCleanupTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.cleanupTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });
}

export function useRestoreTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.restoreTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });
}

export function useRestoreMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.restoreMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
  });
}
