import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { InsertMilestone, InsertTask, Milestone, Task } from "@shared/schema";
import confetti from "canvas-confetti";

// =============================================================================
// Cache key constants
// =============================================================================

const TASKS_KEY = ["/api/tasks"] as const;
const ACTIVE_TASKS_KEY = ["/api/tasks/active"] as const;
const FOCUS_TASK_KEY = ["/api/tasks/focus"] as const;
const COMPLETED_TASKS_KEY = ["/api/tasks/completed"] as const;
const MILESTONES_KEY = ["/api/milestones"] as const;
const ACTIVE_MILESTONES_KEY = ["/api/milestones/active"] as const;
const COMPLETED_MILESTONES_KEY = ["/api/milestones/completed"] as const;

// =============================================================================
// Optimistic-update helpers
// =============================================================================

interface TaskCacheSnapshot {
  tasks: Task[] | undefined;
  activeTasks: Task[] | undefined;
  focusTask: Task | null | undefined;
  completedTasks: Task[] | undefined;
}

interface MilestoneCacheSnapshot {
  milestones: Milestone[] | undefined;
  activeMilestones: Milestone[] | undefined;
  completedMilestones: Milestone[] | undefined;
}

async function cancelTaskQueries(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.cancelQueries({ queryKey: TASKS_KEY }),
    qc.cancelQueries({ queryKey: ACTIVE_TASKS_KEY }),
    qc.cancelQueries({ queryKey: FOCUS_TASK_KEY }),
    qc.cancelQueries({ queryKey: COMPLETED_TASKS_KEY }),
  ]);
}

async function cancelMilestoneQueries(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.cancelQueries({ queryKey: MILESTONES_KEY }),
    qc.cancelQueries({ queryKey: ACTIVE_MILESTONES_KEY }),
    qc.cancelQueries({ queryKey: COMPLETED_MILESTONES_KEY }),
  ]);
}

function snapshotTasks(qc: QueryClient): TaskCacheSnapshot {
  return {
    tasks: qc.getQueryData<Task[]>(TASKS_KEY),
    activeTasks: qc.getQueryData<Task[]>(ACTIVE_TASKS_KEY),
    focusTask: qc.getQueryData<Task | null>(FOCUS_TASK_KEY),
    completedTasks: qc.getQueryData<Task[]>(COMPLETED_TASKS_KEY),
  };
}

function snapshotMilestones(qc: QueryClient): MilestoneCacheSnapshot {
  return {
    milestones: qc.getQueryData<Milestone[]>(MILESTONES_KEY),
    activeMilestones: qc.getQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY),
    completedMilestones: qc.getQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY),
  };
}

function restoreTasks(qc: QueryClient, snap: TaskCacheSnapshot): void {
  if (snap.tasks !== undefined) qc.setQueryData(TASKS_KEY, snap.tasks);
  if (snap.activeTasks !== undefined) qc.setQueryData(ACTIVE_TASKS_KEY, snap.activeTasks);
  if (snap.focusTask !== undefined) qc.setQueryData(FOCUS_TASK_KEY, snap.focusTask);
  if (snap.completedTasks !== undefined) qc.setQueryData(COMPLETED_TASKS_KEY, snap.completedTasks);
}

function restoreMilestones(qc: QueryClient, snap: MilestoneCacheSnapshot): void {
  if (snap.milestones !== undefined) qc.setQueryData(MILESTONES_KEY, snap.milestones);
  if (snap.activeMilestones !== undefined) qc.setQueryData(ACTIVE_MILESTONES_KEY, snap.activeMilestones);
  if (snap.completedMilestones !== undefined) qc.setQueryData(COMPLETED_MILESTONES_KEY, snap.completedMilestones);
}

function refetchTaskQueries(qc: QueryClient): void {
  qc.refetchQueries({ queryKey: TASKS_KEY });
  qc.refetchQueries({ queryKey: ACTIVE_TASKS_KEY });
  qc.refetchQueries({ queryKey: FOCUS_TASK_KEY });
  qc.refetchQueries({ queryKey: COMPLETED_TASKS_KEY });
}

