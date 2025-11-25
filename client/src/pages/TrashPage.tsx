import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { formatDistance } from "date-fns";

export default function TrashPage() {
  const { tasks, milestones, restoreTask, restoreMilestone, cleanupTrash } = useAppStore();

  // Trigger cleanup on mount
  useEffect(() => {
    cleanupTrash();
  }, [cleanupTrash]);

  const deletedTasks = tasks.filter(t => t.isDeleted).sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
  const deletedMilestones = milestones.filter(m => m.isDeleted).sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 border-b-2 border-destructive pb-2">
          <h2 className="text-xl font-bold text-destructive">
            // SYSTEM_RECYCLE_BIN
          </h2>
          <div className="text-xs text-destructive/70">
            ITEMS AUTO-PURGED AFTER 30 DAYS
          </div>
        </div>

        <div className="space-y-8">
          {/* Deleted Milestones */}
          <section>
            <h3 className="text-lg font-bold mb-4 opacity-70">DELETED MILESTONES</h3>
            {deletedMilestones.length === 0 ? (
              <div className="text-sm opacity-30 italic">No milestones in trash.</div>
            ) : (
              <div className="space-y-2">
                {deletedMilestones.map(m => (
                  <div key={m.id} className="border border-destructive/30 p-3 flex justify-between items-center bg-destructive/5">
                    <div>
                      <div className="font-bold text-destructive">{m.title}</div>
                      <div className="text-xs opacity-50">
                        Deleted {m.deletedAt && formatDistance(new Date(m.deletedAt), new Date(), { addSuffix: true })}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-destructive text-destructive hover:bg-destructive hover:text-black"
                      onClick={() => restoreMilestone(m.id)}
                    >
                      <RotateCcw className="w-3 h-3 mr-2" /> RESTORE
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Deleted Tasks */}
          <section>
            <h3 className="text-lg font-bold mb-4 opacity-70">DELETED TASKS</h3>
            {deletedTasks.length === 0 ? (
              <div className="text-sm opacity-30 italic">No tasks in trash.</div>
            ) : (
               <div className="space-y-2">
                {deletedTasks.map(t => (
                  <div key={t.id} className="border border-destructive/30 p-3 flex justify-between items-center bg-destructive/5">
                    <div>
                      <div className="font-bold text-destructive">{t.title}</div>
                      <div className="text-xs opacity-50">
                        Deleted {t.deletedAt && formatDistance(new Date(t.deletedAt), new Date(), { addSuffix: true })}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-destructive text-destructive hover:bg-destructive hover:text-black"
                      onClick={() => restoreTask(t.id)}
                    >
                      <RotateCcw className="w-3 h-3 mr-2" /> RESTORE
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
