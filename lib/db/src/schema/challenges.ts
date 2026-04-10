import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { teamsTable } from "./teams";

export const challengesTable = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull().references(() => seasonsTable.id),
  challengerTeamId: uuid("challenger_team_id").notNull().references(() => teamsTable.id),
  challengedTeamId: uuid("challenged_team_id").notNull().references(() => teamsTable.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChallengeSchema = createInsertSchema(challengesTable).omit({ id: true, createdAt: true });
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challengesTable.$inferSelect;
