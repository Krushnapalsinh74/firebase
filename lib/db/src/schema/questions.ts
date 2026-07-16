import { sqliteTable, integer, text, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { topicsTable } from "./topics";
import { chaptersTable } from "./chapters";
import { subjectsTable } from "./subjects";
import { boardsTable } from "./boards";
import { standardsTable } from "./standards";
import { aiProvidersTable } from "./aiProviders";

export const questionsTable = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  questionType: text("question_type").notNull(),
  difficulty: text("difficulty").notNull(),
  difficultyScore: integer("difficulty_score").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  options: text("options"),
  explanation: text("explanation").notNull(),
  qualityScore: real("quality_score").notNull().default(0),
  estimatedSolveTime: integer("estimated_solve_time").notNull().default(60),
  learningObjective: text("learning_objective"),
  topicId: integer("topic_id").references(() => topicsTable.id, { onDelete: "set null" }),
  chapterId: integer("chapter_id").references(() => chaptersTable.id, { onDelete: "set null" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  boardId: integer("board_id").references(() => boardsTable.id, { onDelete: "set null" }),
  standardId: integer("standard_id").references(() => standardsTable.id, { onDelete: "set null" }),
  providerId: integer("provider_id").references(() => aiProvidersTable.id, { onDelete: "set null" }),
  modelUsed: text("model_used"),
  jobId: text("job_id"),
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, generatedAt: true, updatedAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
