import { Router, type IRouter } from "express";
import { db, playersTable, teamsTable, matchResultsTable, matchesTable, matchScoresTable, seasonsTable, ladderStandingsTable, challengesTable } from "@workspace/db";
import { eq, and, sql, ilike, or } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { sanitizePlayer } from "./auth";
import { applyMatchResult } from "../lib/ladder";
import { sendDisputeResolvedEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";
import { enrichMatch } from "./matches";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalPlayers] = await db.select({ count: sql<number>`count(*)::int` }).from(playersTable).where(eq(playersTable.isActive, true));
  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);

  let totalTeams = 0;
  let matchesThisSeason = 0;

  if (activeSeason) {
    const [teamsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(teamsTable).where(eq(teamsTable.seasonId, activeSeason.id));
    totalTeams = teamsCount?.count ?? 0;

    const challenges = await db.select().from(challengesTable).where(eq(challengesTable.seasonId, activeSeason.id));
    const challengeIds = challenges.map(c => c.id);
    if (challengeIds.length > 0) {
      const matches = await db.select().from(matchesTable);
      matchesThisSeason = matches.filter(m => challengeIds.includes(m.challengeId) && m.status === "completed").length;
    }
  }

  const disputes = await db.select().from(matchResultsTable)
    .where(and(sql`dispute_reason IS NOT NULL`, eq(matchResultsTable.disputeResolved, false)));
  const openDisputes = disputes.length;

  const pendingChallenges = (await db.select().from(challengesTable).where(eq(challengesTable.status, "pending"))).length;

  res.json({
    totalPlayers: totalPlayers?.count ?? 0,
    totalTeams,
    activeSeasonName: activeSeason?.name,
    matchesThisSeason,
    openDisputes,
    pendingChallenges,
  });
});

router.get("/admin/players", requireAdmin, async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
  const offset = parseInt(req.query.offset as string || "0");

  let players;
  if (search) {
    players = await db.select().from(playersTable)
      .where(or(ilike(playersTable.fullName, `%${search}%`), ilike(playersTable.email, `%${search}%`)))
      .limit(limit).offset(offset);
  } else {
    players = await db.select().from(playersTable).limit(limit).offset(offset);
  }

  const [active] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);

  const enriched = await Promise.all(players.map(async (player) => {
    let currentTeam = null;
    if (active) {
      const [team] = await db.select().from(teamsTable).where(
        and(
          eq(teamsTable.seasonId, active.id),
          or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id))
        )
      ).limit(1);
      currentTeam = team ?? null;
    }
    return { ...sanitizePlayer(player), currentTeam };
  }));

  res.json(enriched);
});

router.post("/admin/players/:id/deactivate", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.update(playersTable).set({ isActive: false }).where(eq(playersTable.id, id));
  res.json({ success: true, message: "Player deactivated" });
});

router.get("/admin/disputes", requireAdmin, async (req, res): Promise<void> => {
  const resolved = req.query.resolved === "true";

  const results = await db.select().from(matchResultsTable).where(
    resolved
      ? and(sql`dispute_reason IS NOT NULL`, eq(matchResultsTable.disputeResolved, true))
      : and(sql`dispute_reason IS NOT NULL`, eq(matchResultsTable.disputeResolved, false))
  );

  const enriched = await Promise.all(results.map(async (r) => {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, r.matchId)).limit(1);
    const enrichedMatch = match ? await enrichMatch(match) : null;
    return { matchResult: r, match: enrichedMatch };
  }));

  res.json(enriched);
});

router.post("/admin/disputes/:id/resolve", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { action, correctedGames, winnerTeamId } = req.body;

  if (!["confirm", "correct", "cancel"].includes(action)) {
    res.status(400).json({ error: "action must be confirm, correct, or cancel" });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [result] = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, id)).limit(1);
  if (!result) {
    res.status(404).json({ error: "No result found" });
    return;
  }

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1);

  if (action === "cancel") {
    await db.update(matchResultsTable).set({ disputeResolved: true, confirmedAt: new Date() }).where(eq(matchResultsTable.matchId, id));
    await db.update(matchesTable).set({ status: "completed" }).where(eq(matchesTable.id, id));
  } else if (action === "confirm") {
    await db.update(matchResultsTable).set({ disputeResolved: true, confirmedAt: new Date() }).where(eq(matchResultsTable.matchId, id));
    await db.update(matchesTable).set({ status: "completed" }).where(eq(matchesTable.id, id));
    if (result.winnerTeamId && result.loserTeamId && challenge) {
      await applyMatchResult(challenge.seasonId, result.winnerTeamId, result.loserTeamId, challenge.challengerTeamId);
    }
  } else if (action === "correct" && correctedGames && winnerTeamId && challenge) {
    await db.delete(matchScoresTable).where(eq(matchScoresTable.matchId, id));
    for (const g of correctedGames) {
      await db.insert(matchScoresTable).values({ matchId: id, gameNumber: g.gameNumber, team1Score: g.team1Score, team2Score: g.team2Score });
    }
    const loserTeamId = winnerTeamId === challenge.challengerTeamId ? challenge.challengedTeamId : challenge.challengerTeamId;
    await db.update(matchResultsTable).set({ disputeResolved: true, confirmedAt: new Date(), winnerTeamId, loserTeamId }).where(eq(matchResultsTable.matchId, id));
    await db.update(matchesTable).set({ status: "completed" }).where(eq(matchesTable.id, id));
    await applyMatchResult(challenge.seasonId, winnerTeamId, loserTeamId, challenge.challengerTeamId);
  }

  if (challenge) {
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
    sendDisputeResolvedEmail(allEmails, action, id);
    notifyPlayers(allPlayerIds, "dispute_resolved", `Your match dispute has been resolved (${action}).`, `/matches/${id}`);
  }

  const enriched = await enrichMatch(match);
  res.json(enriched);
});

export default router;
