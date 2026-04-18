import { pgTable, text, uuid, timestamp, uniqueIndex, integer } from "drizzle-orm/pg-core";
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
  paymentStatus: text("payment_status").notNull().default("not_required"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  player1PaidAt: timestamp("player1_paid_at", { withTimezone: true }),
  player2PaidAt: timestamp("player2_paid_at", { withTimezone: true }),
  player1StripePaymentIntentId: text("player1_stripe_payment_intent_id"),
  player2StripePaymentIntentId: text("player2_stripe_payment_intent_id"),
  player1RefundedAt: timestamp("player1_refunded_at", { withTimezone: true }),
  player2RefundedAt: timestamp("player2_refunded_at", { withTimezone: true }),
  player1RefundId: text("player1_refund_id"),
  player2RefundId: text("player2_refund_id"),
  player1RefundAmountCents: integer("player1_refund_amount_cents"),
  player2RefundAmountCents: integer("player2_refund_amount_cents"),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  withdrawnReason: text("withdrawn_reason"),
  paymentReminderDay2SentAt: timestamp("payment_reminder_day2_sent_at", { withTimezone: true }),
  paymentReminderDay4SentAt: timestamp("payment_reminder_day4_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("teams_season_player1_unique").on(t.seasonId, t.player1Id),
  uniqueIndex("teams_season_player2_unique").on(t.seasonId, t.player2Id),
]);

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
