import React from "react";
import { useGetCompletedTasks, useGetCompletedMilestones, useUncompleteTask, useUncompleteMilestone } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw } from "lucide-react";
import type { Task, Milestone } from "@shared/schema";

export default function CompletedPage() {
  const { data: completedTasks = [], isLoading: tasksLoading } = useGetCompletedTasks();
  const { data: completedMilestones = [], isLoading: milestonesLoading } = useGetCompletedMilestones();
  const uncompleteTask = useUncompleteTask();
  const uncompleteMilestone = useUncompleteMilestone();
  const { toast } = useToast();

  const isLoading = tasksLoading || milestonesLoading;

  const handleUncompleteTask = (taskId: string) => {
    uncompleteTask.mutate(taskId, {
      onSuccess: () => {
        toast({
          title: "SUCCESS",
          description: "Task moved back to active",
        });
      },
      onError: (error: any) => {
        const message = error?.message || "Failed to uncomplete task";
        toast({
          title: "ERROR",
          description: message,
          variant: "destructive",
        });
      },
    });
  };

  const handleUncompleteMilestone = (milestoneId: string) => {
    uncompleteMilestone.mutate(milestoneId, {
      onSuccess: () => {
        toast({
          title: "SUCCESS",
          description: "Milestone moved back to active",
        });
      },
      onError: (error: any) => {
        const message = error?.message || "Failed to uncomplete milestone";
        toast({
          title: "ERROR",
          description: message,
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center">
          <p className="text-lg">LOADING_COMPLETED_ITEMS...</p>
        </div>
      </Layout>
    );
  }

  const hasItems = completedTasks.length > 0 || completedMilestones.length > 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-4 uppercase">COMPLETED</h1>
          <p className="text-xs opacity-50">All completed tasks and milestones are permanently stored here</p>
        </div>

        {!hasItems ? (
          <div className="border-2 border-primary p-6 text-center">
            <p className="text-sm opacity-50">NO_COMPLETED_ITEMS_YET</p>
            <p className="text-xs opacity-40 mt-2">Complete tasks or milestones to see them here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Completed Milestones */}
            {completedMilestones.length > 0 && (
              <div>
                <h2 className="text-base font-bold mb-3 uppercase border-b border-primary pb-2">
                  MILESTONES ({completedMilestones.length})
                </h2>
                <div className="space-y-3">
                  {completedMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      data-testid={`card-completed-milestone-${milestone.id}`}
                      className="border border-primary p-3 md:p-4 bg-card hover:bg-primary/5 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 data-testid={`text-milestone-title-${milestone.id}`} className="font-bold text-sm mb-2">
                          {milestone.title}
                        </h3>
                        {milestone.description && (
                          <p data-testid={`text-milestone-description-${milestone.id}`} className="text-xs opacity-70 mb-2 whitespace-pre-wrap">
                            {milestone.description}
                          </p>
                        )}
                        {milestone.completedAt && (
                          <p className="text-xs opacity-50">
                            Completed: {new Date(milestone.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-uncomplete-milestone-${milestone.id}`}
                        className="border-primary text-primary hover:bg-primary hover:text-background rounded-none font-mono text-xs w-full sm:w-auto shrink-0"
                        onClick={() => handleUncompleteMilestone(milestone.id)}
                        disabled={uncompleteMilestone.isPending}
                      >
                        <RotateCcw className="w-3 h-3 mr-2" /> {uncompleteMilestone.isPending ? "UNCOMPLETING..." : "UNCOMPLETE"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-base font-bold mb-3 uppercase border-b border-primary pb-2">
                  TASKS ({completedTasks.length})
                </h2>
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      data-testid={`card-completed-task-${task.id}`}
                      className="border border-primary p-3 md:p-4 bg-card hover:bg-primary/5 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 data-testid={`text-task-title-${task.id}`} className="font-bold text-sm mb-2">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p data-testid={`text-task-description-${task.id}`} className="text-xs opacity-70 mb-2 whitespace-pre-wrap">
                            {task.description}
                          </p>
                        )}
                        {task.completedAt && (
                          <p className="text-xs opacity-50">
                            Completed: {new Date(task.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-uncomplete-task-${task.id}`}
                        className="border-primary text-primary hover:bg-primary hover:text-background rounded-none font-mono text-xs w-full sm:w-auto shrink-0"
                        onClick={() => handleUncompleteTask(task.id)}
                        disabled={uncompleteTask.isPending}
                      >
                        <RotateCcw className="w-3 h-3 mr-2" /> {uncompleteTask.isPending ? "UNCOMPLETING..." : "UNCOMPLETE"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
