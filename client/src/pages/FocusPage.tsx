import React, { useState, useEffect } from "react";
import { useTasks, useUpdateTask, useDeleteTask } from "@/hooks/useData";
import { Layout } from "@/components/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Trash2, X } from "lucide-react";
import type { Task } from "@shared/schema";

export default function FocusPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", definitionOfDone: "" });

  useEffect(() => {
    if (selectedTask) {
      setEditForm({
        title: selectedTask.title,
        description: selectedTask.description || "",
        definitionOfDone: selectedTask.definitionOfDone || "",
      });
    }
  }, [selectedTask]);

  const activeTasks = tasks.filter(t => !t.isCompleted && !t.isDeleted);
  const topTask = activeTasks.sort((a, b) => a.globalOrder - b.globalOrder)[0];

  const handleSaveChanges = () => {
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

  if (!topTask) {
    return (
      <Layout>
        <div className="h-full flex flex-col items-center justify-center text-center border-2 border-primary/20 border-dashed p-6 md:p-12">
          <h2 className="text-xl md:text-2xl mb-4">ALL SYSTEMS CLEAR</h2>
          <p className="opacity-70 text-sm md:text-base">No pending tasks in queue.</p>
          <p className="mt-4 text-xs md:text-sm animate-pulse">WAITING FOR INPUT...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto px-2">
        <div className="w-full mb-4 md:mb-8 text-center">
          <h2 className="text-primary/50 text-sm md:text-lg mb-2">
            <span className="hidden sm:inline">:: CURRENT PRIORITY TARGET ::</span>
            <span className="sm:hidden">:: PRIORITY ::</span>
          </h2>
        </div>

        <div 
          onClick={() => setSelectedTask(topTask)}
          className="w-full border-2 md:border-4 border-primary bg-card p-4 md:p-8 lg:p-12 cursor-pointer hover:bg-secondary/30 transition-colors relative group"
          data-testid="card-task-focus"
        >
          <div className="absolute top-0 left-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-l-2 md:border-t-4 md:border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 md:border-t-4 md:border-r-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-l-2 md:border-b-4 md:border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-r-2 md:border-b-4 md:border-r-4 border-primary" />

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold mb-4 md:mb-8 uppercase break-words" data-testid="text-task-title">
            {topTask.title}
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 text-sm md:text-base lg:text-lg opacity-80">
            <div>
              <span className="block text-xs opacity-50 mb-1">DESCRIPTION</span>
              <span data-testid="text-task-description">{topTask.description || "No description provided."}</span>
            </div>
            <div>
              <span className="block text-xs opacity-50 mb-1">DEFINITION OF DONE</span>
              <span data-testid="text-task-dod">{topTask.definitionOfDone || "No criteria specified."}</span>
            </div>
          </div>
          
          <div className="hidden md:block absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-primary text-black px-2 py-1">
            CLICK TO EDIT
          </div>
        </div>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleCloseWithoutSaving()}>
        <DialogContent className="bg-black border-2 border-primary text-primary font-mono max-w-[95vw] sm:max-w-[600px] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)] max-h-[90vh] flex flex-col">
          <DialogHeader className="bg-primary/20 p-3 md:p-4 border-b border-primary shrink-0 flex justify-between items-center">
            <DialogTitle className="text-base md:text-xl font-bold uppercase flex items-center gap-2">
              <span className="animate-pulse">█</span> 
              <span className="truncate">EDIT_TASK: {selectedTask?.title}</span>
            </DialogTitle>
            <button
              onClick={handleCloseWithoutSaving}
              className="p-1 hover:bg-primary/30 rounded transition-colors flex-shrink-0"
              data-testid="button-close-modal"
            >
              <X className="w-5 h-5" />
            </button>
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
            <div className="flex gap-2 flex-wrap">
              <Button 
                data-testid="button-save"
                onClick={handleSaveChanges}
                className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none text-xs md:text-sm flex-1 sm:flex-none"
              >
                SAVE
              </Button>
              <Button 
                data-testid="button-cancel"
                variant="outline" 
                onClick={handleCloseWithoutSaving}
                className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-mono rounded-none text-xs md:text-sm flex-1 sm:flex-none"
              >
                CANCEL
              </Button>
              <Button 
                data-testid="button-complete"
                onClick={handleComplete}
                className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none p-2 h-auto flex-shrink-0"
                title="Mark as complete"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button 
                data-testid="button-delete"
                variant="destructive" 
                onClick={handleDelete}
                className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none p-2 h-auto flex-shrink-0"
                title="Delete task"
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
