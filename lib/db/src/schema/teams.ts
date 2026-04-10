import { pgTable, text, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { playersTable } from "./players";

export const teamsTable = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  player1Id: uuid("player1_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  player2Id: uuid("player2_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("teams_season_player1_unique").on(t.seasonId, t.player1Id),
  uniqueIndex("teams_season_player2_unique").on(t.seasonId, t.player2Id),
]);

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