function refetchMilestoneQueries(qc: QueryClient): void {
  qc.refetchQueries({ queryKey: MILESTONES_KEY });
  qc.refetchQueries({ queryKey: ACTIVE_MILESTONES_KEY });
  qc.refetchQueries({ queryKey: COMPLETED_MILESTONES_KEY });
}

// Mirror server's getFocusTask: first non-deleted, non-completed task by globalOrder.
function computeFocusTask(active: Task[] | undefined): Task | null {
  if (!active) return null;
  return (
    [...active]
      .filter((t) => !t.isDeleted && !t.isCompleted)
      .sort((a, b) => a.globalOrder - b.globalOrder)[0] ?? null
  );
}

// =============================================================================
// Read-only queries
// =============================================================================

export function useMilestones() {
  return useQuery({
    queryKey: MILESTONES_KEY,
    queryFn: api.getMilestones,
  });
}

export function useActiveMilestones() {
  return useQuery({
    queryKey: ACTIVE_MILESTONES_KEY,
    queryFn: api.getActiveMilestones,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: api.getTasks,
  });
}

export function useActiveTasks() {
  return useQuery({
    queryKey: ACTIVE_TASKS_KEY,
    queryFn: api.getActiveTasks,
  });
}

export function useFocusTask() {
  return useQuery({
    queryKey: FOCUS_TASK_KEY,
    queryFn: api.getFocusTask,
  });
}

export function useGetCompletedMilestones() {
  return useQuery({
    queryKey: COMPLETED_MILESTONES_KEY,
    queryFn: api.getCompletedMilestones,
  });
}

export function useGetCompletedTasks() {
  return useQuery({
    queryKey: COMPLETED_TASKS_KEY,
    queryFn: api.getCompletedTasks,
  });
}

// =============================================================================
// Milestone mutations (optimistic)
// =============================================================================

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createMilestone,
    onMutate: async (input: Partial<InsertMilestone>) => {
      await cancelMilestoneQueries(queryClient);
      const snap = snapshotMilestones(queryClient);
      const optimistic = api.milestoneStub(input);
      // Pin the optimistic id so the stub returned by api.createMilestone
      // (offline path) matches what we just put in the cache.
      input.id = optimistic.id;

      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) =>
        old ? [...old, optimistic] : old,
      );
      queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) =>
        old ? [...old, optimistic] : old,
      );

      return { snap, optimisticId: optimistic.id };
    },
    onError: (error, _input, context) => {
      if (context) restoreMilestones(queryClient, context.snap);
      console.error("Error creating milestone:", error);
    },
    onSuccess: (data, _input, context) => {
      if (!context || !data) return;
      const replace = (m: Milestone) => (m.id === context.optimisticId ? data : m);
      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) => old?.map(replace));
    },
    onSettled: () => {
      refetchMilestoneQueries(queryClient);
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Milestone> }) =>
      api.updateMilestone(id, updates),
    onMutate: async ({ id, updates }) => {
      await cancelMilestoneQueries(queryClient);
      const snap = snapshotMilestones(queryClient);
      const apply = (m: Milestone): Milestone =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m;

      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) => old?.map(apply));
      queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) => old?.map(apply));
      queryClient.setQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY, (old) => old?.map(apply));

      return { snap };
    },
    onError: (error, _input, context) => {
      if (context) restoreMilestones(queryClient, context.snap);
      console.error("Error updating milestone:", error);
    },
    onSuccess: (data, { id }) => {
      if (!data) return;
      const replace = (m: Milestone) => (m.id === id ? data : m);
      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY, (old) => old?.map(replace));
    },
    onSettled: () => {
      refetchMilestoneQueries(queryClient);
    },
  });
}

