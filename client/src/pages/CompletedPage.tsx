import React from "react";
import { useGetCompletedTasks, useGetCompletedMilestones } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import type { Task, Milestone } from "@shared/schema";

export default function CompletedPage() {
  const { data: completedTasks = [], isLoading: tasksLoading } = useGetCompletedTasks();
  const { data: completedMilestones = [], isLoading: milestonesLoading } = useGetCompletedMilestones();

  const isLoading = tasksLoading || milestonesLoading;

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
                      className="border border-primary p-4 bg-card hover:bg-primary/5 transition-colors"
                    >
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
                      className="border border-primary p-4 bg-card hover:bg-primary/5 transition-colors"
                    >
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
