import { Router, type IRouter } from "express";
import { db, challengesTable, matchResultsTable, matchesTable, matchScoresTable, teamsTable, ladderStandingsTable, seasonsTable, playersTable, inactivityDropsTable } from "@workspace/db";
import { eq, and, sql, lt, isNull, or, asc } from "drizzle-orm";
import { requireCronSecret } from "../lib/auth";
import { applyMatchResult } from "../lib/ladder";
import { sendScoreAutoConfirmedEmail, sendInactivityDropEmail, sendChallengeExpiredEmail, sendPaymentReminderEmail, sendTeamAutoDissolvedEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";
import { logger } from "../lib/logger";
import { refundPlayer } from "./payments";

const router: IRouter = Router();

router.post("/cron/inactivity-drop", requireCronSecret, async (_req, res): Promise<void> => {
  const activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
  if (activeSeasons.length === 0) {
    res.json({ processed: 0, details: ["No active seasons"] });
    return;
  }

  const details: string[] = [];
  const now = new Date();
  const INACTIVITY_DAYS = 7;

  for (const activeSeason of activeSeasons) {
    // Advisory lock per season prevents concurrent cron runs from double-dropping teams
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${activeSeason.id}))`).catch(() => {});

    const standings = await db.select().from(ladderStandingsTable)
      .where(eq(ladderStandingsTable.seasonId, activeSeason.id))
      .orderBy(asc(ladderStandingsTable.position));

    const seasonStart = new Date(activeSeason.startDate);

    for (const standing of standings) {
    const refDate = standing.lastMatchDate ?? standing.lastInactivityCheck ?? seasonStart;
    const daysSince = (now.getTime() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince < INACTIVITY_DAYS) continue;

    // Skip teams that are mid-challenge — penalising them while a match is in flight is unfair.
    const openChallenges = await db.select().from(challengesTable).where(
      and(
        or(eq(challengesTable.challengerTeamId, standing.teamId), eq(challengesTable.challengedTeamId, standing.teamId)),
        sql`${challengesTable.status} IN ('pending','accepted','scheduling','scheduled')`
      )
    ).limit(1);
    if (openChallenges.length > 0) {
      details.push(`Team ${standing.teamId} skipped (open challenge in flight)`);
      continue;
    }

    // Find the team below them
    const teamBelow = standings.find(s => s.position === standing.position + 1);
    if (!teamBelow) continue;

    const oldPos = standing.position;
    const newPos = standing.position + 1;

    // Swap positions using temp
    await db.update(ladderStandingsTable).set({ position: -999 }).where(eq(ladderStandingsTable.id, standing.id));
    await db.update(ladderStandingsTable).set({ position: oldPos }).where(eq(ladderStandingsTable.id, teamBelow.id));
    await db.update(ladderStandingsTable).set({ position: newPos, lastInactivityCheck: now }).where(eq(ladderStandingsTable.id, standing.id));

    // Log drop
    await db.insert(inactivityDropsTable).values({
      teamId: standing.teamId,
      seasonId: activeSeason.id,
      oldPosition: oldPos,
      newPosition: newPos,
    });

    // Notify team
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, standing.teamId)).limit(1);
    if (team) {
      const [p1, p2] = await Promise.all([
        db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1),
        db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1),
      ]);
      const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
      const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];
      await sendInactivityDropEmail(emails, oldPos, newPos);
      await notifyPlayers(playerIds, "inactivity_drop", `Your team dropped from position #${oldPos} to #${newPos} due to inactivity.`, "/challenge");
    }

    details.push(`Team ${standing.teamId} dropped from ${oldPos} to ${newPos}`);
  }
  }

  res.json({ processed: details.length, details });
});

