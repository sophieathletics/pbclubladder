import { pgTable, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { seasonsTable } from "./seasons";

export const inactivityDropsTable = pgTable("inactivity_drops", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => teamsTable.id),
  seasonId: uuid("season_id").notNull().references(() => seasonsTable.id),
  oldPosition: integer("old_position").notNull(),
  newPosition: integer("new_position").notNull(),
  droppedAt: timestamp("dropped_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInactivityDropSchema = createInsertSchema(inactivityDropsTable).omit({ id: true, droppedAt: true });
export type InsertInactivityDrop = z.infer<typeof insertInactivityDropSchema>;
export type InactivityDrop = typeof inactivityDropsTable.$inferSelect;
