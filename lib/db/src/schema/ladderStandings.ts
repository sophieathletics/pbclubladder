import { pgTable, uuid, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { teamsTable } from "./teams";

export const ladderStandingsTable = pgTable("ladder_standings", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  lastMatchDate: timestamp("last_match_date", { withTimezone: true }),
  lastInactivityCheck: timestamp("last_inactivity_check", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ladder_standings_season_position_unique").on(t.seasonId, t.position),
  uniqueIndex("ladder_standings_season_team_unique").on(t.seasonId, t.teamId),
]);

export const insertLadderStandingSchema = createInsertSchema(ladderStandingsTable).omit({ id: true, createdAt: true });
export type InsertLadderStanding = z.infer<typeof insertLadderStandingSchema>;
export type LadderStanding = typeof ladderStandingsTable.$inferSelect;
