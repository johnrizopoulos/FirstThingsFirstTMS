import React, { useState } from "react";
import { useAppStore, Task } from "@/lib/store";
import { Layout } from "@/components/Layout";
import { SortableTaskRow } from "@/components/SortableTaskRow";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, CheckSquare } from "lucide-react";
import { nanoid } from "nanoid";

export default function ListPage() {
  const { tasks, updateTask, deleteTask, reorderGlobalTasks, addTask, milestones } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Only show active tasks
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
      reorderGlobalTasks(newOrder.map(t => t.id));
    }
  };

  const handleAddNew = () => {
    // Add to first milestone by default if available
    const defaultMilestone = milestones[0]?.id;
    if (!defaultMilestone) {
      alert("Please create a milestone first on the Board page.");
      return;
    }
    
    const newTaskId = nanoid();
    const newTask = { 
      id: newTaskId,
      title: "NEW_TASK", 
      milestoneId: defaultMilestone 
    };

    addTask(newTask);
    
    // Immediately open the modal for the new task
    // We need to construct a partial task object that matches what the store would create
    // or at least enough for the modal to render.
    // However, the store update is async.
    // But since we know the ID, we can set selectedTask to a local optimistic object 
    // or wait for the store. 
    // Since addTask is synchronous in updating the state updater, but React batching applies.
    // We can manually construct the object for the modal.
    
    const fullTask: Task = {
      id: newTaskId,
      milestoneId: defaultMilestone,
      title: "NEW_TASK",
      description: "",
      definitionOfDone: "",
      milestoneOrder: tasks.filter(t => t.milestoneId === defaultMilestone).length,
      globalOrder: tasks.length,
      isCompleted: false,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };

    setSelectedTask(fullTask);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold border-b-2 border-primary pr-4">
            // GLOBAL_TASK_QUEUE
          </h2>
          <Button 
            onClick={handleAddNew}
            className="rounded-none bg-primary text-black hover:bg-primary/80 font-mono font-bold"
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
                  onEdit={setSelectedTask} 
                />
              ))}
              
              {activeTasks.length === 0 && (
                <div className="text-center border border-dashed border-primary/30 p-8 text-primary/50">
                  NO TASKS IN QUEUE
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Reuse Task Modal - (Ideally refactor this to a shared component) */}
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

               {/* Milestone Selector */}
               <div>
                <label className="text-xs opacity-50 block mb-1">ASSIGNED MILESTONE</label>
                <select
                  value={selectedTask?.milestoneId || ""}
                  onChange={(e) => selectedTask && updateTask(selectedTask.id, { milestoneId: e.target.value })}
                  className="w-full bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {milestones.filter(m => !m.isDeleted).map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
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
                onClick={() => { selectedTask && deleteTask(selectedTask.id); setSelectedTask(null); }}
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
                  onClick={() => { selectedTask && updateTask(selectedTask.id, { isCompleted: true, completedAt: new Date().toISOString() }); setSelectedTask(null); }}
                  className="bg-primary text-black hover:bg-primary/80 font-mono rounded-none"
                >
                  <CheckSquare className="w-4 h-4 mr-2" /> COMPLETE
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
