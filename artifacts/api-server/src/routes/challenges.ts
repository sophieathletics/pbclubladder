import { Router, type IRouter } from "express";
import { db, challengesTable, teamsTable, ladderStandingsTable, seasonsTable, playersTable, availabilityTable, matchesTable, matchScoresTable, matchResultsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sanitizePlayer } from "./auth";
import { findOverlappingSlots } from "../lib/ladder";
import {
  sendChallengeReceivedEmail, sendChallengeAcceptedEmail, sendChallengeDeclinedEmail,
  sendMatchScheduledEmail
} from "../lib/email";
import { notifyPlayers } from "../lib/notifications";

const router: IRouter = Router();

async function enrichChallenge(challenge: any, myTeamId?: string) {
  const [challengerTeam, challengedTeam] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengerTeamId)).limit(1),
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengedTeamId)).limit(1),
  ]);

  const enrichTeam = async (team: any) => {
    if (!team) return null;
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, team.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, team.player2Id)).limit(1),
    ]);
    const [standing] = await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, team.id)).limit(1);
    const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, team.seasonId)).limit(1);
    return { ...team, player1: p1[0] ? sanitizePlayer(p1[0]) : null, player2: p2[0] ? sanitizePlayer(p2[0]) : null, standing: standing ?? null, season: season ?? null };
  };

  const [enrichedChallenger, enrichedChallenged] = await Promise.all([
    enrichTeam(challengerTeam[0]),
    enrichTeam(challengedTeam[0]),
  ]);

  // Get match if any
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.challengeId, challenge.id)).limit(1);
  let matchWithDetails = null;
  if (match) {
    const scores = await db.select().from(matchScoresTable).where(eq(matchScoresTable.matchId, match.id));
    const [result] = await db.select().from(matchResultsTable).where(eq(matchResultsTable.matchId, match.id)).limit(1);
    matchWithDetails = { ...match, scores, result: result ?? null, challenge: null };
  }

  // Get availability
  const avail = await db.select().from(availabilityTable).where(eq(availabilityTable.challengeId, challenge.id));
  const challengerAvail = avail.find(a => a.teamId === challenge.challengerTeamId);
  const challengedAvail = avail.find(a => a.teamId === challenge.challengedTeamId);

  let overlappingSlots: any[] = [];
  if (challengerAvail && challengedAvail) {
    overlappingSlots = findOverlappingSlots(
      challengerAvail.slots as any[],
      challengedAvail.slots as any[]
    );
  }

  return {
    ...challenge,
    challengerTeam: enrichedChallenger,
    challengedTeam: enrichedChallenged,
    match: matchWithDetails,
    myTeamId: myTeamId ?? null,
    overlappingSlots,
    challengerAvailabilitySubmitted: !!challengerAvail,
    challengedAvailabilitySubmitted: !!challengedAvail,
    challengerSlots: challengerAvail?.slots ?? [],
    challengedSlots: challengedAvail?.slots ?? [],
  };
}

router.get("/challenges", requireAuth, async (req, res): Promise<void> => {
  const { season_id, status, team_id } = req.query;
  let challenges = await db.select().from(challengesTable);

  if (season_id) challenges = challenges.filter(c => c.seasonId === season_id);
  if (status) challenges = challenges.filter(c => c.status === status);
  if (team_id) challenges = challenges.filter(c => c.challengerTeamId === team_id || c.challengedTeamId === team_id);

  const enriched = await Promise.all(challenges.map(c => enrichChallenge(c)));
  res.json(enriched);
});

router.get("/challenges/my-active", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const activeSeasons = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true));
  if (activeSeasons.length === 0) {
    res.status(404).json({ error: "No active season" });
    return;
  }

  const seasonIds = activeSeasons.map(s => s.id);
  const myTeams = (await db.select().from(teamsTable).where(
    or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id))
  )).filter(t => seasonIds.includes(t.seasonId));

  if (myTeams.length === 0) {
    res.status(404).json({ error: "No team found" });
    return;
  }

  const myTeamIds = myTeams.map(t => t.id);
  const challenges = await db.select().from(challengesTable);
  const myChallenges = challenges.filter(c =>
    seasonIds.includes(c.seasonId) &&
    (myTeamIds.includes(c.challengerTeamId) || myTeamIds.includes(c.challengedTeamId))
  );

  const activeChallenge = myChallenges.find(c => ["pending", "accepted", "scheduling", "scheduled"].includes(c.status));
  if (!activeChallenge) {
    res.status(404).json({ error: "No active challenge" });
    return;
  }

  const myTeamForChallenge = myTeams.find(t => t.seasonId === activeChallenge.seasonId);
  const enriched = await enrichChallenge(activeChallenge, myTeamForChallenge?.id);
  res.json(enriched);
});

