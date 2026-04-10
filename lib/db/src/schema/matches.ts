import { pgTable, text, uuid, timestamp, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { challengesTable } from "./challenges";
import { teamsTable } from "./teams";

export const matchesTable = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id").notNull().references(() => challengesTable.id, { onDelete: "cascade" }),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: time("scheduled_time").notNull(),
  courtLocation: text("court_location").notNull(),
  bookedByTeamId: uuid("booked_by_team_id").references(() => teamsTable.id),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
