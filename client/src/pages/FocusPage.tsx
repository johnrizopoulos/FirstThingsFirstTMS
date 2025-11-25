import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Layout } from "@/components/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { Task } from "@/lib/store";

export default function FocusPage() {
  const { tasks, updateTask, deleteTask } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Get highest priority active task (lowest globalOrder)
  const activeTasks = tasks.filter(t => !t.isCompleted && !t.isDeleted);
  const topTask = activeTasks.sort((a, b) => a.globalOrder - b.globalOrder)[0];

  const handleComplete = () => {
    if (selectedTask) {
      updateTask(selectedTask.id, { 
        isCompleted: true, 
        completedAt: new Date().toISOString() 
      });
      setSelectedTask(null);
    }
  };

  const handleDelete = () => {
    if (selectedTask) {
      deleteTask(selectedTask.id);
      setSelectedTask(null);
    }
  };

  if (!topTask) {
     return (
      <Layout>
        <div className="h-full flex flex-col items-center justify-center text-center border-2 border-primary/20 border-dashed p-12">
          <h2 className="text-2xl mb-4">ALL SYSTEMS CLEAR</h2>
          <p className="opacity-70">No pending tasks in queue.</p>
          <p className="mt-4 text-sm animate-pulse">WAITING FOR INPUT...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto">
        <div className="w-full mb-8 text-center">
          <h2 className="text-primary/50 text-lg mb-2">:: CURRENT PRIORITY TARGET ::</h2>
        </div>

        <div 
          onClick={() => setSelectedTask(topTask)}
          className="w-full border-4 border-primary bg-card p-6 md:p-12 cursor-pointer hover:bg-secondary/30 transition-colors relative group"
        >
          {/* Corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />

          <h1 className="text-4xl md:text-6xl font-bold mb-8 uppercase break-words">
            {topTask.title}
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-lg opacity-80">
            <div>
              <span className="block text-xs opacity-50 mb-1">DESCRIPTION</span>
              {topTask.description || "No description provided."}
            </div>
            <div>
              <span className="block text-xs opacity-50 mb-1">DEFINITION OF DONE</span>
              {topTask.definitionOfDone || "No criteria specified."}
            </div>
          </div>
          
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-primary text-black px-2 py-1">
            CLICK TO EDIT
          </div>
        </div>
      </div>

      {/* Task Modal */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="bg-black border-2 border-primary text-primary font-mono sm:max-w-[600px] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)]">
          <DialogHeader className="bg-primary/20 p-4 border-b border-primary">
            <DialogTitle className="text-xl font-bold uppercase flex items-center gap-2">
              <span className="animate-pulse">█</span> EDIT_TASK: {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs opacity-50 block mb-1">TITLE</label>
              <input 
                value={selectedTask?.title || ""}
                onChange={(e) => selectedTask && updateTask(selectedTask.id, { title: e.target.value })}
                className="w-full bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                <textarea 
                  value={selectedTask?.description || ""}
                  onChange={(e) => selectedTask && updateTask(selectedTask.id, { description: e.target.value })}
                  className="w-full h-32 bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                <textarea 
                  value={selectedTask?.definitionOfDone || ""}
                  onChange={(e) => selectedTask && updateTask(selectedTask.id, { definitionOfDone: e.target.value })}
                  className="w-full h-32 bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-primary p-4 flex justify-between sm:justify-between bg-black">
             <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none"
            >
              <Trash2 className="w-4 h-4 mr-2" /> DELETE
            </Button>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSelectedTask(null)}
                className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-black font-mono rounded-none"
              >
                CANCEL
              </Button>
              <Button 
                onClick={handleComplete}
                className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none"
              >
                <CheckSquare className="w-4 h-4 mr-2" /> COMPLETE TASK
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