router.get("/challenges/:id", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  // Find player's team in this challenge's season
  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);

  const enriched = await enrichChallenge(challenge, myTeam?.id);
  res.json(enriched);
});

router.post("/challenges", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  if (!player.emailVerified) {
    res.status(403).json({ error: "Please verify your email before doing this." });
    return;
  }
  const { challengedTeamId } = req.body;

  if (!challengedTeamId) {
    res.status(400).json({ error: "challengedTeamId is required" });
    return;
  }

  // Derive season from the challenged team, ensure it is active
  const [challengedTeamRow] = await db.select().from(teamsTable).where(eq(teamsTable.id, challengedTeamId)).limit(1);
  if (!challengedTeamRow) {
    res.status(404).json({ error: "Challenged team not found" });
    return;
  }
  const [active] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.id, challengedTeamRow.seasonId), eq(seasonsTable.isActive, true))).limit(1);
  if (!active) {
    res.status(400).json({ error: "Challenged team's season is not active" });
    return;
  }

  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, active.id), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);
  if (!myTeam) {
    res.status(400).json({ error: "You are not on a team in that ladder" });
    return;
  }
  if (myTeam.paymentStatus === "unpaid") {
    res.status(400).json({ error: "You can't challenge yet — you and your partner both need to pay your entry fees first." });
    return;
  }
  if (challengedTeamRow.paymentStatus === "unpaid") {
    res.status(400).json({ error: "That team can't be challenged yet — both of their players still need to pay their entry fees." });
    return;
  }

  // Check for existing active challenge
  const existing = await db.select().from(challengesTable).where(
    and(
      eq(challengesTable.seasonId, active.id),
      or(eq(challengesTable.challengerTeamId, myTeam.id), eq(challengesTable.challengedTeamId, myTeam.id))
    )
  );
  if (existing.some(c => ["pending", "accepted", "scheduling", "scheduled"].includes(c.status))) {
    res.status(400).json({ error: "You already have an active challenge" });
    return;
  }

  // Check position eligibility (must be 1-3 spots above)
  const [myStanding] = await db.select().from(ladderStandingsTable)
    .where(and(eq(ladderStandingsTable.seasonId, active.id), eq(ladderStandingsTable.teamId, myTeam.id))).limit(1);
  const [challengedStanding] = await db.select().from(ladderStandingsTable)
    .where(and(eq(ladderStandingsTable.seasonId, active.id), eq(ladderStandingsTable.teamId, challengedTeamId))).limit(1);

  if (!myStanding || !challengedStanding) {
    res.status(400).json({ error: "Team not found on ladder" });
    return;
  }

  const diff = myStanding.position - challengedStanding.position;
  if (diff < 1 || diff > 3) {
    res.status(400).json({ error: "You can only challenge teams that are 1-3 spots above you" });
    return;
  }

  // Check challenged team also doesn't have an active challenge
  const challengedExisting = await db.select().from(challengesTable).where(
    and(
      eq(challengesTable.seasonId, active.id),
      or(eq(challengesTable.challengerTeamId, challengedTeamId), eq(challengesTable.challengedTeamId, challengedTeamId))
    )
  );
  if (challengedExisting.some(c => ["pending", "accepted", "scheduling", "scheduled"].includes(c.status))) {
    res.status(400).json({ error: "That team already has an active challenge" });
    return;
  }

  const [challenge] = await db.insert(challengesTable).values({
    seasonId: active.id,
    challengerTeamId: myTeam.id,
    challengedTeamId,
    status: "pending",
  }).returning();

  // Notify challenged team
  const [challengedTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, challengedTeamId)).limit(1);
  if (challengedTeam) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, challengedTeam.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, challengedTeam.player2Id)).limit(1),
    ]);
    const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
    const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];

    sendChallengeReceivedEmail(emails, myTeam.teamName, challengedStanding.position, myStanding.position, challenge.id);
    notifyPlayers(playerIds, "challenge_received", `${myTeam.teamName} has challenged your team!`, `/challenges/${challenge.id}`);
  }

  const enriched = await enrichChallenge(challenge, myTeam.id);
  res.status(201).json(enriched);
});

