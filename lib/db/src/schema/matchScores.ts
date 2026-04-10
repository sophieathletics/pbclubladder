import { pgTable, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const matchScoresTable = pgTable("match_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  gameNumber: integer("game_number").notNull(),
  team1Score: integer("team1_score").notNull(),
  team2Score: integer("team2_score").notNull(),
});

export const insertMatchScoreSchema = createInsertSchema(matchScoresTable).omit({ id: true });
export type InsertMatchScore = z.infer<typeof insertMatchScoreSchema>;
export type MatchScore = typeof matchScoresTable.$inferSelect;
