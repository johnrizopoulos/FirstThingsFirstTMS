import React, { useState, useEffect, useRef } from "react";
import { useTasks, useActiveMilestones, useCreateTask, useUpdateTask, useDeleteTask, useReorderTasks, useCompleteTask } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import { SortableTaskRow } from "@/components/SortableTaskRow";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Check } from "lucide-react";
import type { Task } from "@shared/schema";

export default function ListPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: activeMilestones = [] } = useActiveMilestones();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const reorderTasks = useReorderTasks();
  const [selectedTask, setSelectedTask] = useState<(Task & { isNew?: boolean }) | null>(null);
  const [editForm, setEditForm] = useState({ title: "", milestoneId: "" as string | undefined, description: "", definitionOfDone: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const dodRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  };

  useEffect(() => {
    if (selectedTask) {
      setEditForm({
        title: selectedTask.title,
        milestoneId: selectedTask.milestoneId || "",
        description: selectedTask.description || "",
        definitionOfDone: selectedTask.definitionOfDone || "",
      });
    }
  }, [selectedTask]);

  const activeTasks = tasks.filter(t => !t.isDeleted && !t.isCompleted).sort((a, b) => a.globalOrder - b.globalOrder);
  
  const filteredTasks = activeTasks.filter(task => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const title = task.title.toLowerCase();
    const description = (task.description || "").toLowerCase();
    const dod = (task.definitionOfDone || "").toLowerCase();
    
    return title.includes(query) || description.includes(query) || dod.includes(query);
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = activeTasks.findIndex((t) => t.id === active.id);
      const newIndex = activeTasks.findIndex((t) => t.id === over?.id);
      
      const newOrder = arrayMove(activeTasks, oldIndex, newIndex);
      reorderTasks.mutate(newOrder.map(t => t.id));
    }
  };

  const handleAddNew = () => {
    const draftTask = {
      id: "draft",
      title: "",
      milestoneId: null,
      description: "",
      definitionOfDone: "",
      milestoneOrder: 0,
      globalOrder: tasks.length,
      isCompleted: false,
      isDeleted: false,
      userId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      deletedAt: null,
      isNew: true,
    } as Task & { isNew: boolean };
    setSelectedTask(draftTask);
    setEditForm({
      title: "",
      milestoneId: undefined,
      description: "",
      definitionOfDone: "",
    });
  };

  const handleSaveChanges = () => {
    if (selectedTask) {
      if (selectedTask.isNew) {
        createTask.mutate(
          {
            title: editForm.title || "NEW_TASK",
            milestoneId: editForm.milestoneId || undefined,
            description: editForm.description,
            definitionOfDone: editForm.definitionOfDone,
            milestoneOrder: 0,
            globalOrder: tasks.length,
            isCompleted: false,
            isDeleted: false,
          },
          {
            onSuccess: () => {
              setSelectedTask(null);
            },
            onError: (error) => {
              console.error("Failed to create task:", error);
            },
          }
        );
      } else {
        const hasChanges = 
          editForm.title !== selectedTask.title ||
          (editForm.milestoneId || "") !== (selectedTask.milestoneId || "") ||
          editForm.description !== (selectedTask.description || "") ||
          editForm.definitionOfDone !== (selectedTask.definitionOfDone || "");
        
        if (hasChanges) {
          updateTask.mutate(
            {
              id: selectedTask.id,
              updates: {
                title: editForm.title,
                milestoneId: editForm.milestoneId,
                description: editForm.description,
                definitionOfDone: editForm.definitionOfDone,
              }
            },
            {
              onSuccess: () => {
                setSelectedTask(null);
              },
              onError: (error) => {
                console.error("Failed to update task:", error);
              },
            }
          );
        } else {
          setSelectedTask(null);
        }
      }
    }
  }
  

  const handleCloseWithoutSaving = () => {
    setSelectedTask(null);
  };

  const handleComplete = () => {
    if (selectedTask) {
      completeTask.mutate(selectedTask.id);
      setSelectedTask(null);
    }
  };

  const handleDelete = () => {
    if (selectedTask) {
      deleteTask.mutate(selectedTask.id);
      setSelectedTask(null);
    }
  };

  if (isLoading) {
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

  const mobileSearchContent = (
    <input
      type="text"
      placeholder="SEARCH..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      data-testid="input-search-tasks"
      className="w-full bg-input border border-primary p-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-foreground/50 font-mono"
    />
  );

  return (
    <Layout mobileHeaderContent={mobileSearchContent}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
          <h2 className="text-base md:text-xl font-bold border-b-2 border-primary pr-4">
            <span className="hidden sm:inline">// LIST_VIEW</span>
            <span className="sm:hidden">// TASK_QUEUE</span>
          </h2>
          <Button 
            onClick={handleAddNew}
            data-testid="button-add-task"
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/80 font-mono font-bold text-xs md:text-sm w-full sm:w-auto"
          >
            + ADD_TASK
          </Button>
        </div>

        <div className="mb-4 hidden sm:block">
          <input
            type="text"
            placeholder="SEARCH_TASKS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-tasks-desktop"
            className="w-full bg-input border border-primary p-2 text-sm md:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-foreground/50 font-mono"
          />
          {searchQuery && (
            <div className="text-xs opacity-50 mt-1">
              SHOWING {filteredTasks.length} OF {activeTasks.length} TASKS
            </div>
          )}
        </div>

        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={filteredTasks.map(t => t.id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const originalIndex = activeTasks.findIndex(t => t.id === task.id);
                return (
                  <SortableTaskRow 
                    key={task.id} 
                    task={task} 
                    index={originalIndex}
                    onEdit={(task) => setSelectedTask(task)} 
                  />
                );
              })}
              
              {filteredTasks.length === 0 && activeTasks.length > 0 && (
                <div className="text-center border border-dashed border-primary/30 p-6 md:p-8 text-primary/50 text-sm md:text-base">
                  NO MATCHING TASKS
                </div>
              )}
              
              {activeTasks.length === 0 && (
                <div className="text-center border border-dashed border-primary/30 p-6 md:p-8 text-primary/50 text-sm md:text-base">
                  NO TASKS IN QUEUE
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleCloseWithoutSaving()}>
          <DialogContent className="bg-background border-2 border-primary text-foreground font-mono max-w-[95vw] sm:max-w-[600px] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)] max-h-[90vh] flex flex-col" aria-describedby={undefined}>
            <DialogHeader className="bg-primary/20 p-3 md:p-4 border-b border-primary shrink-0">
              <DialogTitle className="text-base md:text-xl font-bold uppercase flex items-center gap-2">
                <span className="animate-pulse">█</span> 
                <span className="truncate">{selectedTask?.isNew ? "NEW_TASK" : `EDIT_TASK: ${selectedTask?.title}`}</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs opacity-50 block mb-1">TITLE</label>
                <input 
                  data-testid="input-task-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-input border border-primary p-2 text-sm md:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs opacity-50 block mb-1">ASSIGNED MILESTONE</label>
                <select
                  data-testid="select-milestone"
                  value={editForm.milestoneId || ""}
                  onChange={(e) => setEditForm({ ...editForm, milestoneId: e.target.value || undefined })}
                  className="w-full bg-input border border-primary p-2 text-sm md:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- NONE --</option>
                  {activeMilestones.length === 0 ? (
                    <option disabled>NO_ACTIVE_MILESTONES</option>
                  ) : (
                    activeMilestones.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))
                  )}
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                  <textarea 
                    ref={descriptionRef}
                    data-testid="input-task-description"
                    value={editForm.description}
                    maxLength={2000}
                    onChange={(e) => {
                      setEditForm({ ...editForm, description: e.target.value });
                      adjustTextareaHeight(descriptionRef.current);
                    }}
                    className="w-full min-h-24 bg-input border border-primary p-2 text-sm md:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
                  />
                  <div className="text-xs opacity-50 text-right mt-1">{editForm.description.length} / 2000</div>
                </div>
                <div>
                  <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                  <textarea 
                    ref={dodRef}
                    data-testid="input-task-dod"
                    value={editForm.definitionOfDone}
                    maxLength={2000}
                    onChange={(e) => {
                      setEditForm({ ...editForm, definitionOfDone: e.target.value });
                      adjustTextareaHeight(dodRef.current);
                    }}
                    className="w-full min-h-24 bg-input border border-primary p-2 text-sm md:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
                  />
                  <div className="text-xs opacity-50 text-right mt-1">{editForm.definitionOfDone.length} / 2000</div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-primary p-3 md:p-4 flex flex-col gap-3 bg-background shrink-0">
              <Button 
                data-testid="button-save"
                onClick={handleSaveChanges}
                className="bg-primary text-primary-foreground hover:bg-primary/80 font-mono rounded-none text-xs md:text-sm w-full"
              >
                SAVE
              </Button>
              <div className="flex gap-2">
                <Button 
                  data-testid="button-cancel"
                  variant="outline" 
                  onClick={handleCloseWithoutSaving}
                  className={`bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground font-mono rounded-none text-xs md:text-sm ${selectedTask?.isNew ? "flex-1" : "flex-[2]"}`}
                >
                  CANCEL
                </Button>
                {!selectedTask?.isNew && (
                  <>
                    <Button 
                      data-testid="button-complete"
                      onClick={handleComplete}
                      className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground font-mono rounded-none p-2 h-auto flex-1"
                      title="Mark as complete"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button 
                      data-testid="button-delete"
                      variant="destructive" 
                      onClick={handleDelete}
                      className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none p-2 h-auto flex-1"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
