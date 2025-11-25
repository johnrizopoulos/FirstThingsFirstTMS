import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import type { Task } from "@shared/schema";

interface SortableTaskRowProps {
  task: Task;
  onEdit: (task: Task) => void;
  index: number;
}

export function SortableTaskRow({ task, onEdit, index }: SortableTaskRowProps) {
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
      onClick={() => !isDragging && onEdit(task)}
      className={cn(
        "border border-primary/30 p-3 mb-2 flex items-center gap-3 bg-card hover:bg-secondary/50 select-none group cursor-pointer",
        isDragging && "opacity-50 border-dashed border-primary bg-black"
      )}
      data-testid={`card-task-${task.id}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex items-center justify-center flex-shrink-0 p-2 -m-2 touch-none"
        data-testid="button-drag-handle"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-5 h-5 text-primary/50 hover:text-primary" />
      </div>
      
      <div className="font-bold text-primary/50 w-8 text-right flex-shrink-0">
        #{index + 1}
      </div>
      
      <div 
        className="flex-1 font-mono uppercase truncate"
        data-testid={`button-edit-task-${task.id}`}
      >
        {task.title}
      </div>
    </div>
  );
}