export function useCompleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeMilestone,
    onMutate: async (id: string) => {
      await cancelMilestoneQueries(queryClient);
      await cancelTaskQueries(queryClient);
      const milestoneSnap = snapshotMilestones(queryClient);
      const taskSnap = snapshotTasks(queryClient);
      const completedAt = new Date();

      // Move milestone from active → completed.
      const completing = milestoneSnap.activeMilestones?.find((m) => m.id === id)
        ?? milestoneSnap.milestones?.find((m) => m.id === id);
      const completed: Milestone | null = completing
        ? { ...completing, isCompleted: true, completedAt, updatedAt: completedAt }
        : null;

      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) =>
        old?.map((m) => (m.id === id ? { ...m, isCompleted: true, completedAt, updatedAt: completedAt } : m)),
      );
      queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) =>
        old?.filter((m) => m.id !== id),
      );
      if (completed) {
        queryClient.setQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY, (old) =>
          old ? [...old, completed] : old,
        );
      }

      // Server cascades: every active task linked to this milestone becomes completed too.
      const cascadeTask = (t: Task): Task =>
        t.milestoneId === id && !t.isCompleted
          ? { ...t, isCompleted: true, completedAt, updatedAt: completedAt }
          : t;
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(cascadeTask));
      const newActiveTasks = taskSnap.activeTasks?.filter((t) => t.milestoneId !== id);
      if (newActiveTasks !== undefined) {
        queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, newActiveTasks);
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, computeFocusTask(newActiveTasks));
      } else if (taskSnap.focusTask && taskSnap.focusTask.milestoneId === id) {
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, null);
      }

      return { milestoneSnap, taskSnap };
    },
    onError: (error, _id, context) => {
      if (context) {
        restoreMilestones(queryClient, context.milestoneSnap);
        restoreTasks(queryClient, context.taskSnap);
      }
      console.error("Error completing milestone:", error);
    },
    onSuccess: (data) => {
      if (!data) return;
      const replace = (m: Milestone) => (m.id === data.id ? data : m);
      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY, (old) => old?.map(replace));

      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
      });
    },
    onSettled: () => {
      refetchMilestoneQueries(queryClient);
      refetchTaskQueries(queryClient);
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteMilestone,
    onMutate: async (id: string) => {
      await cancelMilestoneQueries(queryClient);
      await cancelTaskQueries(queryClient);
      const milestoneSnap = snapshotMilestones(queryClient);
      const taskSnap = snapshotTasks(queryClient);
      const deletedAt = new Date();

      const markDeleted = (m: Milestone): Milestone =>
        m.id === id ? { ...m, isDeleted: true, deletedAt, updatedAt: deletedAt } : m;
      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) => old?.map(markDeleted));
      queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) =>
        old?.filter((m) => m.id !== id),
      );
      queryClient.setQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY, (old) =>
        old?.filter((m) => m.id !== id),
      );

      // Server cascades: every task linked to this milestone is soft-deleted.
      const cascadeTask = (t: Task): Task =>
        t.milestoneId === id ? { ...t, isDeleted: true, deletedAt, updatedAt: deletedAt } : t;
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(cascadeTask));
      const newActiveTasks = taskSnap.activeTasks?.filter((t) => t.milestoneId !== id);
      if (newActiveTasks !== undefined) {
        queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, newActiveTasks);
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, computeFocusTask(newActiveTasks));
      } else if (taskSnap.focusTask && taskSnap.focusTask.milestoneId === id) {
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, null);
      }

      return { milestoneSnap, taskSnap };
    },
    onError: (error, _id, context) => {
      if (context) {
        restoreMilestones(queryClient, context.milestoneSnap);
        restoreTasks(queryClient, context.taskSnap);
      }
      console.error("Error deleting milestone:", error);
    },
    onSettled: () => {
      refetchMilestoneQueries(queryClient);
      refetchTaskQueries(queryClient);
    },
  });
}

