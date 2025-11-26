import React, { useEffect, useState } from "react";
import { useTasks, useMilestones, useRestoreTask, useRestoreMilestone, useCleanupTrash } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { formatDistance } from "date-fns";
import { toast } from "sonner";

export default function TrashPage() {
  const { data: tasks = [] } = useTasks();
  const { data: milestones = [] } = useMilestones();
  const restoreTask = useRestoreTask();
  const restoreMilestone = useRestoreMilestone();
  const cleanupTrash = useCleanupTrash();
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    cleanupTrash.mutate(undefined, {
      onError: (error: any) => {
        console.error("Trash cleanup failed:", error);
      },
    });
  }, []);

  const deletedTasks = tasks.filter(t => t.isDeleted).sort((a, b) => 
    (b.deletedAt ? new Date(b.deletedAt).getTime() : 0) - (a.deletedAt ? new Date(a.deletedAt).getTime() : 0)
  );
  
  const deletedMilestones = milestones.filter(m => m.isDeleted).sort((a, b) => 
    (b.deletedAt ? new Date(b.deletedAt).getTime() : 0) - (a.deletedAt ? new Date(a.deletedAt).getTime() : 0)
  );

  const handleRestoreTask = (taskId: string) => {
    setRestoreError(null);
    restoreTask.mutate(taskId, {
      onSuccess: () => {
        toast.success("Task restored");
      },
      onError: (error: any) => {
        const message = error?.message || "Failed to restore task";
        setRestoreError(message);
        toast.error(message);
      },
    });
  };

  const handleRestoreMilestone = (milestoneId: string) => {
    setRestoreError(null);
    restoreMilestone.mutate(milestoneId, {
      onSuccess: () => {
        toast.success("Milestone restored");
      },
      onError: (error: any) => {
        const message = error?.message || "Failed to restore milestone";
        setRestoreError(message);
        toast.error(message);
      },
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 md:mb-6 border-b-2 border-destructive pb-2">
          <h2 className="text-base md:text-xl font-bold text-destructive">
            <span className="hidden sm:inline">// TRASH_BIN</span>
            <span className="sm:hidden">// RECYCLE_BIN</span>
          </h2>
          <div className="text-[10px] md:text-xs text-destructive/70">
            AUTO-PURGED AFTER 30 DAYS
          </div>
        </div>

        {restoreError && (
          <div className="mb-4 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs rounded" data-testid="alert-restore-error">
            {restoreError}
          </div>
        )}

        <div className="space-y-6 md:space-y-8">
          <section>
            <h3 className="text-sm md:text-lg font-bold mb-3 md:mb-4 opacity-70">DELETED MILESTONES</h3>
            {deletedMilestones.length === 0 ? (
              <div className="text-xs md:text-sm opacity-30 italic">No milestones in trash.</div>
            ) : (
              <div className="space-y-2">
                {deletedMilestones.map(m => (
                  <div key={m.id} className="border border-destructive/30 p-2 md:p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-destructive/5" data-testid={`card-deleted-milestone-${m.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-destructive text-sm md:text-base truncate">{m.title}</div>
                      <div className="text-[10px] md:text-xs opacity-50">
                        Deleted {m.deletedAt && formatDistance(new Date(m.deletedAt), new Date(), { addSuffix: true })}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      data-testid={`button-restore-milestone-${m.id}`}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white rounded-none font-mono text-xs w-full sm:w-auto shrink-0"
                      onClick={() => handleRestoreMilestone(m.id)}
                      disabled={restoreMilestone.isPending}
                    >
                      <RotateCcw className="w-3 h-3 mr-2" /> {restoreMilestone.isPending ? "RESTORING..." : "RESTORE"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm md:text-lg font-bold mb-3 md:mb-4 opacity-70">DELETED TASKS</h3>
            {deletedTasks.length === 0 ? (
              <div className="text-xs md:text-sm opacity-30 italic">No tasks in trash.</div>
            ) : (
               <div className="space-y-2">
                {deletedTasks.map(t => (
                  <div key={t.id} className="border border-destructive/30 p-2 md:p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-destructive/5" data-testid={`card-deleted-task-${t.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-destructive text-sm md:text-base truncate">{t.title}</div>
                      <div className="text-[10px] md:text-xs opacity-50">
                        Deleted {t.deletedAt && formatDistance(new Date(t.deletedAt), new Date(), { addSuffix: true })}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      data-testid={`button-restore-task-${t.id}`}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white rounded-none font-mono text-xs w-full sm:w-auto shrink-0"
                      onClick={() => handleRestoreTask(t.id)}
                      disabled={restoreTask.isPending}
                    >
                      <RotateCcw className="w-3 h-3 mr-2" /> {restoreTask.isPending ? "RESTORING..." : "RESTORE"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