router.post("/cron/auto-confirm", requireCronSecret, async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const results = await db.select().from(matchResultsTable).where(
    and(
      isNull(matchResultsTable.confirmedAt),
      isNull(matchResultsTable.disputeReason),
      lt(matchResultsTable.submittedAt, cutoff)
    )
  );

  const details: string[] = [];

  for (const result of results) {
    const now = new Date();
    await db.update(matchResultsTable).set({ autoConfirmed: true, confirmedAt: now }).where(eq(matchResultsTable.matchId, result.matchId));

    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, result.matchId)).limit(1);
    if (!match) continue;

    const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1);
    if (!challenge) continue;

    if (result.winnerTeamId && result.loserTeamId) {
      await applyMatchResult(challenge.seasonId, result.winnerTeamId, result.loserTeamId, challenge.challengerTeamId);
    }

    const [challengerTeam, challengedTeam] = await Promise.all([
      db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengerTeamId)).limit(1),
      db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengedTeamId)).limit(1),
    ]);
    const allEmails: string[] = [];
    const allPlayerIds: string[] = [];
    for (const t of [challengerTeam[0], challengedTeam[0]].filter(Boolean)) {
      const [p1, p2] = await Promise.all([
        db.select().from(playersTable).where(eq(playersTable.id, t.player1Id)).limit(1),
        db.select().from(playersTable).where(eq(playersTable.id, t.player2Id)).limit(1),
      ]);
      if (p1[0]) { allEmails.push(p1[0].email); allPlayerIds.push(p1[0].id); }
      if (p2[0]) { allEmails.push(p2[0].email); allPlayerIds.push(p2[0].id); }
    }

    const [winnerTeam] = result.winnerTeamId ? await db.select().from(teamsTable).where(eq(teamsTable.id, result.winnerTeamId)).limit(1) : [null];
    const scores = await db.select().from(matchScoresTable).where(eq(matchScoresTable.matchId, result.matchId));
    const scoreStr = scores.length > 0 ? scores.map(s => `${s.team1Score}–${s.team2Score}`).join(", ") : "N/A";
    sendScoreAutoConfirmedEmail(allEmails, winnerTeam?.teamName ?? "Unknown", scoreStr, result.matchId);
    notifyPlayers(allPlayerIds, "score_auto_confirmed", "Match result auto-confirmed after 48 hours. Rankings updated.", `/matches/${result.matchId}`);

    details.push(`Match ${result.matchId} auto-confirmed`);
  }

  res.json({ processed: details.length, details });
});

router.post("/cron/expire-challenges", requireCronSecret, async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const challenges = await db.select().from(challengesTable).where(
    and(
      eq(challengesTable.status, "pending"),
      lt(challengesTable.createdAt, cutoff)
    )
  );

  const details: string[] = [];

  for (const challenge of challenges) {
    await db.update(challengesTable).set({ status: "cancelled" }).where(eq(challengesTable.id, challenge.id));

    const [challengerTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengerTeamId)).limit(1);
    const [challengedTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengedTeamId)).limit(1);

    if (challengerTeam) {
      const [p1, p2] = await Promise.all([
        db.select().from(playersTable).where(eq(playersTable.id, challengerTeam.player1Id)).limit(1),
        db.select().from(playersTable).where(eq(playersTable.id, challengerTeam.player2Id)).limit(1),
      ]);
      const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
      const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];
      sendChallengeExpiredEmail(emails, challengedTeam?.teamName ?? "Unknown");
      notifyPlayers(playerIds, "challenge_expired", `Your challenge to ${challengedTeam?.teamName ?? "Unknown"} expired. No response received.`, "/challenge");
    }

    details.push(`Challenge ${challenge.id} expired`);
  }

  res.json({ processed: details.length, details });
});