export function useUncompleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.uncompleteMilestone,
    onMutate: async (id: string) => {
      await cancelMilestoneQueries(queryClient);
      const snap = snapshotMilestones(queryClient);
      const now = new Date();

      const reopened = snap.completedMilestones?.find((m) => m.id === id)
        ?? snap.milestones?.find((m) => m.id === id);
      const updated: Milestone | null = reopened
        ? { ...reopened, isCompleted: false, completedAt: null, updatedAt: now }
        : null;

      queryClient.setQueryData<Milestone[]>(MILESTONES_KEY, (old) =>
        old?.map((m) => (m.id === id ? { ...m, isCompleted: false, completedAt: null, updatedAt: now } : m)),
      );
      queryClient.setQueryData<Milestone[]>(COMPLETED_MILESTONES_KEY, (old) =>
        old?.filter((m) => m.id !== id),
      );
      if (updated) {
        queryClient.setQueryData<Milestone[]>(ACTIVE_MILESTONES_KEY, (old) =>
          old ? [...old, updated] : old,
        );
      }

      return { snap };
    },
    onError: (error, _id, context) => {
      if (context) restoreMilestones(queryClient, context.snap);
      console.error("Error uncompleting milestone:", error);
    },
    onSettled: () => {
      refetchMilestoneQueries(queryClient);
    },
  });
}

export function useRestoreMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.restoreMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONES_KEY });
    },
  });
}

// =============================================================================
// Task mutations (optimistic)
// =============================================================================

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createTask,
    onMutate: async (input: Partial<InsertTask>) => {
      await cancelTaskQueries(queryClient);
      const snap = snapshotTasks(queryClient);
      const optimistic = api.taskStub(input);
      // Pin the optimistic id so the stub returned by api.createTask
      // (offline path) matches what we just put in the cache.
      input.id = optimistic.id;

      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old ? [...old, optimistic] : old,
      );
      const nextActive = snap.activeTasks ? [...snap.activeTasks, optimistic] : undefined;
      if (nextActive) {
        queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, nextActive);
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, computeFocusTask(nextActive));
      } else if (snap.focusTask === null || snap.focusTask === undefined) {
        // No active list cached and no current focus — surface the new task as focus
        // so the Focus page reflects the offline create immediately.
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, optimistic);
      }

      return { snap, optimisticId: optimistic.id };
    },
    onError: (error, _input, context) => {
      if (context) restoreTasks(queryClient, context.snap);
      console.error("Error creating task:", error);
    },
    onSuccess: (data, _input, context) => {
      if (!context || !data) return;
      const replace = (t: Task) => (t.id === context.optimisticId ? data : t);
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, (old) =>
        old && old.id === context.optimisticId ? data : old,
      );
    },
    onSettled: () => {
      refetchTaskQueries(queryClient);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      api.updateTask(id, updates),
    onMutate: async ({ id, updates }) => {
      await cancelTaskQueries(queryClient);
      const snap = snapshotTasks(queryClient);
      const apply = (t: Task): Task =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t;

      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(apply));
      queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, (old) => old?.map(apply));
      queryClient.setQueryData<Task[]>(COMPLETED_TASKS_KEY, (old) => old?.map(apply));
      queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, (old) =>
        old && old.id === id ? apply(old) : old,
      );

      return { snap };
    },
    onError: (error, _input, context) => {
      if (context) restoreTasks(queryClient, context.snap);
      console.error("Error updating task:", error);
    },
    onSuccess: (data, { id }) => {
      if (!data) return;
      const replace = (t: Task) => (t.id === id ? data : t);
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Task[]>(COMPLETED_TASKS_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, (old) =>
        old && old.id === id ? data : old,
      );
    },
    onSettled: () => {
      refetchTaskQueries(queryClient);
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeTask,
    onMutate: async (id: string) => {
      await cancelTaskQueries(queryClient);
      const snap = snapshotTasks(queryClient);
      const completedAt = new Date();

      const completing = snap.activeTasks?.find((t) => t.id === id)
        ?? snap.tasks?.find((t) => t.id === id)
        ?? (snap.focusTask?.id === id ? snap.focusTask : null);
      const completed: Task | null = completing
        ? { ...completing, isCompleted: true, completedAt, updatedAt: completedAt }
        : null;

      const markCompleted = (t: Task): Task =>
        t.id === id ? { ...t, isCompleted: true, completedAt, updatedAt: completedAt } : t;
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(markCompleted));

      const newActive = snap.activeTasks?.filter((t) => t.id !== id);
      if (newActive !== undefined) {
        queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, newActive);
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, computeFocusTask(newActive));
      } else if (snap.focusTask?.id === id) {
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, null);
      }

      if (completed) {
        queryClient.setQueryData<Task[]>(COMPLETED_TASKS_KEY, (old) =>
          old ? [...old, completed] : old,
        );
      }

      return { snap };
    },
    onError: (error, _id, context) => {
      if (context) restoreTasks(queryClient, context.snap);
      console.error("Error completing task:", error);
    },
    onSuccess: (data) => {
      if (!data) return;
      const replace = (t: Task) => (t.id === data.id ? data : t);
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(replace));
      queryClient.setQueryData<Task[]>(COMPLETED_TASKS_KEY, (old) => old?.map(replace));

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    },
    onSettled: () => {
      refetchTaskQueries(queryClient);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteTask,
    onMutate: async (id: string) => {
      await cancelTaskQueries(queryClient);
      const snap = snapshotTasks(queryClient);
      const deletedAt = new Date();

      const markDeleted = (t: Task): Task =>
        t.id === id ? { ...t, isDeleted: true, deletedAt, updatedAt: deletedAt } : t;
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) => old?.map(markDeleted));
      queryClient.setQueryData<Task[]>(COMPLETED_TASKS_KEY, (old) =>
        old?.filter((t) => t.id !== id),
      );

      const newActive = snap.activeTasks?.filter((t) => t.id !== id);
      if (newActive !== undefined) {
        queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, newActive);
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, computeFocusTask(newActive));
      } else if (snap.focusTask?.id === id) {
        queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, null);
      }

      return { snap };
    },
    onError: (error, _id, context) => {
      if (context) restoreTasks(queryClient, context.snap);
      console.error("Error deleting task:", error);
    },
    onSettled: () => {
      refetchTaskQueries(queryClient);
    },
  });
}

