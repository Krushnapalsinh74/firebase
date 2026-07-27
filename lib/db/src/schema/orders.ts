import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const ordersTable = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => plansTable.id, { onDelete: "set null" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("created"), // created, paid, failed
  receipt: text("receipt"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
