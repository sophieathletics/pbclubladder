import { Router, type IRouter } from "express";
import { db, matchesTable, matchScoresTable, matchResultsTable, challengesTable, teamsTable, playersTable, seasonsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { applyMatchResult } from "../lib/ladder";
import { sendScoreSubmittedEmail, sendScoreConfirmedEmail, sendDisputeFiledEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";
import { enrichChallenge } from "./challenges";

const router: IRouter = Router();

async function enrichMatch(match: any, myTeamId?: string) {
  const challenge = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1).then(r => r[0]);
  const scores = await db.select().from(matchScoresTable).where(eq(matchScoresTable.matchId, match.id));
  const [result] = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, match.id)).limit(1);

  let enrichedChallenge = null;
  if (challenge) {
    enrichedChallenge = await enrichChallenge(challenge, myTeamId);
  }

  return { ...match, challenge: enrichedChallenge, scores, result: result ?? null };
}

router.get("/matches", requireAuth, async (req, res): Promise<void> => {
  const { season_id, status, team_id } = req.query;

  let challenges = await db.select().from(challengesTable);
  if (season_id) challenges = challenges.filter(c => c.seasonId === season_id);
  if (team_id) challenges = challenges.filter(c => c.challengerTeamId === team_id || c.challengedTeamId === team_id);
  const challengeIds = challenges.map(c => c.id);

  if (challengeIds.length === 0) {
    res.json([]);
    return;
  }

  let matches = await db.select().from(matchesTable).orderBy(desc(matchesTable.scheduledDate));
  matches = matches.filter(m => challengeIds.includes(m.challengeId));
  if (status) matches = matches.filter(m => m.status === status);

  const enriched = await Promise.all(matches.map(m => enrichMatch(m)));
  res.json(enriched);
});

router.get("/matches/:id", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [challengeForView] = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1);
  let myTeamId: string | undefined;
  if (challengeForView) {
    const [myTeam] = await db.select().from(teamsTable).where(
      and(eq(teamsTable.seasonId, challengeForView.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
    ).limit(1);
    myTeamId = myTeam?.id;
  }

  const enriched = await enrichMatch(match, myTeamId);
  res.json(enriched);
});

router.post("/matches/:id/score", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { games, winnerTeamId } = req.body;

  if (!games || !Array.isArray(games) || !winnerTeamId) {
    res.status(400).json({ error: "games array and winnerTeamId are required" });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);

  if (!myTeam || (myTeam.id !== challenge.challengerTeamId && myTeam.id !== challenge.challengedTeamId)) {
    res.status(403).json({ error: "You are not part of this match" });
    return;
  }

  // Check no score submitted yet
  const existing = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, id)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Score already submitted" });
    return;
  }

  const loserTeamId = winnerTeamId === challenge.challengerTeamId ? challenge.challengedTeamId : challenge.challengerTeamId;

  // Insert scores
  for (const game of games) {
    await db.insert(matchScoresTable).values({
      matchId: id,
      gameNumber: game.gameNumber,
      team1Score: game.team1Score,
      team2Score: game.team2Score,
    });
  }

  // Insert result
  const [result] = await db.insert(matchResultsTable).values({
    matchId: id,
    winnerTeamId,
    loserTeamId,
    submittedByTeamId: myTeam.id,
    autoConfirmed: false,
    disputeResolved: false,
  }).returning();

  await db.update(matchesTable).set({ status: "completed" }).where(eq(matchesTable.id, id));
  await db.update(challengesTable).set({ status: "completed" }).where(eq(challengesTable.id, match.challengeId));

  // Notify opposing team
  const otherTeamId = myTeam.id === challenge.challengerTeamId ? challenge.challengedTeamId : challenge.challengerTeamId;
  const [otherTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, otherTeamId)).limit(1);
  if (otherTeam) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, otherTeam.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, otherTeam.player2Id)).limit(1),
    ]);
    const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
    const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];
    const scoreStr = games.map((g: any) => `Game ${g.gameNumber}: ${g.team1Score}-${g.team2Score}`).join(", ");
    sendScoreSubmittedEmail(emails, myTeam.teamName, scoreStr, id);
    notifyPlayers(playerIds, "score_submitted", `${myTeam.teamName} submitted the match score. Please confirm or dispute.`, `/matches/${id}`);
  }

  const enriched = await enrichMatch({ ...match, status: "completed" }, myTeam.id);
  res.json(enriched);
});

