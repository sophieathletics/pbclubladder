import { Router, type IRouter } from "express";
import express from "express";
import { db, playersTable, teamsTable, matchResultsTable, matchesTable, matchScoresTable, seasonsTable, ladderStandingsTable, challengesTable, laddersTable } from "@workspace/db";
import { eq, and, sql, ilike, or } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { sanitizePlayer } from "./auth";
import { applyMatchResult } from "../lib/ladder";
import { sendDisputeResolvedEmail, sendAdminRemovedTeamEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";
import { enrichMatch } from "./matches";
import { refundPlayer } from "./payments";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalPlayers] = await db.select({ count: sql<number>`count(*)::int` }).from(playersTable).where(eq(playersTable.isActive, true));
  const activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));

  let totalTeams = 0;
  let matchesThisSeason = 0;

  if (activeSeasons.length > 0) {
    const seasonIds = activeSeasons.map(s => s.id);
    const allTeams = await db.select().from(teamsTable);
    totalTeams = allTeams.filter(t => seasonIds.includes(t.seasonId)).length;

    const allChallenges = await db.select().from(challengesTable);
    const challengeIds = allChallenges.filter(c => seasonIds.includes(c.seasonId)).map(c => c.id);
    if (challengeIds.length > 0) {
      const matches = await db.select().from(matchesTable);
      matchesThisSeason = matches.filter(m => challengeIds.includes(m.challengeId) && m.status === "completed").length;
    }
  }
  const activeSeason = activeSeasons[0];

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

  const activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
  const seasonIds = activeSeasons.map(s => s.id);

  const enriched = await Promise.all(players.map(async (player) => {
    let currentTeam = null;
    if (seasonIds.length > 0) {
      const teams = await db.select().from(teamsTable).where(
        or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id))
      );
      currentTeam = teams.find(t => seasonIds.includes(t.seasonId)) ?? null;
    }
    return { ...sanitizePlayer(player), currentTeam };
  }));

  res.json(enriched);
});

