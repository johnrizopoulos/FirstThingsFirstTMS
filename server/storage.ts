import {
  users,
  milestones,
  tasks,
  type User,
  type UpsertUser,
  type Milestone,
  type InsertMilestone,
  type Task,
  type InsertTask,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Milestone operations
  getMilestones(userId: string): Promise<Milestone[]>;
  getMilestone(id: string, userId: string): Promise<Milestone | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, userId: string, updates: Partial<Milestone>): Promise<Milestone | undefined>;
  completeMilestone(id: string, userId: string): Promise<Milestone | undefined>;
  deleteMilestone(id: string, userId: string): Promise<void>;
  getActiveMilestones(userId: string): Promise<Milestone[]>;
  getCompletedMilestones(userId: string): Promise<Milestone[]>;
  restoreMilestone(id: string, userId: string): Promise<{ milestone: Milestone } | { error: string }>;
  
  // Task operations
  getTasks(userId: string): Promise<Task[]>;
  getTask(id: string, userId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, userId: string, updates: Partial<Task>): Promise<Task | undefined>;
  completeTask(id: string, userId: string): Promise<Task | undefined>;
  deleteTask(id: string, userId: string): Promise<void>;
  getCompletedTasks(userId: string): Promise<Task[]>;
  restoreTask(id: string, userId: string): Promise<{ task: Task } | { error: string }>;
  
  // Batch operations
  reorderTasks(taskIds: string[], userId: string): Promise<void>;
  
  // Cleanup operations
  cleanupTrash(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Milestone operations
  async getMilestones(userId: string): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(eq(milestones.userId, userId))
      .orderBy(asc(milestones.displayOrder));
  }

  async getMilestone(id: string, userId: string): Promise<Milestone | undefined> {
    const [milestone] = await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.id, id), eq(milestones.userId, userId)));
    return milestone;
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [created] = await db
      .insert(milestones)
      .values({
        ...milestone,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateMilestone(id: string, userId: string, updates: Partial<Milestone>): Promise<Milestone | undefined> {
    const [updated] = await db
      .update(milestones)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(milestones.id, id), eq(milestones.userId, userId)))
      .returning();
    return updated;
  }

  async completeMilestone(id: string, userId: string): Promise<Milestone | undefined> {
    const now = new Date();
    
    // First, get the milestone to verify it exists and belongs to the user
    const milestone = await this.getMilestone(id, userId);
    if (!milestone) return undefined;

    // Complete all tasks associated with this milestone
    await db
      .update(tasks)
      .set({
        isCompleted: true,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(tasks.milestoneId, id), eq(tasks.isCompleted, false)));

    // Complete the milestone
    const [completed] = await db
      .update(milestones)
      .set({
        isCompleted: true,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(milestones.id, id), eq(milestones.userId, userId)))
      .returning();
    return completed;
  }

  async deleteMilestone(id: string, userId: string): Promise<void> {
    await db
      .update(milestones)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(milestones.id, id), eq(milestones.userId, userId)));
  }

  async getActiveMilestones(userId: string): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(and(
        eq(milestones.userId, userId),
        eq(milestones.isDeleted, false),
        eq(milestones.isCompleted, false)
      ))
      .orderBy(asc(milestones.displayOrder));
  }

  async getCompletedMilestones(userId: string): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.userId, userId), eq(milestones.isCompleted, true)))
      .orderBy(desc(milestones.completedAt));
  }

  // Task operations
  async getTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(asc(tasks.globalOrder));
  }

  async getTask(id: string, userId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db
      .insert(tasks)
      .values({
        ...task,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateTask(id: string, userId: string, updates: Partial<Task>): Promise<Task | undefined> {
    // Verify task belongs to user via milestone
    const existingTask = await this.getTask(id, userId);
    if (!existingTask) return undefined;

    const [updated] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async completeTask(id: string, userId: string): Promise<Task | undefined> {
    const existingTask = await this.getTask(id, userId);
    if (!existingTask) return undefined;

    const [completed] = await db
      .update(tasks)
      .set({
        isCompleted: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();
    return completed;
  }

  async deleteTask(id: string, userId: string): Promise<void> {
    const existingTask = await this.getTask(id, userId);
    if (!existingTask) return;

    await db
      .update(tasks)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));
  }

  async getCompletedTasks(userId: string): Promise<Task[]> {
    const result = await db
      .select({
        task: tasks,
      })
      .from(tasks)
      .innerJoin(milestones, eq(tasks.milestoneId, milestones.id))
      .where(and(eq(milestones.userId, userId), eq(tasks.isCompleted, true)))
      .orderBy(desc(tasks.completedAt));

    return result.map((r) => r.task);
  }

  // Batch operations
  async reorderTasks(taskIds: string[], userId: string): Promise<void> {
    // Update global order for each task
    for (let i = 0; i < taskIds.length; i++) {
      const existingTask = await this.getTask(taskIds[i], userId);
      if (existingTask) {
        await db
          .update(tasks)
          .set({ globalOrder: i, updatedAt: new Date() })
          .where(eq(tasks.id, taskIds[i]));
      }
    }
  }

  async restoreTask(id: string, userId: string): Promise<{ task: Task } | { error: string }> {
    const task = await this.getTask(id, userId);
    if (!task) return { error: "Task not found" };
    
    // Count active (non-deleted, non-completed) tasks
    const activeTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.isDeleted, false),
        eq(tasks.isCompleted, false)
      ));
    
    if (activeTasks.length >= 50) {
      return { 
        error: "Cannot restore task - maximum 50 active tasks reached. Please complete or delete another task." 
      };
    }
    
    const [restored] = await db
      .update(tasks)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();
    
    return { task: restored };
  }

  async restoreMilestone(id: string, userId: string): Promise<{ milestone: Milestone } | { error: string }> {
    const milestone = await this.getMilestone(id, userId);
    if (!milestone) return { error: "Milestone not found" };
    
    // Count active (non-deleted, non-completed) milestones
    const activeMilestones = await db
      .select()
      .from(milestones)
      .where(and(
        eq(milestones.userId, userId),
        eq(milestones.isDeleted, false),
        eq(milestones.isCompleted, false)
      ));
    
    if (activeMilestones.length >= 5) {
      return { 
        error: "Cannot restore milestone - maximum 5 active milestones reached. Please complete or delete another milestone." 
      };
    }
    
    const [restored] = await db
      .update(milestones)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, id))
      .returning();
    
    return { milestone: restored };
  }

  // Cleanup operations
  async cleanupTrash(userId: string): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete old milestones
    await db
      .delete(milestones)
      .where(
        and(
          eq(milestones.userId, userId),
          eq(milestones.isDeleted, true),
          sql`${milestones.deletedAt} < ${thirtyDaysAgo}`
        )
      );

    // Delete old tasks (belonging to user's milestones)
    const userMilestones = await this.getMilestones(userId);
    const milestoneIds = userMilestones.map((m) => m.id);

    if (milestoneIds.length > 0) {
      await db
        .delete(tasks)
        .where(
          and(
            sql`${tasks.milestoneId} IN (${sql.join(milestoneIds.map(id => sql`${id}`), sql`, `)})`,
            eq(tasks.isDeleted, true),
            sql`${tasks.deletedAt} < ${thirtyDaysAgo}`
          )
        );
    }
  }
}

export const storage = new DatabaseStorage();
