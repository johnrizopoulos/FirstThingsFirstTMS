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
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
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
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
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
