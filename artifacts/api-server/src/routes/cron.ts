import { Router, type IRouter } from "express";
import { db, challengesTable, matchResultsTable, matchesTable, teamsTable, ladderStandingsTable, seasonsTable, playersTable, inactivityDropsTable } from "@workspace/db";
import { eq, and, sql, lt, isNull, or, asc } from "drizzle-orm";
import { requireCronSecret } from "../lib/auth";
import { applyMatchResult } from "../lib/ladder";
import { sendScoreAutoConfirmedEmail, sendInactivityDropEmail, sendChallengeExpiredEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/cron/inactivity-drop", requireCronSecret, async (_req, res): Promise<void> => {
  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) {
    res.json({ processed: 0, details: ["No active season"] });
    return;
  }

  const standings = await db.select().from(ladderStandingsTable)
    .where(eq(ladderStandingsTable.seasonId, activeSeason.id))
    .orderBy(asc(ladderStandingsTable.position));

  const details: string[] = [];
  const now = new Date();
  const seasonStart = new Date(activeSeason.startDate);
  const INACTIVITY_DAYS = 14;

  for (const standing of standings) {
    const refDate = standing.lastMatchDate ?? standing.lastInactivityCheck ?? seasonStart;
    const daysSince = (now.getTime() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince < INACTIVITY_DAYS) continue;

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
      sendInactivityDropEmail(emails, oldPos, newPos);
      notifyPlayers(playerIds, "inactivity_drop", `Your team dropped from position #${oldPos} to #${newPos} due to inactivity.`, "/challenge");
    }

    details.push(`Team ${standing.teamId} dropped from ${oldPos} to ${newPos}`);
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
    sendScoreAutoConfirmedEmail(allEmails, winnerTeam?.teamName ?? "Unknown", "auto-confirmed", result.matchId);
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

export default router;
