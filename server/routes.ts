import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMilestoneSchema, insertTaskSchema } from "@shared/schema";
import { nanoid } from "nanoid";

// Middleware to extract anonymous user ID from header
function getUserId(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string;
  
  if (!userId) {
    return res.status(401).json({ message: "User ID required" });
  }
  
  // Attach userId to request for use in handlers
  (req as any).userId = userId;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Milestone routes
  app.get("/api/milestones", getUserId, async (req: any, res) => {
    try {
      const userId = req.userId;
      const milestones = await storage.getMilestones(userId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post("/api/milestones", getUserId, async (req: any, res) => {
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

  app.patch("/api/milestones/:id", getUserId, async (req: any, res) => {
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

  app.put("/api/milestones/:id/complete", getUserId, async (req: any, res) => {
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

  app.get("/api/milestones/active", getUserId, async (req: any, res) => {
    try {
      const userId = req.userId;
      const active = await storage.getActiveMilestones(userId);
      res.json(active);
    } catch (error) {
      console.error("Error fetching active milestones:", error);
      res.status(500).json({ message: "Failed to fetch active milestones" });
    }
  });

  app.get("/api/milestones/completed", getUserId, async (req: any, res) => {
    try {
      const userId = req.userId;
      const completed = await storage.getCompletedMilestones(userId);
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      res.status(500).json({ message: "Failed to fetch completed milestones" });
    }
  });

  app.delete("/api/milestones/:id", getUserId, async (req: any, res) => {
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

  app.put("/api/milestones/:id/restore", getUserId, async (req: any, res) => {
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
  app.get("/api/tasks", getUserId, async (req: any, res) => {
    try {
      const userId = req.userId;
      const tasks = await storage.getTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", getUserId, async (req: any, res) => {
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

  app.patch("/api/tasks/:id", getUserId, async (req: any, res) => {
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

  app.put("/api/tasks/:id/complete", getUserId, async (req: any, res) => {
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

  app.get("/api/tasks/completed", getUserId, async (req: any, res) => {
    try {
      const userId = req.userId;
      const completed = await storage.getCompletedTasks(userId);
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      res.status(500).json({ message: "Failed to fetch completed tasks" });
    }
  });

  app.delete("/api/tasks/:id", getUserId, async (req: any, res) => {
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

  app.put("/api/tasks/:id/restore", getUserId, async (req: any, res) => {
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
  app.post("/api/tasks/reorder", getUserId, async (req: any, res) => {
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

  // Cleanup
  app.post("/api/cleanup-trash", getUserId, async (req: any, res) => {
    try {
      const userId = req.userId;
      await storage.cleanupTrash(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error cleaning up trash:", error);
      res.status(500).json({ message: "Failed to cleanup trash" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
