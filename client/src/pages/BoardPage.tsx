import React, { useState } from "react";
import { useAppStore, Task, Milestone } from "@/lib/store";
import { Layout } from "@/components/Layout";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Components for Board ---

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
  const { milestones, tasks, addMilestone, updateMilestone, deleteMilestone, reorderTasksInMilestone, addTask, updateTask, deleteTask } = useAppStore();
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Sensors
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
       reorderTasksInMilestone(milestoneId, newOrder.map(t => t.id));
    }
  };

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
                {/* Header */}
                <div 
                  className="p-3 border-b-2 border-primary/20 bg-primary/5 flex justify-between items-center cursor-pointer hover:bg-primary/20"
                  onClick={() => setSelectedMilestone(milestone)}
                >
                  <h3 className="font-bold truncate w-full">{milestone.title}</h3>
                  <span className="text-xs opacity-50">[{milestoneTasks.length}]</span>
                </div>

                {/* Content */}
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
                    className="w-full border border-dashed border-primary/30 text-primary/50 hover:text-primary hover:border-primary text-xs py-1 h-auto rounded-none mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      addTask({ milestoneId: milestone.id, title: "NEW_TASK" });
                    }}
                  >
                    + ADD TASK
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add Milestone Column */}
          {activeMilestones.length < 5 && (
            <div className="w-12 h-full flex items-center justify-center border-2 border-dashed border-primary/20 hover:border-primary/50 cursor-pointer transition-colors"
                 onClick={() => addMilestone({ title: "NEW_MILESTONE" })}>
              <div className="rotate-90 text-primary/50 font-bold whitespace-nowrap">
                + ADD MILESTONE
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Milestone Modal */}
      <Dialog open={!!selectedMilestone} onOpenChange={(open) => !open && setSelectedMilestone(null)}>
        <DialogContent className="bg-black border-2 border-primary text-primary font-mono max-w-[90vw] h-[80vh] p-0 gap-0 shadow-[0_0_20px_rgba(0,255,0,0.2)] flex flex-col">
          <DialogHeader className="bg-primary/20 p-4 border-b border-primary shrink-0">
            <DialogTitle className="text-xl font-bold uppercase flex items-center gap-2">
              <span className="animate-pulse">█</span> EDIT_MILESTONE: {selectedMilestone?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Left Col: Meta */}
            <div className="w-1/3 p-6 border-r border-primary space-y-6 overflow-y-auto">
              <div>
                <label className="text-xs opacity-50 block mb-1">TITLE</label>
                <input 
                  value={selectedMilestone?.title || ""}
                  onChange={(e) => selectedMilestone && updateMilestone(selectedMilestone.id, { title: e.target.value })}
                  className="w-full bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
               <div>
                <label className="text-xs opacity-50 block mb-1">DESCRIPTION</label>
                <textarea 
                  value={selectedMilestone?.description || ""}
                  onChange={(e) => selectedMilestone && updateMilestone(selectedMilestone.id, { description: e.target.value })}
                  className="w-full h-32 bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">DEFINITION OF DONE</label>
                <textarea 
                  value={selectedMilestone?.definitionOfDone || ""}
                  onChange={(e) => selectedMilestone && updateMilestone(selectedMilestone.id, { definitionOfDone: e.target.value })}
                  className="w-full h-32 bg-black border border-primary p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {/* Right Col: Tasks */}
            <div className="w-2/3 p-6 bg-secondary/5 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                 <label className="text-xs opacity-50 block">ASSOCIATED TASKS (MAX 10)</label>
                 <Button 
                   size="sm"
                   variant="outline"
                   className="h-6 text-xs rounded-none border-primary text-primary"
                   onClick={() => selectedMilestone && addTask({ milestoneId: selectedMilestone.id, title: "New Task" })}
                   disabled={selectedMilestone ? tasks.filter(t => t.milestoneId === selectedMilestone.id).length >= 10 : true}
                 >
                   + ADD
                 </Button>
              </div>

              {selectedMilestone && (
                 <div className="space-y-2">
                    {tasks
                      .filter(t => t.milestoneId === selectedMilestone.id && !t.isDeleted)
                      .sort((a, b) => a.milestoneOrder - b.milestoneOrder)
                      .map((task) => (
                         <div key={task.id} className="flex items-center gap-2 bg-black border border-primary/30 p-2">
                           <GripVertical className="w-4 h-4 opacity-50 cursor-grab" />
                           <input 
                             value={task.title}
                             onChange={(e) => updateTask(task.id, { title: e.target.value })}
                             className="bg-transparent flex-1 focus:outline-none"
                           />
                           <Button
                             variant="ghost"
                             size="sm"
                             className="h-6 w-6 p-0 hover:text-destructive"
                             onClick={() => deleteTask(task.id)}
                           >
                             <Trash2 className="w-3 h-3" />
                           </Button>
                         </div>
                      ))}
                 </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-primary p-4 shrink-0 flex justify-between sm:justify-between bg-black">
             <Button 
              variant="destructive" 
              onClick={() => { selectedMilestone && deleteMilestone(selectedMilestone.id); setSelectedMilestone(null); }}
              className="bg-transparent border border-destructive text-destructive hover:bg-destructive hover:text-white font-mono rounded-none"
            >
              <Trash2 className="w-4 h-4 mr-2" /> DELETE MILESTONE
            </Button>

            <Button 
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
