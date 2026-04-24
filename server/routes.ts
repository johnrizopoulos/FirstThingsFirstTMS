import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupClerkMiddleware, isAuthenticated } from "./auth";
import { insertMilestoneSchema, insertTaskSchema } from "@shared/schema";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Clerk authentication middleware
  setupClerkMiddleware(app);

  // Milestone routes
  app.get("/api/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const milestones = await storage.getMilestones(userId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post("/api/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const validatedData = insertMilestoneSchema.parse({
        ...req.body,
        id: nanoid(),
        userId,
      });
      
      const milestone = await storage.createMilestone(validatedData);
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(400).json({ message: "Invalid milestone data" });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const updated = await storage.updateMilestone(id, userId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.put("/api/milestones/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const completed = await storage.completeMilestone(id, userId);
      if (!completed) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      res.json(completed);
    } catch (error) {
      console.error("Error completing milestone:", error);
      res.status(500).json({ message: "Failed to complete milestone" });
    }
  });

  app.put("/api/milestones/:id/uncomplete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const result = await storage.uncompleteMilestone(id, userId);
      if ('error' in result) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json(result.milestone);
    } catch (error) {
      console.error("Error uncompleting milestone:", error);
      res.status(500).json({ message: "Failed to uncomplete milestone" });
    }
  });

  app.get("/api/milestones/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const active = await storage.getActiveMilestones(userId);
      res.json(active);
    } catch (error) {
      console.error("Error fetching active milestones:", error);
      res.status(500).json({ message: "Failed to fetch active milestones" });
    }
  });

  app.get("/api/milestones/completed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const completed = await storage.getCompletedMilestones(userId);
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      res.status(500).json({ message: "Failed to fetch completed milestones" });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      await storage.deleteMilestone(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  app.put("/api/milestones/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const result = await storage.restoreMilestone(id, userId);
      if ("error" in result) {
        return res.status(409).json({ message: result.error });
      }
      
      res.json(result.milestone);
    } catch (error) {
      console.error("Error restoring milestone:", error);
      res.status(500).json({ message: "Failed to restore milestone" });
    }
  });

  // Task routes
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tasks = await storage.getTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tasks = await storage.getActiveTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching active tasks:", error);
      res.status(500).json({ message: "Failed to fetch active tasks" });
    }
  });

  app.get("/api/tasks/focus", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const task = await storage.getFocusTask(userId);
      res.json(task || null);
    } catch (error) {
      console.error("Error fetching focus task:", error);
      res.status(500).json({ message: "Failed to fetch focus task" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      
      // If milestoneId is provided, verify it belongs to user and check task limit
      if (req.body.milestoneId) {
        const milestone = await storage.getMilestone(req.body.milestoneId, userId);
        if (!milestone) {
          return res.status(404).json({ message: "Milestone not found" });
        }
        
        // Check task count limit (max 10 tasks per milestone)
        const taskCount = await storage.getTaskCountForMilestone(req.body.milestoneId);
        if (taskCount >= 10) {
          return res.status(400).json({ message: "Milestone task limit (10) reached" });
        }
      }
      
      const validatedData = insertTaskSchema.parse({
        ...req.body,
        id: nanoid(),
        userId,
      });
      
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const updated = await storage.updateTask(id, userId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.put("/api/tasks/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const completed = await storage.completeTask(id, userId);
      if (!completed) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(completed);
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  app.put("/api/tasks/:id/uncomplete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const result = await storage.uncompleteTask(id, userId);
      if ('error' in result) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json(result.task);
    } catch (error) {
      console.error("Error uncompleting task:", error);
      res.status(500).json({ message: "Failed to uncomplete task" });
    }
  });

  app.get("/api/tasks/completed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const completed = await storage.getCompletedTasks(userId);
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      res.status(500).json({ message: "Failed to fetch completed tasks" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      await storage.deleteTask(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.put("/api/tasks/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      
      const result = await storage.restoreTask(id, userId);
      if ("error" in result) {
        return res.status(409).json({ message: result.error });
      }
      
      res.json(result.task);
    } catch (error) {
      console.error("Error restoring task:", error);
      res.status(500).json({ message: "Failed to restore task" });
    }
  });

  // Batch operations
  app.post("/api/tasks/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      await storage.reorderTasks(taskIds, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error reordering tasks:", error);
      res.status(500).json({ message: "Failed to reorder tasks" });
    }
  });

  app.post("/api/tasks/reorder-in-milestone", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { taskIds, milestoneId } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      if (!milestoneId || typeof milestoneId !== 'string') {
        return res.status(400).json({ message: "milestoneId is required" });
      }
      
      await storage.reorderTasksInMilestone(taskIds, milestoneId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error reordering tasks in milestone:", error);
      
      // Return appropriate error status based on error type
      if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("access denied")) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("does not belong")) {
          return res.status(403).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: "Failed to reorder tasks in milestone" });
    }
  });

  // Cleanup
  app.post("/api/cleanup-trash", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      await storage.cleanupTrash(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error cleaning up trash:", error);
      res.status(500).json({ message: "Failed to cleanup trash" });
    }
  });

  // Empty trash (permanently delete all trashed items)
  app.post("/api/empty-trash", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      await storage.emptyTrash(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error emptying trash:", error);
      res.status(500).json({ message: "Failed to empty trash" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