router.post("/challenges/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  if (!player.emailVerified) {
    res.status(403).json({ error: "Please verify your email before doing this." });
    return;
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1);
  if (!challenge || challenge.status !== "pending") {
    res.status(400).json({ error: "Challenge not found or not pending" });
    return;
  }

  // Verify player is on challenged team (use challenge's season)
  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);
  if (!myTeam || myTeam.id !== challenge.challengedTeamId) {
    res.status(403).json({ error: "Only the challenged team can accept" });
    return;
  }

  const [updated] = await db.update(challengesTable).set({ status: "accepted" }).where(eq(challengesTable.id, id)).returning();

  // Notify challenger team
  const [challengerTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengerTeamId)).limit(1);
  if (challengerTeam) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, challengerTeam.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, challengerTeam.player2Id)).limit(1),
    ]);
    const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
    const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];
    sendChallengeAcceptedEmail(emails, myTeam.teamName, challenge.id);
    notifyPlayers(playerIds, "challenge_accepted", `${myTeam.teamName} accepted your challenge! Submit your availability.`, `/availability/${challenge.id}`);
  }

  const enriched = await enrichChallenge(updated, myTeam.id);
  res.json(enriched);
});

router.post("/challenges/:id/decline", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1);
  if (!challenge || challenge.status !== "pending") {
    res.status(400).json({ error: "Challenge not found or not pending" });
    return;
  }

  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);
  if (!myTeam || myTeam.id !== challenge.challengedTeamId) {
    res.status(403).json({ error: "Only the challenged team can decline" });
    return;
  }

  const [updated] = await db.update(challengesTable).set({ status: "cancelled" }).where(eq(challengesTable.id, id)).returning();

  const [challengerTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengerTeamId)).limit(1);
  if (challengerTeam) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, challengerTeam.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, challengerTeam.player2Id)).limit(1),
    ]);
    const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
    const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];
    sendChallengeDeclinedEmail(emails, myTeam.teamName);
    notifyPlayers(playerIds, "challenge_declined", `${myTeam.teamName} declined your challenge.`, "/challenge");
  }

  const enriched = await enrichChallenge(updated, myTeam.id);
  res.json(enriched);
});

router.post("/challenges/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  // Only allow cancelling challenges that are still in flight. Cancelling a
  // completed/disputed/cancelled challenge would silently overwrite a real outcome.
  const cancellableStatuses = ["pending", "accepted", "scheduling", "scheduled"];
  if (!cancellableStatuses.includes(challenge.status)) {
    res.status(400).json({ error: `Cannot cancel a challenge that is ${challenge.status}` });
    return;
  }

  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);
  if (!myTeam || (myTeam.id !== challenge.challengerTeamId && myTeam.id !== challenge.challengedTeamId)) {
    res.status(403).json({ error: "You are not part of this challenge" });
    return;
  }

  const [updated] = await db.update(challengesTable).set({ status: "cancelled" }).where(eq(challengesTable.id, id)).returning();
  const enriched = await enrichChallenge(updated, myTeam.id);
  res.json(enriched);
});

router.post("/challenges/:id/book", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { date, time, courtLocation } = req.body;

  if (!date || !time || !courtLocation) {
    res.status(400).json({ error: "date, time, and courtLocation are required" });
    return;
  }

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, challenge.seasonId), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);
  if (!myTeam || (myTeam.id !== challenge.challengerTeamId && myTeam.id !== challenge.challengedTeamId)) {
    res.status(403).json({ error: "You are not part of this challenge" });
    return;
  }

  const [match] = await db.insert(matchesTable).values({
    challengeId: id,
    scheduledDate: date,
    scheduledTime: time,
    courtLocation,
    bookedByTeamId: myTeam.id,
    status: "scheduled",
  }).returning();

  await db.update(challengesTable).set({ status: "scheduled" }).where(eq(challengesTable.id, id));

  // Notify all players
  const [challengerTeam, challengedTeam] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengerTeamId)).limit(1),
    db.select().from(teamsTable).where(eq(teamsTable.id, challenge.challengedTeamId)).limit(1),
  ]);

  const allPlayerIds: string[] = [];
  const allEmails: string[] = [];
  for (const t of [challengerTeam[0], challengedTeam[0]].filter(Boolean)) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, t.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, t.player2Id)).limit(1),
    ]);
    if (p1[0]) { allPlayerIds.push(p1[0].id); allEmails.push(p1[0].email); }
    if (p2[0]) { allPlayerIds.push(p2[0].id); allEmails.push(p2[0].email); }
  }

  sendMatchScheduledEmail(allEmails, date, time, courtLocation, challengerTeam[0]?.teamName ?? "", challengedTeam[0]?.teamName ?? "");
  notifyPlayers(allPlayerIds, "match_scheduled", `Match scheduled for ${date} at ${time} at ${courtLocation}`, `/matches/${match.id}`);

  const scores: any[] = [];
  const result = null;
  const updatedChallenge = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1).then(r => r[0]);
  const enrichedChallenge = updatedChallenge ? await enrichChallenge(updatedChallenge, myTeam.id) : null;

  res.json({ ...match, challenge: enrichedChallenge, scores, result });
});

export { enrichChallenge };
export default router;
