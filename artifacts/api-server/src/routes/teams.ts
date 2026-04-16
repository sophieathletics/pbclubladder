import { Router, type IRouter } from "express";
import { db, teamsTable, playersTable, ladderStandingsTable, seasonsTable, matchesTable, matchScoresTable, matchResultsTable, challengesTable } from "@workspace/db";
import { eq, and, or, ilike, desc, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { sanitizePlayer } from "./auth";

const router: IRouter = Router();

async function enrichTeam(team: any) {
  const [p1, p2] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1),
    db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1),
  ]);
  const [standing] = await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, team.id)).limit(1);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, team.seasonId)).limit(1);
  return {
    ...team,
    player1: p1[0] ? sanitizePlayer(p1[0]) : null,
    player2: p2[0] ? sanitizePlayer(p2[0]) : null,
    standing: standing ?? null,
    season: season ?? null,
  };
}

router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const { season_id, search, status } = req.query;

  let teams = await db.select().from(teamsTable);

  if (season_id) teams = teams.filter(t => t.seasonId === season_id);
  if (status) teams = teams.filter(t => t.status === status);
  if (search) {
    const s = (search as string).toLowerCase();
    const enriched = await Promise.all(teams.map(enrichTeam));
    const filtered = enriched.filter(t =>
      t.teamName.toLowerCase().includes(s) ||
      t.player1?.fullName?.toLowerCase().includes(s) ||
      t.player2?.fullName?.toLowerCase().includes(s)
    );
    res.json(filtered);
    return;
  }

  const enriched = await Promise.all(teams.map(enrichTeam));
  res.json(enriched);
});

router.get("/teams/my-team", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const ladderId = req.query.ladder_id as string | undefined;

  // Find active season(s)
  let activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
  if (ladderId) activeSeasons = activeSeasons.filter(s => s.ladderId === ladderId);
  if (activeSeasons.length === 0) {
    res.status(404).json({ error: "No active season" });
    return;
  }

  for (const s of activeSeasons) {
    const [team] = await db.select().from(teamsTable).where(
      and(eq(teamsTable.seasonId, s.id), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
    ).limit(1);
    if (team) {
      res.json(await enrichTeam(team));
      return;
    }
  }
  res.status(404).json({ error: "No team found" });
});

router.get("/teams/my-teams", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
  const results: any[] = [];
  for (const s of activeSeasons) {
    const [team] = await db.select().from(teamsTable).where(
      and(eq(teamsTable.seasonId, s.id), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
    ).limit(1);
    if (team) results.push(await enrichTeam(team));
  }
  res.json(results);
});

router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  const enriched = await enrichTeam(team);
  res.json(enriched);
});

router.get("/teams/:id/matches", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const limit = Math.min(parseInt(req.query.limit as string || "5"), 20);

  const challenges = await db.select().from(challengesTable).where(
    or(eq(challengesTable.challengerTeamId, id), eq(challengesTable.challengedTeamId, id))
  );
  const challengeIds = challenges.map(c => c.id);

  if (challengeIds.length === 0) {
    res.json([]);
    return;
  }

  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.status, "completed"))
    .orderBy(desc(matchesTable.scheduledDate))
    .limit(limit);

  const filtered = matches.filter(m => challengeIds.includes(m.challengeId));

  const enriched = await Promise.all(filtered.slice(0, limit).map(async (match) => {
    const challenge = challenges.find(c => c.id === match.challengeId);
    const scores = await db.select().from(matchScoresTable).where(eq(matchScoresTable.matchId, match.id));
    const [result] = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, match.id)).limit(1);
    return {
      ...match,
      challenge: challenge ? { ...challenge, challengerTeam: null, challengedTeam: null } : null,
      scores,
      result: result ?? null,
    };
  }));

  res.json(enriched);
});

router.patch("/teams/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body;
  if (!["pending", "active", "inactive"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [team] = await db.update(teamsTable).set({ status }).where(eq(teamsTable.id, id)).returning();
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  const enriched = await enrichTeam(team);
  res.json(enriched);
});

export { enrichTeam };
export default router;
