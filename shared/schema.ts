import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clerkId: varchar("clerk_id").unique(),
  email: varchar("email").unique().notNull(),
  name: varchar("name").notNull(),
  consentTimestamp: timestamp("consent_timestamp").notNull(),
  consentPurpose: varchar("consent_purpose").notNull().default("customer_outreach"),
  consentSource: varchar("consent_source").notNull().default("web_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Milestones table
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").default(""),
  definitionOfDone: text("definition_of_done").default(""),
  displayOrder: integer("display_order").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_milestones_user_id").on(table.userId),
  index("idx_milestones_deleted").on(table.isDeleted),
  index("idx_milestones_completed").on(table.isCompleted),
]);

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  user: one(users, {
    fields: [milestones.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  milestoneId: varchar("milestone_id").references(() => milestones.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").default(""),
  definitionOfDone: text("definition_of_done").default(""),
  milestoneOrder: integer("milestone_order").notNull(),
  globalOrder: integer("global_order").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tasks_user_id").on(table.userId),
  index("idx_tasks_milestone_id").on(table.milestoneId),
  index("idx_tasks_deleted").on(table.isDeleted),
  index("idx_tasks_completed").on(table.isCompleted),
  index("idx_tasks_global_order").on(table.globalOrder),
]);

export const tasksRelations = relations(tasks, ({ one }) => ({
  milestone: one(milestones, {
    fields: [tasks.milestoneId],
    references: [milestones.id],
  }),
}));

export const insertTaskSchema = createInsertSchema(tasks).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
