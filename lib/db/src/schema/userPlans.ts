import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const userPlansTable = sqliteTable("user_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  planId: integer("plan_id").references(() => plansTable.id, { onDelete: "cascade" }).notNull(),
  questionsUsed: integer("questions_used").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  validUntil: integer("valid_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const insertUserPlanSchema = createInsertSchema(userPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserPlan = z.infer<typeof insertUserPlanSchema>;
export type UserPlan = typeof userPlansTable.$inferSelect;
