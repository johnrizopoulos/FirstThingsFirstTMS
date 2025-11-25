import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertMilestoneSchema, insertTaskSchema } from "@shared/schema";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Milestone routes
  app.get("/api/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const milestones = await storage.getMilestones(userId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post("/api/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  app.get("/api/milestones/completed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const completed = await storage.getCompletedMilestones(userId);
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed milestones:", error);
      res.status(500).json({ message: "Failed to fetch completed milestones" });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      await storage.deleteMilestone(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Task routes
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tasks = await storage.getTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify milestone belongs to user
      const milestone = await storage.getMilestone(req.body.milestoneId, userId);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      const validatedData = insertTaskSchema.parse({
        ...req.body,
        id: nanoid(),
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  app.get("/api/tasks/completed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const completed = await storage.getCompletedTasks(userId);
      res.json(completed);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      res.status(500).json({ message: "Failed to fetch completed tasks" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      await storage.deleteTask(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Batch operations
  app.post("/api/tasks/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post("/api/cleanup-trash", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
