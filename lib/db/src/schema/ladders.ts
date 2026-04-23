import { pgTable, text, uuid, timestamp, boolean, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const laddersTable = pgTable("ladders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("coed"),
  location: text("location"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  level: text("level"),
  entryFeeCents: integer("entry_fee_cents"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: text("sort_order").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  signupDeadline: date("signup_deadline"),
});

export const insertLadderSchema = createInsertSchema(laddersTable).omit({ id: true, createdAt: true });
export type InsertLadder = z.infer<typeof insertLadderSchema>;
export type Ladder = typeof laddersTable.$inferSelect;
