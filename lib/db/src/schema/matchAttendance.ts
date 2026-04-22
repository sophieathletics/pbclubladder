import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";
import { playersTable } from "./players";

export const matchAttendanceTable = pgTable(
  "match_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("match_attendance_player_match_idx").on(table.matchId, table.playerId)],
);

export const insertMatchAttendanceSchema = createInsertSchema(matchAttendanceTable).omit({ id: true, confirmedAt: true });
export type InsertMatchAttendance = z.infer<typeof insertMatchAttendanceSchema>;
export type MatchAttendance = typeof matchAttendanceTable.$inferSelect;
