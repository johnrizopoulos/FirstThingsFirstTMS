import React, { useState } from "react";
import { useTasks, useMilestones, useCreateTask, useCreateMilestone, useUpdateMilestone, useDeleteMilestone, useReorderTasks } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, Milestone } from "@shared/schema";

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`card-task-${task.id}`}
      className={cn(
        "bg-black border border-primary/50 p-2 mb-2 text-xs cursor-grab active:cursor-grabbing hover:border-primary hover:bg-secondary/20 transition-colors",
        isDragging && "opacity-50 bg-secondary border-dashed",
        task.isCompleted && "opacity-50 line-through"
      )}
    >
      <div className="font-bold mb-1 truncate">{task.title}</div>
    </div>
  );
}

export default function BoardPage() {
  const { data: milestones = [], isLoading: milestonesLoading } = useMilestones();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const createTask = useCreateTask();
  const reorderTasks = useReorderTasks();
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent, milestoneId: string) => {
    const { active, over } = event;
    if (!over) return;
    
    if (active.id !== over.id) {
       const milestoneTasks = tasks
        .filter(t => t.milestoneId === milestoneId && !t.isDeleted && !t.isCompleted)
        .sort((a, b) => a.milestoneOrder - b.milestoneOrder);
        
       const oldIndex = milestoneTasks.findIndex(t => t.id === active.id);
       const newIndex = milestoneTasks.findIndex(t => t.id === over.id);
       
       const newOrder = arrayMove(milestoneTasks, oldIndex, newIndex);
       reorderTasks.mutate(newOrder.map(t => t.id));
    }
  };

  if (milestonesLoading || tasksLoading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-4 h-4 bg-primary animate-blink mx-auto mb-4" />
            <p>LOADING...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const activeMilestones = milestones.filter(m => !m.isDeleted).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Layout>
      <div className="h-full overflow-x-auto">
        <div className="flex h-full min-w-max gap-4">
          {activeMilestones.map(milestone => {
            const milestoneTasks = tasks
              .filter(t => t.milestoneId === milestone.id && !t.isDeleted && !t.isCompleted)
              .sort((a, b) => a.milestoneOrder - b.milestoneOrder);
              
            return (
              <div key={milestone.id} className="w-72 flex flex-col h-full border-2 border-primary/20 bg-card/50">
                <div 
                  className="p-3 border-b-2 border-primary/20 bg-primary/5 flex justify-between items-center cursor-pointer hover:bg-primary/20"
                  onClick={() => setSelectedMilestone(milestone)}
                  data-testid={`card-milestone-${milestone.id}`}
                >
                  <h3 className="font-bold truncate w-full">{milestone.title}</h3>
                  <span className="text-xs opacity-50">[{milestoneTasks.length}]</span>
                </div>

                <div className="flex-1 p-2 overflow-y-auto">
                  <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, milestone.id)}
                  >
                    <SortableContext 
                      items={milestoneTasks.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {milestoneTasks.map(task => (
                        <SortableTaskCard key={task.id} task={task} />
                      ))}
                    </SortableContext>
                  </DndContext>
                  
                  <Button 
                    variant="ghost" 
                    data-testid={`button-add-task-${milestone.id}`}
                    className="w-full border border-dashed border-primary/30 text-primary/50 hover:text-primary hover:border-primary text-xs py-1 h-auto rounded-none mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      createTask.mutate({
                        milestoneId: milestone.id,
                        title: "NEW_TASK",
                        description: "",
                        definitionOfDone: "",
                        milestoneOrder: milestoneTasks.length,
                        globalOrder: tasks.length,
                        isCompleted: false,
                        isDeleted: false,
                      });
                    }}
                  >
                    + ADD TASK
                  </Button>
                </div>
              </div>
            );
          })}

          {activeMilestones.length < 5 && (
            <div 
              className="w-12 h-full flex items-center justify-center border-2 border-dashed border-primary/20 hover:border-primary/50 cursor-pointer transition-colors"
              onClick={() => createMilestone.mutate({
                title: "NEW_MILESTONE",
                description: "",
                definitionOfDone: "",
                displayOrder: activeMilestones.length,
                isDeleted: false,
              })}
              data-testid="button-add-milestone"
            >
              <div className="rotate-90 text-primary/50 font-bold whitespace-nowrap">
                + NEW
              </div>
            </div>
          )}

          {activeMilestones.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center border-2 border-dashed border-primary/20 p-12">
              <div>
                <h2 className="text-xl mb-4">NO MILESTONES CONFIGURED</h2>
                <p className="opacity-70 mb-6">Create your first milestone to start organizing tasks.</p>
                <Button 
                  onClick={() => createMilestone.mutate({
                    title: "MILESTONE_01",
                    description: "",
                    definitionOfDone: "",
                    displayOrder: 0,
                    isDeleted: false,
                  })}
                  className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none"
                  data-testid="button-create-first-milestone"
                >
                  + CREATE FIRST MILESTONE
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedMilestone} onOpenChange={(open) => !open && setSelectedMilestone(null)}>
        <DialogContent className="bg-black border-2 border-primary text-primary font-mono sm:max-w-[600px] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)]">
          <DialogHeader className="bg-primary/20 p-4 border-b border-primary">
            <DialogTitle className="text-xl font-bold uppercase flex items-center gap-2">
              <span className="animate-pulse">█</span> EDIT_MILESTONE: {selectedMilestone?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs opacity-50 block mb-1">TITLE</label>
              <input 
                data-testid="input-milestone-title"
                value={selectedMilestone?.title || ""}
                onChange={(e) => selectedMilestone && updateMilestone.mutate({ 
                  id: selectedMilestone.id, 
                  updates: { title: e.target.value } 
                })}
                className="w-full bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                <textarea 
                  data-testid="input-milestone-description"
                  value={selectedMilestone?.description || ""}
                  onChange={(e) => selectedMilestone && updateMilestone.mutate({ 
                    id: selectedMilestone.id, 
                    updates: { description: e.target.value } 
                  })}
                  className="w-full h-32 bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                <textarea 
                  data-testid="input-milestone-dod"
                  value={selectedMilestone?.definitionOfDone || ""}
                  onChange={(e) => selectedMilestone && updateMilestone.mutate({ 
                    id: selectedMilestone.id, 
                    updates: { definitionOfDone: e.target.value } 
                  })}
                  className="w-full h-32 bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-primary p-4 flex justify-between sm:justify-between bg-black">
            <Button 
              data-testid="button-delete-milestone"
              variant="destructive" 
              onClick={() => { selectedMilestone && deleteMilestone.mutate(selectedMilestone.id); setSelectedMilestone(null); }}
              className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none"
            >
              <Trash2 className="w-4 h-4 mr-2" /> DELETE
            </Button>

            <Button 
              data-testid="button-close"
              variant="outline" 
              onClick={() => setSelectedMilestone(null)}
              className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-mono rounded-none"
            >
              CLOSE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
