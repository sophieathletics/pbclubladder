import { Router, type IRouter } from "express";
import { db, teamInvitationsTable, teamsTable, playersTable, ladderStandingsTable, seasonsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sanitizePlayer } from "./auth";
import { sendTeamInvitationEmail, sendInvitationAcceptedEmail, sendInvitationDeclinedEmail } from "../lib/email";
import { notifyPlayers } from "../lib/notifications";

const router: IRouter = Router();

async function enrichInvitation(inv: any) {
  const [inviter] = await db.select().from(playersTable).where(eq(playersTable.id, inv.inviterId)).limit(1);
  const [invitee] = await db.select().from(playersTable).where(eq(playersTable.id, inv.inviteeId)).limit(1);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, inv.seasonId)).limit(1);
  return {
    ...inv,
    inviter: inviter ? sanitizePlayer(inviter) : null,
    invitee: invitee ? sanitizePlayer(invitee) : null,
    season: season ?? null,
  };
}

router.get("/invitations", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const sent = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.inviterId, player.id));
  const received = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.inviteeId, player.id));
  res.json({
    sent: await Promise.all(sent.map(enrichInvitation)),
    received: await Promise.all(received.map(enrichInvitation)),
  });
});

router.post("/invitations", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const { inviteeId, teamName } = req.body;

  if (!inviteeId || !teamName) {
    res.status(400).json({ error: "inviteeId and teamName are required" });
    return;
  }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) {
    res.status(400).json({ error: "No active season" });
    return;
  }

  // Check invitee is not already on a team
  const existingTeam = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, activeSeason.id), or(eq(teamsTable.player1Id, inviteeId), eq(teamsTable.player2Id, inviteeId)))
  ).limit(1);
  if (existingTeam.length > 0) {
    res.status(400).json({ error: "That player is already on a team this season" });
    return;
  }

  // Check inviter not already on a team
  const inviterTeam = await db.select().from(teamsTable).where(
    and(eq(teamsTable.seasonId, activeSeason.id), or(eq(teamsTable.player1Id, player.id), eq(teamsTable.player2Id, player.id)))
  ).limit(1);
  if (inviterTeam.length > 0) {
    res.status(400).json({ error: "You are already on a team this season" });
    return;
  }

  const [inv] = await db.insert(teamInvitationsTable).values({
    seasonId: activeSeason.id,
    inviterId: player.id,
    inviteeId,
    teamName,
    status: "pending",
  }).returning();

  const [invitee] = await db.select().from(playersTable).where(eq(playersTable.id, inviteeId)).limit(1);
  if (invitee?.email) {
    sendTeamInvitationEmail(invitee.email, player.fullName, teamName, activeSeason.name);
  }
  notifyPlayers([inviteeId], "invitation_received", `${player.fullName} invited you to join team "${teamName}"`, "/team");

  const enriched = await enrichInvitation(inv);
  res.status(201).json(enriched);
});

router.post("/invitations/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [inv] = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.id, id)).limit(1);
  if (!inv || inv.inviteeId !== player.id) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (inv.status !== "pending") {
    res.status(400).json({ error: "Invitation is no longer pending" });
    return;
  }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) {
    res.status(400).json({ error: "No active season" });
    return;
  }

  // Create team
  const [team] = await db.insert(teamsTable).values({
    seasonId: inv.seasonId,
    player1Id: inv.inviterId,
    player2Id: inv.inviteeId,
    teamName: inv.teamName,
    status: "active",
  }).returning();

  // Determine next position (add to bottom of ladder)
  const standings = await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.seasonId, inv.seasonId));
  const nextPos = standings.length + 1;

  await db.insert(ladderStandingsTable).values({
    seasonId: inv.seasonId,
    teamId: team.id,
    position: nextPos,
    wins: 0,
    losses: 0,
  });

  await db.update(teamInvitationsTable).set({ status: "accepted" }).where(eq(teamInvitationsTable.id, id));

  const [inviter] = await db.select().from(playersTable).where(eq(playersTable.id, inv.inviterId)).limit(1);
  if (inviter?.email) {
    sendInvitationAcceptedEmail(inviter.email, player.fullName, inv.teamName);
  }
  notifyPlayers([inv.inviterId], "invitation_accepted", `${player.fullName} accepted your invitation! Team "${inv.teamName}" is now active.`, "/team");

  const enriched = {
    ...team,
    player1: sanitizePlayer(inviter),
    player2: sanitizePlayer(player),
    standing: await db.select().from(ladderStandingsTable).where(eq(ladderStandingsTable.teamId, team.id)).limit(1).then(r => r[0] ?? null),
    season: activeSeason,
  };
  res.json(enriched);
});

router.post("/invitations/:id/decline", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [inv] = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.id, id)).limit(1);
  if (!inv || inv.inviteeId !== player.id) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (inv.status !== "pending") {
    res.status(400).json({ error: "Invitation is no longer pending" });
    return;
  }

  await db.update(teamInvitationsTable).set({ status: "declined" }).where(eq(teamInvitationsTable.id, id));

  const [inviter] = await db.select().from(playersTable).where(eq(playersTable.id, inv.inviterId)).limit(1);
  if (inviter?.email) {
    sendInvitationDeclinedEmail(inviter.email, player.fullName);
  }
  notifyPlayers([inv.inviterId], "invitation_declined", `${player.fullName} declined your team invitation.`, "/team");

  res.json({ success: true, message: "Invitation declined" });
});

export default router;
