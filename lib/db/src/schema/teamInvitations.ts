import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { playersTable } from "./players";

export const teamInvitationsTable = pgTable("team_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull().references(() => seasonsTable.id),
  inviterId: uuid("inviter_id").notNull().references(() => playersTable.id),
  inviteeId: uuid("invitee_id").references(() => playersTable.id),
  inviteeEmail: text("invitee_email"),
  teamName: text("team_name").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitationsTable).omit({ id: true, createdAt: true });
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitationsTable.$inferSelect;