router.post("/matches/:id/confirm", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }
  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);

  if (!myTeam || (myTeam.id !== challenge.challengerTeamId && myTeam.id !== challenge.challengedTeamId)) {
    res.status(403).json({ error: "You are not part of this match" });
    return;
  }

  const [result] = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, id)).limit(1);
  if (!result || result.confirmedAt || result.disputeReason) {
    res.status(400).json({ error: "Score not found, already confirmed, or disputed" });
    return;
  }

  // Only opposing team can confirm
  if (myTeam.id === result.submittedByTeamId) {
    res.status(400).json({ error: "You cannot confirm your own submission" });
    return;
  }

  const now = new Date();
  await db.update(matchResultsTable).set({ confirmedAt: now, confirmedByTeamId: myTeam.id }).where(eq(matchResultsTable.matchId, id));

  // Apply ladder changes
  if (result.winnerTeamId && result.loserTeamId && challenge) {
    await applyMatchResult(challenge.seasonId, result.winnerTeamId, result.loserTeamId, challenge.challengerTeamId);
  }

  // Notify all players
  const [challengerTeam, challengedTeam] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge!.challengerTeamId)).limit(1),
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge!.challengedTeamId)).limit(1),
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

  const scores = await db.select().from(matchScoresTable).where(eq(matchScoresTable.matchId, id));
  const scoreStr = scores.map(s => `Game ${s.gameNumber}: ${s.team1Score}-${s.team2Score}`).join(", ");
  const [winnerTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, result.winnerTeamId!)).limit(1);
  sendScoreConfirmedEmail(allEmails, winnerTeam?.teamName ?? "Unknown", scoreStr, id);
  notifyPlayers(allPlayerIds, "score_confirmed", "Match result confirmed! Rankings have been updated.", `/matches/${id}`);

  const enriched = await enrichMatch(match, myTeam.id);
  res.json(enriched);
});

router.post("/matches/:id/dispute", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body;

  if (!reason) {
    res.status(400).json({ error: "Dispute reason is required" });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, match.challengeId)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }
  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);

  if (!myTeam || (myTeam.id !== challenge.challengerTeamId && myTeam.id !== challenge.challengedTeamId)) {
    res.status(403).json({ error: "You are not part of this match" });
    return;
  }

  const [result] = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, id)).limit(1);
  if (!result || result.confirmedAt) {
    res.status(400).json({ error: "Score not found or already confirmed" });
    return;
  }

  await db.update(matchResultsTable).set({ disputeReason: reason }).where(eq(matchResultsTable.matchId, id));
  await db.update(matchesTable).set({ status: "disputed" }).where(eq(matchesTable.id, id));
  await db.update(challengesTable).set({ status: "disputed" }).where(eq(challengesTable.id, match.challengeId));

  // Collect contact info and notify admin
  const [challengerTeam, challengedTeam] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge!.challengerTeamId)).limit(1),
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge!.challengedTeamId)).limit(1),
  ]);
  const contacts: string[] = [];
  for (const t of [challengerTeam[0], challengedTeam[0]].filter(Boolean)) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, t.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, t.player2Id)).limit(1),
    ]);
    for (const p of [p1[0], p2[0]].filter(Boolean)) {
      contacts.push(`${p!.fullName} (${p!.email})`);
    }
  }

  const scores = await db.select().from(matchScoresTable).where(eq(matchScoresTable.matchId, id));
  const scoreStr = scores.map(s => `Game ${s.gameNumber}: ${s.team1Score}-${s.team2Score}`).join(", ");
  sendDisputeFiledEmail(
    challengerTeam[0]?.teamName ?? "", challengedTeam[0]?.teamName ?? "",
    scoreStr, reason, id, contacts.join(", ")
  );

  const enriched = await enrichMatch({ ...match, status: "disputed" }, myTeam.id);
  res.json(enriched);
});

export { enrichMatch };
export default router;
