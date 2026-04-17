import { pgTable, text, uuid, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const laddersTable = pgTable("ladders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("coed"),
  location: text("location"),
  level: text("level"),
  entryFeeCents: integer("entry_fee_cents"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: text("sort_order").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLadderSchema = createInsertSchema(laddersTable).omit({ id: true, createdAt: true });
export type InsertLadder = z.infer<typeof insertLadderSchema>;
export type Ladder = typeof laddersTable.$inferSelect;
