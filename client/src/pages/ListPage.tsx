import React, { useState, useEffect } from "react";
import { useTasks, useMilestones, useCreateTask, useUpdateTask, useDeleteTask, useReorderTasks } from "@/hooks/useData";
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
  const { data: milestones = [] } = useMilestones();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const reorderTasks = useReorderTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", milestoneId: "", description: "", definitionOfDone: "" });

  useEffect(() => {
    if (selectedTask) {
      setEditForm({
        title: selectedTask.title,
        milestoneId: selectedTask.milestoneId,
        description: selectedTask.description || "",
        definitionOfDone: selectedTask.definitionOfDone || "",
      });
    }
  }, [selectedTask]);

  const activeTasks = tasks.filter(t => !t.isDeleted && !t.isCompleted).sort((a, b) => a.globalOrder - b.globalOrder);

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
    const defaultMilestone = milestones.find(m => !m.isDeleted);
    if (!defaultMilestone) {
      alert("Please create a milestone first on the Board page.");
      return;
    }
    
    createTask.mutate({
      title: "NEW_TASK",
      milestoneId: defaultMilestone.id,
      description: "",
      definitionOfDone: "",
      milestoneOrder: 0,
      globalOrder: tasks.length,
      isCompleted: false,
      isDeleted: false,
    });
  };

  const handleSaveChanges = () => {
    if (selectedTask) {
      const hasChanges = 
        editForm.title !== selectedTask.title ||
        editForm.milestoneId !== selectedTask.milestoneId ||
        editForm.description !== (selectedTask.description || "") ||
        editForm.definitionOfDone !== (selectedTask.definitionOfDone || "");
      
      if (hasChanges) {
        updateTask.mutate({
          id: selectedTask.id,
          updates: {
            title: editForm.title,
            milestoneId: editForm.milestoneId,
            description: editForm.description,
            definitionOfDone: editForm.definitionOfDone,
          }
        });
      }
    }
    setSelectedTask(null);
  };

  const handleCloseWithoutSaving = () => {
    setSelectedTask(null);
  };

  const handleComplete = () => {
    if (selectedTask) {
      updateTask.mutate({
        id: selectedTask.id,
        updates: { isCompleted: true, completedAt: new Date() }
      });
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
          <h2 className="text-base md:text-xl font-bold border-b-2 border-primary pr-4">
            <span className="hidden sm:inline">// GLOBAL_TASK_QUEUE</span>
            <span className="sm:hidden">// TASK_QUEUE</span>
          </h2>
          <Button 
            onClick={handleAddNew}
            data-testid="button-add-task"
            className="rounded-none bg-primary text-black hover:bg-primary/80 font-mono font-bold text-xs md:text-sm w-full sm:w-auto"
          >
            + ADD_TASK
          </Button>
        </div>

        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={activeTasks.map(t => t.id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <SortableTaskRow 
                  key={task.id} 
                  task={task} 
                  onEdit={(task) => setSelectedTask(task)} 
                />
              ))}
              
              {activeTasks.length === 0 && (
                <div className="text-center border border-dashed border-primary/30 p-6 md:p-8 text-primary/50 text-sm md:text-base">
                  NO TASKS IN QUEUE
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleCloseWithoutSaving()}>
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

              <div>
                <label className="text-xs opacity-50 block mb-1">ASSIGNED MILESTONE</label>
                <select
                  data-testid="select-milestone"
                  value={editForm.milestoneId}
                  onChange={(e) => setEditForm({ ...editForm, milestoneId: e.target.value })}
                  className="w-full bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {milestones.filter(m => !m.isDeleted).map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                  <textarea 
                    data-testid="input-task-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full h-32 bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                  <textarea 
                    data-testid="input-task-dod"
                    value={editForm.definitionOfDone}
                    onChange={(e) => setEditForm({ ...editForm, definitionOfDone: e.target.value })}
                    className="w-full h-32 bg-black border border-primary p-2 text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-primary p-3 md:p-4 flex flex-col gap-3 bg-black shrink-0">
              <Button 
                data-testid="button-save"
                onClick={handleSaveChanges}
                className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none text-xs md:text-sm w-full"
              >
                SAVE
              </Button>
              <div className="flex gap-2">
                <Button 
                  data-testid="button-cancel"
                  variant="outline" 
                  onClick={handleCloseWithoutSaving}
                  className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-mono rounded-none text-xs md:text-sm flex-[2]"
                >
                  CANCEL
                </Button>
                <Button 
                  data-testid="button-complete"
                  onClick={handleComplete}
                  className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none p-2 h-auto flex-1"
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
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
