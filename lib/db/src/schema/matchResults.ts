import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";

export const matchResultsTable = pgTable("match_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  winnerTeamId: uuid("winner_team_id").references(() => teamsTable.id),
  loserTeamId: uuid("loser_team_id").references(() => teamsTable.id),
  submittedByTeamId: uuid("submitted_by_team_id").references(() => teamsTable.id),
  confirmedByTeamId: uuid("confirmed_by_team_id").references(() => teamsTable.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  autoConfirmed: boolean("auto_confirmed").notNull().default(false),
  disputeReason: text("dispute_reason"),
  disputeResolved: boolean("dispute_resolved").notNull().default(false),
});

export const insertMatchResultSchema = createInsertSchema(matchResultsTable).omit({ id: true, submittedAt: true });
export type InsertMatchResult = z.infer<typeof insertMatchResultSchema>;
export type MatchResult = typeof matchResultsTable.$inferSelect;