// Auto-dissolve unpaid teams after 5 days. Sends reminder emails on day 2 and day 4.
router.post("/cron/auto-dissolve-unpaid", requireCronSecret, async (_req, res): Promise<void> => {
  const now = Date.now();
  const day2Cutoff = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const day4Cutoff = new Date(now - 4 * 24 * 60 * 60 * 1000);
  const day5Cutoff = new Date(now - 5 * 24 * 60 * 60 * 1000);

  // Candidates: unpaid teams not yet withdrawn
  const candidates = await db.select().from(teamsTable).where(
    and(
      eq(teamsTable.paymentStatus, "unpaid"),
      isNull(teamsTable.withdrawnAt),
    )
  );

  const details: string[] = [];

  for (const team of candidates) {
    const createdAt = new Date(team.createdAt);
    const [p1] = await db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1);
    const [p2] = await db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1);
    const emails = [p1?.email, p2?.email].filter(Boolean) as string[];
    const playerIds = [p1?.id, p2?.id].filter(Boolean) as string[];

    if (createdAt <= day5Cutoff) {
      // Past 5 days — auto-dissolve. Compare-and-set claim on withdrawnAt prevents concurrent
      // cron runs from double-processing.
      const claimed = await db.update(teamsTable).set({
        status: "withdrawn",
        withdrawnAt: new Date(),
        withdrawnReason: "auto_dissolve",
      }).where(and(
        eq(teamsTable.id, team.id),
        isNull(teamsTable.withdrawnAt),
        eq(teamsTable.paymentStatus, "unpaid"),
      )).returning({ id: teamsTable.id });
      if (claimed.length === 0) {
        details.push(`Team ${team.id} auto-dissolve skipped (already processed)`);
        continue;
      }
      await db.delete(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, team.id));
      const r1 = await refundPlayer(team.id, 1, true);
      const r2 = await refundPlayer(team.id, 2, true);
      if (emails.length > 0) sendTeamAutoDissolvedEmail(emails, team.teamName);
      if (playerIds.length > 0) {
        notifyPlayers(playerIds, "team_auto_dissolved", `Your team "${team.teamName}" was dissolved (entry fee not paid in time).`, "/team");
      }
      details.push(`Team ${team.id} auto-dissolved; r1=${r1.amountCents}c r2=${r2.amountCents}c`);
    } else if (createdAt <= day4Cutoff && !team.paymentReminderDay4SentAt) {
      // Compare-and-set so two concurrent crons can't both send.
      const claimed = await db.update(teamsTable)
        .set({ paymentReminderDay4SentAt: new Date() })
        .where(and(eq(teamsTable.id, team.id), isNull(teamsTable.paymentReminderDay4SentAt)))
        .returning({ id: teamsTable.id });
      if (claimed.length === 0) {
        details.push(`Team ${team.id} day-4 reminder skipped (already sent)`);
        continue;
      }
      if (emails.length > 0) sendPaymentReminderEmail(emails, team.teamName, 1, team.id);
      if (playerIds.length > 0) {
        notifyPlayers(playerIds, "payment_reminder", `Final reminder: pay your entry fee for "${team.teamName}" or it will be dissolved tomorrow.`, "/team");
      }
      details.push(`Team ${team.id} day-4 reminder sent`);
    } else if (createdAt <= day2Cutoff && !team.paymentReminderDay2SentAt) {
      const claimed = await db.update(teamsTable)
        .set({ paymentReminderDay2SentAt: new Date() })
        .where(and(eq(teamsTable.id, team.id), isNull(teamsTable.paymentReminderDay2SentAt)))
        .returning({ id: teamsTable.id });
      if (claimed.length === 0) {
        details.push(`Team ${team.id} day-2 reminder skipped (already sent)`);
        continue;
      }
      if (emails.length > 0) sendPaymentReminderEmail(emails, team.teamName, 3, team.id);
      if (playerIds.length > 0) {
        notifyPlayers(playerIds, "payment_reminder", `Reminder: please pay your entry fee for "${team.teamName}". 3 days left.`, "/team");
      }
      details.push(`Team ${team.id} day-2 reminder sent`);
    }
  }

  res.json({ processed: details.length, details });
});

export default router;
