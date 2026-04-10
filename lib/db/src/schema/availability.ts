import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { challengesTable } from "./challenges";
import { teamsTable } from "./teams";

export const availabilityTable = pgTable("availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id").notNull().references(() => challengesTable.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teamsTable.id),
  slots: jsonb("slots").notNull().$type<Array<{ date: string; times: string[] }>>(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAvailabilitySchema = createInsertSchema(availabilityTable).omit({ id: true, submittedAt: true });
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
export type Availability = typeof availabilityTable.$inferSelect;