export function useUncompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.uncompleteTask,
    onMutate: async (id: string) => {
      await cancelTaskQueries(queryClient);
      const snap = snapshotTasks(queryClient);
      const now = new Date();

      const reopening = snap.completedTasks?.find((t) => t.id === id)
        ?? snap.tasks?.find((t) => t.id === id);
      const reopened: Task | null = reopening
        ? { ...reopening, isCompleted: false, completedAt: null, updatedAt: now }
        : null;

      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old?.map((t) => (t.id === id ? { ...t, isCompleted: false, completedAt: null, updatedAt: now } : t)),
      );
      queryClient.setQueryData<Task[]>(COMPLETED_TASKS_KEY, (old) =>
        old?.filter((t) => t.id !== id),
      );
      if (reopened) {
        const nextActive = snap.activeTasks ? [...snap.activeTasks, reopened] : undefined;
        if (nextActive !== undefined) {
          queryClient.setQueryData<Task[]>(ACTIVE_TASKS_KEY, nextActive);
          queryClient.setQueryData<Task | null>(FOCUS_TASK_KEY, computeFocusTask(nextActive));
        }
      }

      return { snap };
    },
    onError: (error, _id, context) => {
      if (context) restoreTasks(queryClient, context.snap);
      console.error("Error uncompleting task:", error);
    },
    onSettled: () => {
      refetchTaskQueries(queryClient);
    },
  });
}

export function useRestoreTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.restoreTask,
    onSuccess: () => {
      refetchTaskQueries(queryClient);
    },
  });
}

