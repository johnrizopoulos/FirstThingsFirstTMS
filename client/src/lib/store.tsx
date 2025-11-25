import React, { createContext, useContext, useState, useEffect } from "react";
import { nanoid } from "nanoid";

// --- Types ---

export interface Task {
  id: string;
  milestoneId: string;
  title: string;
  description: string;
  definitionOfDone: string;
  milestoneOrder: number;
  globalOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  definitionOfDone: string;
  displayOrder: number;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

interface AppState {
  tasks: Task[];
  milestones: Milestone[];
  
  // Actions
  addTask: (task: Partial<Task> & { milestoneId: string }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  reorderTasksInMilestone: (milestoneId: string, taskIds: string[]) => void;
  reorderGlobalTasks: (taskIds: string[]) => void;

  addMilestone: (milestone: Partial<Milestone>) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  restoreMilestone: (id: string) => void;
  
  cleanupTrash: () => void;
}

// --- Mock Data ---
const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "m1",
    title: "Q1 OBJECTIVES",
    description: "Primary goals for the first quarter.",
    definitionOfDone: "All tasks verified by manager.",
    displayOrder: 0,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "m2",
    title: "INFRASTRUCTURE",
    description: "Server and database maintenance.",
    definitionOfDone: "Uptime 99.9%",
    displayOrder: 1,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_TASKS: Task[] = [
  {
    id: "t1",
    milestoneId: "m1",
    title: "Deploy Production Build",
    description: "Push the latest commit to main branch.",
    definitionOfDone: "CI/CD pipeline green.",
    milestoneOrder: 0,
    globalOrder: 0,
    isCompleted: false,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "t2",
    milestoneId: "m1",
    title: "Update Documentation",
    description: "Reflect API changes in the wiki.",
    definitionOfDone: "Peer reviewed.",
    milestoneOrder: 1,
    globalOrder: 2,
    isCompleted: false,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "t3",
    milestoneId: "m2",
    title: "Database Migration",
    description: "Migrate users table to new schema.",
    definitionOfDone: "No data loss.",
    milestoneOrder: 0,
    globalOrder: 1,
    isCompleted: false,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  },
];

// --- Store Implementation ---

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);

  // Sort tasks initially by global order
  useEffect(() => {
    setTasks(prev => [...prev].sort((a, b) => a.globalOrder - b.globalOrder));
  }, []);

  const addTask = (newTask: Partial<Task> & { milestoneId: string }) => {
    const task: Task = {
      id: nanoid(),
      title: "New Task",
      description: "",
      definitionOfDone: "",
      milestoneOrder: tasks.filter(t => t.milestoneId === newTask.milestoneId).length,
      globalOrder: tasks.length,
      isCompleted: false,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      ...newTask,
    };
    setTasks(prev => [...prev, task]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    const now = new Date().toISOString();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isDeleted: true, deletedAt: now } : t));
  };
  
  const restoreTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isDeleted: false, deletedAt: null } : t));
  };

  const reorderTasksInMilestone = (milestoneId: string, taskIds: string[]) => {
    setTasks(prev => {
      const otherTasks = prev.filter(t => t.milestoneId !== milestoneId);
      const milestoneTasks = prev.filter(t => t.milestoneId === milestoneId);
      
      // Reorder based on incoming IDs
      const reordered = taskIds.map((id, index) => {
        const task = milestoneTasks.find(t => t.id === id);
        return task ? { ...task, milestoneOrder: index } : null;
      }).filter(Boolean) as Task[];
      
      return [...otherTasks, ...reordered];
    });
  };

  const reorderGlobalTasks = (taskIds: string[]) => {
    setTasks(prev => {
       const reordered = taskIds.map((id, index) => {
        const task = prev.find(t => t.id === id);
        return task ? { ...task, globalOrder: index } : null;
      }).filter(Boolean) as Task[];
      
      // Keep any tasks not in the reorder list (though ideally all should be)
      const others = prev.filter(t => !taskIds.includes(t.id));
      
      return [...reordered, ...others];
    });
  };

  const addMilestone = (newMilestone: Partial<Milestone>) => {
    if (milestones.filter(m => !m.isDeleted).length >= 5) {
      alert("Max 5 active milestones allowed.");
      return;
    }
    const milestone: Milestone = {
      id: nanoid(),
      title: "NEW MILESTONE",
      description: "",
      definitionOfDone: "",
      displayOrder: milestones.length,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      ...newMilestone,
    };
    setMilestones(prev => [...prev, milestone]);
  };

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteMilestone = (id: string) => {
    const now = new Date().toISOString();
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, isDeleted: true, deletedAt: now } : m));
    // Also delete associated tasks? PRD says "Users have many child milestones. Milestones have many child tasks."
    // Usually soft deleting a parent should soft delete children or hide them. 
    // For simplicity, we'll just mark milestone as deleted. Tasks won't show if milestone is hidden.
  };

  const restoreMilestone = (id: string) => {
     setMilestones(prev => prev.map(m => m.id === id ? { ...m, isDeleted: false, deletedAt: null } : m));
  };

  const cleanupTrash = () => {
     // Remove items older than 30 days
     const thirtyDaysAgo = new Date();
     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
     
     setTasks(prev => prev.filter(t => !t.isDeleted || (t.deletedAt && new Date(t.deletedAt) > thirtyDaysAgo)));
     setMilestones(prev => prev.filter(m => !m.isDeleted || (m.deletedAt && new Date(m.deletedAt) > thirtyDaysAgo)));
  };

  return (
    <AppContext.Provider value={{
      tasks,
      milestones,
      addTask,
      updateTask,
      deleteTask,
      restoreTask,
      reorderTasksInMilestone,
      reorderGlobalTasks,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      restoreMilestone,
      cleanupTrash
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
}
