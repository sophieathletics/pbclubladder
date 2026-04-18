import { Router, type IRouter } from "express";
import express from "express";
import { db, teamsTable, playersTable, ladderStandingsTable, seasonsTable, laddersTable, matchesTable, matchScoresTable, matchResultsTable, challengesTable, teamInvitationsTable } from "@workspace/db";
import { eq, and, or, ilike, desc, asc, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { sanitizePlayer } from "./auth";
import { refundPlayer } from "./payments";
import { sendTeamWithdrawnEmail, sendWithdrawalConfirmationEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Returns blocking reason if team has played matches or has open challenges; null if safe to dissolve.
async function checkDissolveBlockers(teamId: string): Promise<string | null> {
  // Any played (completed) matches involving this team?
  const challenges = await db.select().from(challengesTable).where(
    or(eq(challengesTable.challengerTeamId, teamId), eq(challengesTable.challengedTeamId, teamId))
  );
  if (challenges.length > 0) {
    const challengeIds = challenges.map(c => c.id);
    const completed = await db.select().from(matchesTable).where(
      and(eq(matchesTable.status, "completed"), inArray(matchesTable.challengeId, challengeIds))
    );
    if (completed.length > 0) {
      return "Cannot withdraw — your team has already played a match in this ladder.";
    }
    // Any open (non-cancelled, non-completed) challenges?
    // Mirror the active set used in routes/challenges.ts to keep semantics consistent.
    const openStatuses = ["pending", "accepted", "scheduling", "scheduled"];
    const openCount = challenges.filter(c => openStatuses.includes(c.status)).length;
    if (openCount > 0) {
      return "Cannot withdraw — you have an active challenge. Cancel or finish it first.";
    }
  }
  return null;
}

router.post("/teams/:id/withdraw", requireAuth, express.json(), async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Atomically lock the team row, validate state, mark withdrawn, and clear standings.
  // Refunds are issued AFTER the row is claimed so concurrent withdraw attempts can't double-process.
  let team: any;
  let claimError: { code: number; msg: string } | null = null;
  try {
    team = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT * FROM ${teamsTable} WHERE id = ${id} FOR UPDATE`
      );
      const row = (locked as any).rows?.[0] ?? (Array.isArray(locked) ? locked[0] : null);
      if (!row) { claimError = { code: 404, msg: "Team not found" }; return null; }
      if (row.player1_id !== player.id && row.player2_id !== player.id) {
        claimError = { code: 403, msg: "You are not on this team" }; return null;
      }
      if (row.withdrawn_at) {
        claimError = { code: 400, msg: "This team has already been withdrawn" }; return null;
      }
      const blocker = await checkDissolveBlockers(row.id);
      if (blocker) { claimError = { code: 400, msg: blocker }; return null; }

      await tx.update(teamsTable).set({
        status: "withdrawn",
        withdrawnAt: new Date(),
        withdrawnReason: "self",
      }).where(eq(teamsTable.id, row.id));
      await tx.delete(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, row.id));

      return {
        id: row.id,
        player1Id: row.player1_id,
        player2Id: row.player2_id,
        teamName: row.team_name,
      };
    });
  } catch (err: any) {
    logger.error({ err, teamId: id }, "Withdraw transaction failed");
    res.status(500).json({ error: "Failed to withdraw" });
    return;
  }
  if (claimError) {
    res.status(claimError.code).json({ error: claimError.msg });
    return;
  }
  if (!team) {
    res.status(500).json({ error: "Withdraw failed" });
    return;
  }

  // Refund both players (eligible only when within 48h of paying). After commit so a Stripe
  // failure doesn't block the dissolution; refundPlayer is itself idempotent via its own gating.
  const r1 = await refundPlayer(team.id, 1, false);
  const r2 = await refundPlayer(team.id, 2, false);

  // Notify partner
  const partnerId = team.player1Id === player.id ? team.player2Id : team.player1Id;
  const [partner] = await db.select().from(playersTable).where(eq(playersTable.id, partnerId)).limit(1);
  const partnerRefund = team.player1Id === partnerId ? r1.amountCents : r2.amountCents;
  const myRefund = team.player1Id === player.id ? r1.amountCents : r2.amountCents;
  if (partner?.email) {
    sendTeamWithdrawnEmail(partner.email, team.teamName, player.fullName, partnerRefund);
  }
  if (player.email) {
    sendWithdrawalConfirmationEmail(player.email, team.teamName, myRefund);
  }
  if (partnerId) {
    notifyPlayers([partnerId], "team_withdrawn", `${player.fullName} withdrew from "${team.teamName}". The team has been dissolved.`, "/team");
  }

  logger.info({ teamId: team.id, playerId: player.id, r1, r2 }, "Team withdrawn (self)");

  res.json({
    ok: true,
    refundedAmountCents: myRefund,
    refundIssued: (myRefund ?? 0) > 0,
    partnerRefundedAmountCents: partnerRefund,
  });
});

async function enrichTeam(team: any) {
  const [p1, p2] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1),
    db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1),
  ]);
  const [standing] = await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, team.id)).limit(1);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, team.seasonId)).limit(1);
  let ladder: any = null;
  if (season?.ladderId) {
    [ladder] = await db.select().from(laddersTable).where(eq(laddersTable.id, season.ladderId)).limit(1);
  }
  return {
    ...team,
    player1: p1[0] ? sanitizePlayer(p1[0]) : null,
    player2: p2[0] ? sanitizePlayer(p2[0]) : null,
    standing: standing ?? null,
    season: season ? { ...season, ladder: ladder ?? null } : null,
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
      and(
        eq(teamsTable.seasonId, s.id),
        or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)),
        isNull(teamsTable.withdrawnAt),
      )
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
