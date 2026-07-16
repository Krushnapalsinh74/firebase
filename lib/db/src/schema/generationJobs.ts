import { sqliteTable, integer, text, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiProvidersTable } from "./aiProviders";

export const generationJobsTable = sqliteTable("generation_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  totalRequested: integer("total_requested").notNull(),
  totalGenerated: integer("total_generated"),
  boardId: integer("board_id"),
  standardId: integer("standard_id"),
  subjectId: integer("subject_id"),
  chapterId: integer("chapter_id"),
  topicId: integer("topic_id"),
  topicName: text("topic_name"),
  subjectName: text("subject_name"),
  chapterName: text("chapter_name"),
  questionType: text("question_type").notNull(),
  difficulty: text("difficulty").notNull(),
  providerId: integer("provider_id").references(() => aiProvidersTable.id, { onDelete: "set null" }),
  model: text("model").notNull(),
  agentLogs: text("agent_logs"),
  errorMessage: text("error_message"),
  requestParams: text("request_params", { mode: "json" }),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalCostInr: real("total_cost_inr").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const insertGenerationJobSchema = createInsertSchema(generationJobsTable).omit({ id: true, createdAt: true });
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobsTable.$inferSelect;
