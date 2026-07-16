import { sqliteTable, integer, text, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionTypesTable = sqliteTable("question_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const insertQuestionTypeSchema = createInsertSchema(questionTypesTable).omit({ id: true, createdAt: true });
export type InsertQuestionType = z.infer<typeof insertQuestionTypeSchema>;
export type QuestionType = typeof questionTypesTable.$inferSelect;