router.post("/admin/players/:id/deactivate", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const me = (req as any).player;

  if (id === me.id) {
    res.status(400).json({ error: "You cannot deactivate your own account." });
    return;
  }

  const [target] = await db.select().from(playersTable).where(eq(playersTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  if (target.role === "admin") {
    res.status(403).json({ error: "Admin accounts cannot be deactivated." });
    return;
  }

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

router.get("/admin/teams", requireAdmin, async (_req, res): Promise<void> => {
  const all = await db.select().from(teamsTable);
  const playerIds = Array.from(new Set(all.flatMap(t => [t.player1Id, t.player2Id].filter(Boolean) as string[])));
  const seasonIds = Array.from(new Set(all.map(t => t.seasonId)));
  const players = playerIds.length > 0
    ? await db.select().from(playersTable).where(or(...playerIds.map(id => eq(playersTable.id, id))))
    : [];
  const seasons = seasonIds.length > 0
    ? await db.select().from(seasonsTable).where(or(...seasonIds.map(id => eq(seasonsTable.id, id))))
    : [];
  const playerMap = new Map(players.map(p => [p.id, sanitizePlayer(p)]));
  const seasonMap = new Map(seasons.map(s => [s.id, s]));
  const enriched = all.map(t => ({
    ...t,
    player1: t.player1Id ? playerMap.get(t.player1Id) ?? null : null,
    player2: t.player2Id ? playerMap.get(t.player2Id) ?? null : null,
    season: seasonMap.get(t.seasonId) ?? null,
  }));
  enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(enriched);
});

// Roster: all ladders with teams, players, standings, and match history
router.get("/admin/roster", requireAdmin, async (_req, res): Promise<void> => {
  const [ladders, seasons, teams, players, standings, matches, scores, results] = await Promise.all([
    db.select().from(laddersTable),
    db.select().from(seasonsTable),
    db.select().from(teamsTable),
    db.select().from(playersTable),
    db.select().from(ladderStandingsTable),
    db.select().from(matchesTable),
    db.select().from(matchScoresTable),
    db.select().from(matchResultsTable),
  ]);

  const playerMap = new Map(players.map(p => [p.id, sanitizePlayer(p)]));
  const seasonMap = new Map(seasons.map(s => [s.id, s]));
  const standingMap = new Map(standings.map(s => [s.teamId, s]));

  // Build match lookup by team id
  const matchesByTeam = new Map<string, any[]>();
  for (const m of matches) {
    const challenge = m.challengeId;
    // matches are linked to teams via challenges; we attach to both teams via challenge lookup later
  }

  // Build challenge lookup for matches
  const challenges = await db.select().from(challengesTable);
  const challengeMap = new Map(challenges.map(c => [c.id, c]));

  const scoresByMatch = new Map<string, any[]>();
  for (const s of scores) {
    if (!scoresByMatch.has(s.matchId)) scoresByMatch.set(s.matchId, []);
    scoresByMatch.get(s.matchId)!.push(s);
  }
  const resultByMatch = new Map(results.map(r => [r.matchId, r]));

  // Group matches by team
  for (const m of matches) {
    const ch = challengeMap.get(m.challengeId);
    if (!ch) continue;
    const matchData = {
      id: m.id,
      scheduledDate: m.scheduledDate,
      scheduledTime: m.scheduledTime,
      courtLocation: m.courtLocation,
      scores: scoresByMatch.get(m.id) ?? [],
      result: resultByMatch.get(m.id) ?? null,
      challengerTeamId: ch.challengerTeamId,
      challengedTeamId: ch.challengedTeamId,
    };
    for (const teamId of [ch.challengerTeamId, ch.challengedTeamId]) {
      if (!matchesByTeam.has(teamId)) matchesByTeam.set(teamId, []);
      matchesByTeam.get(teamId)!.push(matchData);
    }
  }

  // Group teams by ladder
  const ladderMap = new Map(ladders.map(l => [l.id, l]));
  const teamsByLadder = new Map<string, any[]>();

  for (const team of teams) {
    const season = seasonMap.get(team.seasonId);
    if (!season) continue;
    const ladder = ladderMap.get(season.ladderId);
    if (!ladder) continue;
    if (!teamsByLadder.has(ladder.id)) teamsByLadder.set(ladder.id, []);
    teamsByLadder.get(ladder.id)!.push({
      ...team,
      player1: team.player1Id ? playerMap.get(team.player1Id) ?? null : null,
      player2: team.player2Id ? playerMap.get(team.player2Id) ?? null : null,
      season,
      standing: standingMap.get(team.id) ?? null,
      matches: (matchesByTeam.get(team.id) ?? []).sort((a, b) =>
        (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? "")
      ),
    });
  }

  const roster = ladders.map(l => ({
    ladder: l,
    activeSeason: seasons.find(s => s.ladderId === l.id && s.isActive) ?? null,
    teams: (teamsByLadder.get(l.id) ?? []).sort((a, b) =>
      (a.standing?.position ?? 999) - (b.standing?.position ?? 999)
    ),
  })).filter(r => r.teams.length > 0)
    .sort((a, b) => a.ladder.name.localeCompare(b.ladder.name));

  res.json(roster);
});

router.post("/admin/teams/:id/remove", requireAdmin, express.json(), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const refundFlag = (req.body?.refund ?? false) === true;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (team.withdrawnAt) {
    res.status(400).json({ error: "Team already removed" });
    return;
  }

  let r1 = { amountCents: 0, refunded: false };
  let r2 = { amountCents: 0, refunded: false };
  if (refundFlag) {
    r1 = await refundPlayer(team.id, 1, true);
    r2 = await refundPlayer(team.id, 2, true);
  }

  await db.update(teamsTable).set({
    status: "withdrawn",
    withdrawnAt: new Date(),
    withdrawnReason: "admin",
  }).where(eq(teamsTable.id, team.id));
  await db.delete(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, team.id));

  // Notify both players
  const [p1] = await db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1);
  const [p2] = await db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1);
  if (p1?.email) sendAdminRemovedTeamEmail(p1.email, team.teamName, refundFlag ? r1.amountCents : null);
  if (p2?.email) sendAdminRemovedTeamEmail(p2.email, team.teamName, refundFlag ? r2.amountCents : null);
  notifyPlayers(
    [team.player1Id, team.player2Id].filter(Boolean) as string[],
    "team_removed_by_admin",
    `Your team "${team.teamName}" was removed by an administrator.`,
    "/team"
  );

  logger.info({ teamId: team.id, refundFlag, r1, r2 }, "Team removed by admin");
  res.json({ ok: true, refundIssued: refundFlag, refund1: r1, refund2: r2 });
});

export default router;