// =============================================================================
// Reorder mutations (already optimistic)
// =============================================================================

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderTasks,
    onMutate: async (taskIds: string[]) => {
      await cancelTaskQueries(queryClient);

      const previousActiveTasks = queryClient.getQueryData<Task[]>(ACTIVE_TASKS_KEY);
      const previousTasks = queryClient.getQueryData<Task[]>(TASKS_KEY);

      // Optimistically update /api/tasks/active cache (used by ListPage)
      if (previousActiveTasks) {
        const taskMap = new Map(previousActiveTasks.map((t) => [t.id, t]));
        const reorderedTasks = taskIds
          .map((id, index) => {
            const task = taskMap.get(id);
            return task ? { ...task, globalOrder: index } : null;
          })
          .filter((t): t is Task => !!t);

        const unmovedTasks = previousActiveTasks
          .filter((t) => !taskIds.includes(t.id))
          .map((t, index) => ({ ...t, globalOrder: taskIds.length + index }));

        queryClient.setQueryData(ACTIVE_TASKS_KEY, [...reorderedTasks, ...unmovedTasks]);
      }

      if (previousTasks) {
        const taskMap = new Map(previousTasks.map((t) => [t.id, t]));
        const reorderedTasks = taskIds
          .map((id, index) => {
            const task = taskMap.get(id);
            return task ? { ...task, globalOrder: index } : null;
          })
          .filter((t): t is Task => !!t);

        const unmovedTasks = previousTasks
          .filter((t) => !taskIds.includes(t.id))
          .map((t, index) => ({ ...t, globalOrder: taskIds.length + index }));

        queryClient.setQueryData(TASKS_KEY, [...reorderedTasks, ...unmovedTasks]);
      }

      if (taskIds.length > 0 && previousActiveTasks) {
        const firstTask = previousActiveTasks.find((t) => t.id === taskIds[0]);
        if (firstTask) {
          queryClient.setQueryData(FOCUS_TASK_KEY, { ...firstTask, globalOrder: 0 });
        }
      }

      return { previousActiveTasks, previousTasks };
    },
    onError: (error, _taskIds, context) => {
      if (context?.previousActiveTasks) {
        queryClient.setQueryData(ACTIVE_TASKS_KEY, context.previousActiveTasks);
      }
      if (context?.previousTasks) {
        queryClient.setQueryData(TASKS_KEY, context.previousTasks);
      }
      console.error("Error reordering tasks:", error);
    },
  });
}

export function useReorderTasksInMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskIds, milestoneId }: { taskIds: string[]; milestoneId: string }) =>
      api.reorderTasksInMilestone(taskIds, milestoneId),
    onMutate: async ({ taskIds }: { taskIds: string[]; milestoneId: string }) => {
      await cancelTaskQueries(queryClient);

      const previousActiveTasks = queryClient.getQueryData<Task[]>(ACTIVE_TASKS_KEY);
      const previousTasks = queryClient.getQueryData<Task[]>(TASKS_KEY);

      if (previousActiveTasks) {
        const taskMap = new Map(previousActiveTasks.map((t) => [t.id, t]));
        const reorderedTasks = taskIds
          .map((id, index) => {
            const task = taskMap.get(id);
            return task ? { ...task, milestoneOrder: index } : null;
          })
          .filter((t): t is Task => !!t);

        const unmovedTasks = previousActiveTasks.filter((t) => !taskIds.includes(t.id));

        queryClient.setQueryData(ACTIVE_TASKS_KEY, [...reorderedTasks, ...unmovedTasks]);
      }

      if (previousTasks) {
        const taskMap = new Map(previousTasks.map((t) => [t.id, t]));
        const reorderedTasks = taskIds
          .map((id, index) => {
            const task = taskMap.get(id);
            return task ? { ...task, milestoneOrder: index } : null;
          })
          .filter((t): t is Task => !!t);

        const unmovedTasks = previousTasks.filter((t) => !taskIds.includes(t.id));

        queryClient.setQueryData(TASKS_KEY, [...reorderedTasks, ...unmovedTasks]);
      }

      return { previousActiveTasks, previousTasks };
    },
    onError: (error, _vars, context) => {
      if (context?.previousActiveTasks) {
        queryClient.setQueryData(ACTIVE_TASKS_KEY, context.previousActiveTasks);
      }
      if (context?.previousTasks) {
        queryClient.setQueryData(TASKS_KEY, context.previousTasks);
      }
      console.error("Error reordering tasks in milestone:", error);
    },
  });
}

// =============================================================================
// Trash mutations
// =============================================================================

export function useCleanupTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.cleanupTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.emptyTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}
