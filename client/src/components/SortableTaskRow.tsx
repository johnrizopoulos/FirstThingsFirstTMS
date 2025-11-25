import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Task } from "@/lib/store";

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
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      className={cn(
        "border border-primary/30 p-3 mb-2 flex items-center gap-4 bg-card hover:bg-secondary/50 cursor-pointer select-none group active:cursor-grabbing",
        isDragging && "opacity-50 border-dashed border-primary bg-black",
        task.isCompleted && "opacity-50"
      )}
    >
      <div className="font-bold text-primary/50 w-8 text-right">
        #{task.globalOrder + 1}
      </div>
      <div className={cn(
        "flex-1 font-mono uppercase truncate",
        task.isCompleted && "line-through text-primary/50"
      )}>
        {task.title}
      </div>
      <div className="text-xs border border-primary/20 px-2 py-1 rounded text-primary/70 group-hover:border-primary/50">
        ::OPEN
      </div>
    </div>
  );
}
