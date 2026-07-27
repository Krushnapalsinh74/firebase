import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { boardsTable } from "./boards";
import { standardsTable } from "./standards";
import { subjectsTable } from "./subjects";
import { chaptersTable } from "./chapters";

export const plansTable = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  questionLimit: integer("question_limit").notNull(),
  boardId: integer("board_id").references(() => boardsTable.id, { onDelete: "set null" }),
  standardId: integer("standard_id").references(() => standardsTable.id, { onDelete: "set null" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  chapterId: integer("chapter_id").references(() => chaptersTable.id, { onDelete: "set null" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
