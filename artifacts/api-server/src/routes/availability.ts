import { Router, type IRouter } from "express";
import { db, availabilityTable, challengesTable, teamsTable, seasonsTable, playersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { findOverlappingSlots } from "../lib/ladder";
import { sendAvailabilitySubmittedEmail, sendCommonAvailabilityEmail, sendNoCommonAvailabilityEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";

const router: IRouter = Router();

router.get("/availability/:challengeId", requireAuth, async (req, res): Promise<void> => {
  const challengeId = Array.isArray(req.params.challengeId) ? req.params.challengeId[0] : req.params.challengeId;

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  const avail = await db.select().from(availabilityTable).where(eq(availabilityTable.challengeId, challengeId));
  const challengerAvail = avail.find(a => a.teamId === challenge.challengerTeamId) ?? null;
  const challengedAvail = avail.find(a => a.teamId === challenge.challengedTeamId) ?? null;

  let overlappingSlots: any[] = [];
  if (challengerAvail && challengedAvail) {
    overlappingSlots = findOverlappingSlots(challengerAvail.slots as any[], challengedAvail.slots as any[]);
  }

  res.json({
    challengerAvailability: challengerAvail,
    challengedAvailability: challengedAvail,
    overlappingSlots,
    hasOverlap: overlappingSlots.length > 0,
  });
});

router.post("/availability/:challengeId", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const challengeId = Array.isArray(req.params.challengeId) ? req.params.challengeId[0] : req.params.challengeId;
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots)) {
    res.status(400).json({ error: "slots array is required" });
    return;
  }

  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
  if (!challenge || !["accepted", "scheduling"].includes(challenge.status)) {
    res.status(400).json({ error: "Challenge not found or not in correct state" });
    return;
  }

  // Find player's team
  const [active] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  const [myTeam] = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, active!.id), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);

  if (!myTeam || (myTeam.id !== challenge.challengerTeamId && myTeam.id !== challenge.challengedTeamId)) {
    res.status(403).json({ error: "You are not part of this challenge" });
    return;
  }

  // Upsert availability
  const existing = await db.select().from(availabilityTable)
    .where(and(eq(availabilityTable.challengeId, challengeId), eq(availabilityTable.teamId, myTeam.id)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(availabilityTable)
      .set({ slots, submittedAt: new Date() })
      .where(and(eq(availabilityTable.challengeId, challengeId), eq(availabilityTable.teamId, myTeam.id)));
  } else {
    await db.insert(availabilityTable).values({ challengeId, teamId: myTeam.id, slots });
  }

  // Update challenge status to scheduling
  await db.update(challengesTable).set({ status: "scheduling" }).where(eq(challengesTable.id, challengeId));

  // Get both availability submissions
  const avail = await db.select().from(availabilityTable).where(eq(availabilityTable.challengeId, challengeId));
  const challengerAvail = avail.find(a => a.teamId === challenge.challengerTeamId) ?? null;
  const challengedAvail = avail.find(a => a.teamId === challenge.challengedTeamId) ?? null;

  // Notify other team
  const otherTeamId = myTeam.id === challenge.challengerTeamId ? challenge.challengedTeamId : challenge.challengerTeamId;
  const [otherTeam] = await db.select().from(teamsTable).where(eq(teamsTable.id, otherTeamId)).limit(1);
  if (otherTeam) {
    const [p1, p2] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, otherTeam.player1Id)).limit(1),
      db.select().from(playersTable).where(eq(playersTable.id, otherTeam.player2Id)).limit(1),
    ]);
    const emails = [p1[0]?.email, p2[0]?.email].filter(Boolean) as string[];
    const playerIds = [p1[0]?.id, p2[0]?.id].filter(Boolean) as string[];
    sendAvailabilitySubmittedEmail(emails, myTeam.teamName, challengeId);
    notifyPlayers(playerIds, "availability_submitted", `${myTeam.teamName} submitted their availability.`, `/availability/${challengeId}`);
  }

  // If both have submitted, check for overlap
  if (challengerAvail && challengedAvail) {
    const overlappingSlots = findOverlappingSlots(challengerAvail.slots as any[], challengedAvail.slots as any[]);

    // Notify all 4 players
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

    if (overlappingSlots.length > 0) {
      const slotStrings = overlappingSlots.flatMap(s => s.times.map((t: string) => `${s.date} at ${t}`));
      sendCommonAvailabilityEmail(allEmails, slotStrings, challengeId);
      notifyPlayers(allPlayerIds, "common_availability", "Common availability found! Book your court.", `/challenges/${challengeId}`);
    } else {
      const team1Info = `${challengerTeam[0]?.teamName}`;
      const team2Info = `${challengedTeam[0]?.teamName}`;
      sendNoCommonAvailabilityEmail(allEmails, team1Info, team2Info);
      notifyPlayers(allPlayerIds, "no_common_availability", "No common availability found. Please coordinate directly.", `/challenges/${challengeId}`);
    }

    const overlapping = findOverlappingSlots(challengerAvail.slots as any[], challengedAvail.slots as any[]);
    res.json({
      challengerAvailability: challengerAvail,
      challengedAvailability: challengedAvail,
      overlappingSlots: overlapping,
      hasOverlap: overlapping.length > 0,
    });
    return;
  }

  res.json({
    challengerAvailability: challengerAvail,
    challengedAvailability: challengedAvail,
    overlappingSlots: [],
    hasOverlap: false,
  });
});

export default router;
