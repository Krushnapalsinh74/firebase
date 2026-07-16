import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { chaptersTable } from "./chapters";

export const topicsTable = sqliteTable("topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  chapterId: integer("chapter_id").notNull().references(() => chaptersTable.id, { onDelete: "cascade" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),

  // ── JEE Knowledge Graph metadata ──────────────────────────────────────────
  /** 1=direct application, 2=multi-step, 3=insight-required */
  difficulty: integer("difficulty").default(2),
  /** JSON array of topic IDs that should be understood before this one */
  prerequisites: text("prerequisites").default("[]"),
  /** JSON array of topic IDs that pair well in a single question */
  relatedTopicIds: text("related_topic_ids").default("[]"),
  /** Number of times this concept appeared in past JEE Advanced papers */
  jeeFrequency: integer("jee_frequency").default(5),
  /** JSON array of chapter names valid as cross-links */
  allowedCrossLinks: text("allowed_cross_links").default("[]"),
  /** Hard flag: false = off JEE syllabus, never use in generation */
  isJeeSyllabus: integer("is_jee_syllabus", { mode: "boolean" }).notNull().default(true),
});

export const insertTopicSchema = createInsertSchema(topicsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topicsTable.$inferSelect;

