import React, { useState, useEffect, useRef } from "react";
import { useTasks, useMilestones, useCreateTask, useCreateMilestone, useUpdateMilestone, useDeleteMilestone, useReorderTasks, useUpdateTask, useDeleteTask, useCompleteTask, useCompleteMilestone } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, Milestone } from "@shared/schema";

function SortableTaskCard({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  } as React.CSSProperties;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartRef.current && !isDragging) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If movement is minimal, treat as click
      if (distance < 8) {
        onSelect(task);
      }
    }
    pointerStartRef.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        handlePointerDown(e);
        listeners?.onPointerDown?.(e as any);
      }}
      onPointerUp={handlePointerUp}
      data-testid={`card-task-${task.id}`}
      className={cn(
        "bg-black border border-primary/50 p-2 mb-2 text-xs cursor-grab active:cursor-grabbing hover:border-primary hover:bg-secondary/20 transition-colors",
        isDragging && "opacity-50 bg-secondary border-dashed",
        task.isCompleted && "opacity-50 line-through"
      )}
    >
      <div className="font-bold mb-1 truncate font-mono uppercase">{task.title}</div>
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
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const completeMilestone = useCompleteMilestone();
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", definitionOfDone: "" });
  const [milestoneForm, setMilestoneForm] = useState({ title: "", description: "", definitionOfDone: "" });
  const taskDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const taskDodRef = useRef<HTMLTextAreaElement>(null);
  const milestoneDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const milestoneDodRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (selectedMilestone) {
      setMilestoneForm({
        title: selectedMilestone.title,
        description: selectedMilestone.description || "",
        definitionOfDone: selectedMilestone.definitionOfDone || "",
      });
    }
  }, [selectedMilestone]);

  useEffect(() => {
    if (selectedTask) {
      setEditForm({
        title: selectedTask.title,
        description: selectedTask.description || "",
        definitionOfDone: selectedTask.definitionOfDone || "",
      });
    }
  }, [selectedTask]);

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

  const handleSaveMilestoneChanges = () => {
    if (selectedMilestone) {
      const hasChanges = 
        milestoneForm.title !== selectedMilestone.title ||
        milestoneForm.description !== (selectedMilestone.description || "") ||
        milestoneForm.definitionOfDone !== (selectedMilestone.definitionOfDone || "");
      
      if (hasChanges) {
        updateMilestone.mutate({
          id: selectedMilestone.id,
          updates: {
            title: milestoneForm.title,
            description: milestoneForm.description,
            definitionOfDone: milestoneForm.definitionOfDone,
          }
        });
      }
    }
    setSelectedMilestone(null);
  };

  const handleCloseMilestoneWithoutSaving = () => {
    setSelectedMilestone(null);
  };

  const handleSaveTaskChanges = () => {
    if (selectedTask) {
      const hasChanges = 
        editForm.title !== selectedTask.title ||
        editForm.description !== (selectedTask.description || "") ||
        editForm.definitionOfDone !== (selectedTask.definitionOfDone || "");
      
      if (hasChanges) {
        updateTask.mutate({
          id: selectedTask.id,
          updates: {
            title: editForm.title,
            description: editForm.description,
            definitionOfDone: editForm.definitionOfDone,
          }
        });
      }
    }
    setSelectedTask(null);
  };

  const handleCloseTaskWithoutSaving = () => {
    setSelectedTask(null);
  };

  const handleCompleteTask = () => {
    if (selectedTask) {
      completeTask.mutate(selectedTask.id);
      setSelectedTask(null);
    }
  };

  const handleCompleteMilestone = () => {
    if (selectedMilestone) {
      completeMilestone.mutate(selectedMilestone.id);
      setSelectedMilestone(null);
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) {
      deleteTask.mutate(selectedTask.id);
      setSelectedTask(null);
    }
  };

  const handleDeleteMilestone = () => {
    if (selectedMilestone) {
      deleteMilestone.mutate(selectedMilestone.id);
      setSelectedMilestone(null);
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
      <div className="h-full overflow-x-auto pb-4">
        <div className="flex h-full min-w-max gap-3 md:gap-4">
          {activeMilestones.map(milestone => {
            const milestoneTasks = tasks
              .filter(t => t.milestoneId === milestone.id && !t.isDeleted && !t.isCompleted)
              .sort((a, b) => a.milestoneOrder - b.milestoneOrder);
              
            return (
              <div key={milestone.id} className="w-64 md:w-72 flex flex-col h-full border-2 border-primary/20 bg-card/50">
                <div 
                  className="p-2 md:p-3 border-b-2 border-primary/20 bg-primary/5 flex justify-between items-center cursor-pointer hover:bg-primary/20"
                  onClick={() => setSelectedMilestone(milestone)}
                  data-testid={`card-milestone-${milestone.id}`}
                >
                  <h3 className="font-bold truncate w-full text-sm md:text-base font-mono uppercase">{milestone.title}</h3>
                  <span className="text-xs opacity-50 shrink-0 ml-2">[{milestoneTasks.length}]</span>
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
                        <SortableTaskCard key={task.id} task={task} onSelect={setSelectedTask} />
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
                    + ADD
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
              <div className="rotate-90 text-primary/50 font-bold whitespace-nowrap text-xs md:text-sm">
                + NEW
              </div>
            </div>
          )}

          {activeMilestones.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center border-2 border-dashed border-primary/20 p-6 md:p-12 mx-4">
              <div>
                <h2 className="text-lg md:text-xl mb-3 md:mb-4">NO MILESTONES</h2>
                <p className="opacity-70 mb-4 md:mb-6 text-sm md:text-base">Create your first milestone to start organizing tasks.</p>
                <Button 
                  onClick={() => createMilestone.mutate({
                    title: "MILESTONE_01",
                    description: "",
                    definitionOfDone: "",
                    displayOrder: 0,
                    isDeleted: false,
                  })}
                  className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none text-xs md:text-sm"
                  data-testid="button-create-first-milestone"
                >
                  + CREATE
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Edit Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleCloseTaskWithoutSaving()}>
        <DialogContent className="bg-black border-2 border-primary text-primary font-mono max-w-[95vw] sm:max-w-[600px] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)] max-h-[90vh] flex flex-col">
          <DialogHeader className="bg-primary/20 p-3 md:p-4 border-b border-primary shrink-0">
            <DialogTitle className="text-base md:text-xl font-bold uppercase flex items-center gap-2">
              <span className="animate-pulse">█</span>
              <span className="truncate">EDIT_TASK: {selectedTask?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="text-xs opacity-50 block mb-1">TITLE</label>
              <input 
                data-testid="input-task-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                <textarea 
                  ref={taskDescriptionRef}
                  data-testid="input-task-description"
                  value={editForm.description}
                  maxLength={2000}
                  onChange={(e) => {
                    setEditForm({ ...editForm, description: e.target.value });
                    adjustTextareaHeight(taskDescriptionRef.current);
                  }}
                  className="w-full min-h-24 bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
                />
                <div className="text-xs opacity-50 text-right mt-1">{editForm.description.length} / 2000</div>
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                <textarea 
                  ref={taskDodRef}
                  data-testid="input-task-dod"
                  value={editForm.definitionOfDone}
                  maxLength={2000}
                  onChange={(e) => {
                    setEditForm({ ...editForm, definitionOfDone: e.target.value });
                    adjustTextareaHeight(taskDodRef.current);
                  }}
                  className="w-full min-h-24 bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
                />
                <div className="text-xs opacity-50 text-right mt-1">{editForm.definitionOfDone.length} / 2000</div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-primary p-3 md:p-4 flex flex-col gap-3 bg-black shrink-0">
            <Button 
              data-testid="button-save-task"
              onClick={handleSaveTaskChanges}
              className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none text-xs md:text-sm w-full"
            >
              SAVE
            </Button>
            <div className="flex gap-2">
              <Button 
                data-testid="button-cancel-task"
                variant="outline" 
                onClick={handleCloseTaskWithoutSaving}
                className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-mono rounded-none text-xs md:text-sm flex-[2]"
              >
                CANCEL
              </Button>
              <Button 
                data-testid="button-complete-task"
                onClick={handleCompleteTask}
                className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none p-2 h-auto flex-1"
                title="Mark as complete"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                data-testid="button-delete-task"
                variant="destructive" 
                onClick={handleDeleteTask}
                className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none p-2 h-auto flex-1"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone Edit Dialog */}
      <Dialog open={!!selectedMilestone} onOpenChange={(open) => !open && handleCloseMilestoneWithoutSaving()}>
        <DialogContent className="bg-black border-2 border-primary text-primary font-mono max-w-[95vw] sm:max-w-[600px] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)] max-h-[90vh] flex flex-col">
          <DialogHeader className="bg-primary/20 p-3 md:p-4 border-b border-primary shrink-0">
            <DialogTitle className="text-base md:text-xl font-bold uppercase flex items-center gap-2">
              <span className="animate-pulse">█</span>
              <span className="truncate">EDIT_MILESTONE: {selectedMilestone?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="text-xs opacity-50 block mb-1">TITLE</label>
              <input 
                data-testid="input-milestone-title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                className="w-full bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                <textarea 
                  ref={milestoneDescriptionRef}
                  data-testid="input-milestone-description"
                  value={milestoneForm.description}
                  maxLength={2000}
                  onChange={(e) => {
                    setMilestoneForm({ ...milestoneForm, description: e.target.value });
                    adjustTextareaHeight(milestoneDescriptionRef.current);
                  }}
                  className="w-full min-h-24 bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
                />
                <div className="text-xs opacity-50 text-right mt-1">{milestoneForm.description.length} / 2000</div>
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                <textarea 
                  ref={milestoneDodRef}
                  data-testid="input-milestone-dod"
                  value={milestoneForm.definitionOfDone}
                  maxLength={2000}
                  onChange={(e) => {
                    setMilestoneForm({ ...milestoneForm, definitionOfDone: e.target.value });
                    adjustTextareaHeight(milestoneDodRef.current);
                  }}
                  className="w-full min-h-24 bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
                />
                <div className="text-xs opacity-50 text-right mt-1">{milestoneForm.definitionOfDone.length} / 2000</div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-primary p-3 md:p-4 flex flex-col gap-3 bg-black shrink-0">
            <Button 
              data-testid="button-save-milestone"
              onClick={handleSaveMilestoneChanges}
              className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none text-xs md:text-sm w-full"
            >
              SAVE
            </Button>
            <div className="flex gap-2">
              <Button 
                data-testid="button-close-milestone"
                variant="outline" 
                onClick={handleCloseMilestoneWithoutSaving}
                className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-mono rounded-none text-xs md:text-sm flex-[2]"
              >
                CANCEL
              </Button>
              <Button 
                data-testid="button-complete-milestone"
                onClick={handleCompleteMilestone}
                className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none p-2 h-auto flex-1"
                title="Mark as complete"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                data-testid="button-delete-milestone"
                variant="destructive" 
                onClick={handleDeleteMilestone}
                className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none p-2 h-auto flex-1"
                title="Delete milestone"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
