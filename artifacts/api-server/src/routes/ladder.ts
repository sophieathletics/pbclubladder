import { Router, type IRouter } from "express";
import { db, ladderStandingsTable, teamsTable, playersTable, seasonsTable, challengesTable, inactivityDropsTable } from "@workspace/db";
import { eq, and, or, asc, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { sanitizePublicPlayer } from "./auth";

const router: IRouter = Router();

async function enrichStanding(standing: any) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, standing.teamId)).limit(1);
  if (!team) return { ...standing, team: null };

  const [p1, p2] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1),
    db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1),
  ]);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, team.seasonId)).limit(1);

  return {
    ...standing,
    team: {
      ...team,
      player1: p1[0] ? sanitizePublicPlayer(p1[0]) : null,
      player2: p2[0] ? sanitizePublicPlayer(p2[0]) : null,
      standing,
      season: season ?? null,
    },
  };
}

router.get("/ladder", async (req, res): Promise<void> => {
  const { season_id, ladder_id, search, limit: limitQ, offset: offsetQ } = req.query;
  const limit = limitQ ? Math.min(parseInt(limitQ as string), 200) : 200;
  const offset = offsetQ ? parseInt(offsetQ as string) : 0;

  // Resolve season: explicit season_id > ladder_id's active season.
  // Only fall back to "any active season" when no ladder was specified —
  // otherwise we'd leak a different ladder's standings under the requested one.
  let seasonId = season_id as string | undefined;
  if (!seasonId && ladder_id) {
    const [active] = await db.select().from(seasonsTable)
      .where(and(eq(seasonsTable.ladderId, ladder_id as string), eq(seasonsTable.isActive, true)))
      .limit(1);
    seasonId = active?.id;
  } else if (!seasonId && !ladder_id) {
    const [active] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
    seasonId = active?.id;
  }

  if (!seasonId) {
    res.json({ season: null, standings: [], total: 0 });
    return;
  }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId));
  let standings = await db.select().from(ladderStandingsTable)
    .where(eq(ladderStandingsTable.seasonId, seasonId))
    .orderBy(asc(ladderStandingsTable.position));

  const total = standings.length;
  const enriched = await Promise.all(standings.slice(offset, offset + limit).map(enrichStanding));

  let result = enriched;
  if (search) {
    const s = (search as string).toLowerCase();
    result = enriched.filter(e =>
      e.team?.teamName?.toLowerCase().includes(s) ||
      e.team?.player1?.fullName?.toLowerCase().includes(s) ||
      e.team?.player2?.fullName?.toLowerCase().includes(s)
    );
  }

  res.json({ season, standings: result, total });
});

router.get("/ladder/top", async (_req, res): Promise<void> => {
  const activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
  if (activeSeasons.length === 0) {
    res.json([]);
    return;
  }

  // Pick the season with the most standings so the home page always shows a populated ladder
  let bestSeasonId = activeSeasons[0].id;
  let bestCount = 0;
  for (const season of activeSeasons) {
    const rows = await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.seasonId, season.id));
    if (rows.length > bestCount) {
      bestCount = rows.length;
      bestSeasonId = season.id;
    }
  }

  if (bestCount === 0) {
    res.json([]);
    return;
  }

  const standings = await db.select().from(ladderStandingsTable)
    .where(eq(ladderStandingsTable.seasonId, bestSeasonId))
    .orderBy(asc(ladderStandingsTable.position))
    .limit(10);

  const enriched = await Promise.all(standings.map(enrichStanding));
  res.json(enriched);
});

router.get("/ladder/my-position", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const ladderId = req.query.ladder_id as string | undefined;

  let active: any = null;
  if (ladderId) {
    [active] = await db.select().from(seasonsTable)
      .where(and(eq(seasonsTable.ladderId, ladderId), eq(seasonsTable.isActive, true)))
      .limit(1);
  } else {
    // Pick the first active season where the player has a team
    const allActive = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
    for (const s of allActive) {
      const [t] = await db.select().from(teamsTable).where(
        and(eq(teamsTable.seasonId, s.id), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
      ).limit(1);
      if (t) { active = s; break; }
    }
    if (!active) active = allActive[0];
  }

  if (!active) {
    res.json({ myStanding: null, challengeableTeams: [], hasActiveChallenge: false });
    return;
  }

  // Find player's team
  const [myTeam] = await db.select().from(teamsTable).where(
    and(
      eq(teamsTable.seasonId, active.id),
      or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id))
    )
  ).limit(1);

  if (!myTeam) {
    res.json({ myStanding: null, challengeableTeams: [], hasActiveChallenge: false });
    return;
  }

  const [myStandingRaw] = await db.select().from(ladderStandingsTable)
    .where(and(eq(ladderStandingsTable.seasonId, active.id), eq(ladderStandingsTable.teamId, myTeam.id)))
    .limit(1);

  if (!myStandingRaw) {
    res.json({ myStanding: null, challengeableTeams: [], hasActiveChallenge: false });
    return;
  }

  const myStanding = await enrichStanding(myStandingRaw);

  // Get teams 1-3 spots above
  const challengePositions = [myStandingRaw.position - 1, myStandingRaw.position - 2, myStandingRaw.position - 3].filter(p => p >= 1);
  const allStandings = await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.seasonId, active.id));
  const inRangeRaw = allStandings.filter(s => challengePositions.includes(s.position));

  // Find all teams currently in an active challenge so we can exclude them
  const seasonChallenges = await db.select().from(challengesTable).where(eq(challengesTable.seasonId, active.id));
  const busyTeamIds = new Set<string>();
  for (const c of seasonChallenges) {
    if (["pending", "accepted", "scheduling", "scheduled"].includes(c.status)) {
      busyTeamIds.add(c.challengerTeamId);
      busyTeamIds.add(c.challengedTeamId);
    }
  }
  const eligibleRaw = inRangeRaw.filter(s => !busyTeamIds.has(s.teamId));
  const challengeableTeams = await Promise.all(eligibleRaw.map(enrichStanding));

  // Check whether this player's own team has an active challenge
  const hasActiveChallenge = busyTeamIds.has(myTeam.id);

  res.json({ myStanding, challengeableTeams, hasActiveChallenge, teamsInRange: inRangeRaw.length });
});

router.patch("/ladder/:id/position", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { position } = req.body;
  if (!position || typeof position !== "number") {
    res.status(400).json({ error: "position (number) is required" });
    return;
  }

  const [standing] = await db.update(ladderStandingsTable).set({ position }).where(eq(ladderStandingsTable.id, id)).returning();
  if (!standing) {
    res.status(404).json({ error: "Standing not found" });
    return;
  }
  const enriched = await enrichStanding(standing);
  res.json(enriched);
});

router.get("/ladder/inactivity-log", requireAdmin, async (_req, res): Promise<void> => {
  const drops = await db.select().from(inactivityDropsTable).orderBy(desc(inactivityDropsTable.droppedAt)).limit(100);
  const enriched = await Promise.all(drops.map(async (drop) => {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, drop.teamId)).limit(1);
    return { ...drop, team: team ?? null };
  }));
  res.json(enriched);
});

export { enrichStanding };
export default router;
