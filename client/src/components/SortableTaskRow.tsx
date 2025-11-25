import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import type { Task } from "@shared/schema";

interface SortableTaskRowProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export function SortableTaskRow({ task, onEdit }: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    position: isDragging ? "relative" : "static",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border border-primary/30 p-3 mb-2 flex items-center gap-3 bg-card hover:bg-secondary/50 select-none group",
        isDragging && "opacity-50 border-dashed border-primary bg-black"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex items-center justify-center flex-shrink-0"
        data-testid="button-drag-handle"
      >
        <GripVertical className="w-4 h-4 text-primary/50 hover:text-primary" />
      </div>
      
      <div className="font-bold text-primary/50 w-8 text-right flex-shrink-0">
        #{task.globalOrder + 1}
      </div>
      
      <div 
        onClick={() => onEdit(task)}
        className="flex-1 font-mono uppercase truncate cursor-pointer hover:text-primary/70"
        data-testid={`button-edit-task-${task.id}`}
      >
        {task.title}
      </div>
      
      <div 
        onClick={() => onEdit(task)}
        className="text-xs border border-primary/20 px-2 py-1 rounded text-primary/70 group-hover:border-primary/50 cursor-pointer hover:border-primary flex-shrink-0"
        data-testid="button-open-task"
      >
        ::OPEN
      </div>
    </div>
  );
}
