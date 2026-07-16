import { sqliteTable, integer, text, real, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const papersTable = sqliteTable("papers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  institutionName: text("institution_name"),
  totalQuestions: integer("total_questions").notNull().default(0),
  subjectName: text("subject_name"),
  boardName: text("board_name"),
  standardName: text("standard_name"),
  includeAnswerKey: integer("include_answer_key", { mode: "boolean" }).notNull().default(true),
  includeExplanations: integer("include_explanations", { mode: "boolean" }).notNull().default(false),
  questionIds: text("question_ids").notNull(),
  pdfUrl: text("pdf_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const insertPaperSchema = createInsertSchema(papersTable).omit({ id: true, createdAt: true });
export type InsertPaper = z.infer<typeof insertPaperSchema>;
export type Paper = typeof papersTable.$inferSelect;
