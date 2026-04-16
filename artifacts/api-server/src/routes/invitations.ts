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
  const invitee = inv.inviteeId
    ? await db.select().from(playersTable).where(eq(playersTable.id, inv.inviteeId)).limit(1).then(r => r[0] ?? null)
    : null;
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
  const { inviteeId, inviteeEmail, teamName } = req.body;

  if (!teamName) {
    res.status(400).json({ error: "teamName is required" });
    return;
  }
  if (!inviteeId && !inviteeEmail) {
    res.status(400).json({ error: "inviteeId or inviteeEmail is required" });
    return;
  }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) {
    res.status(400).json({ error: "No active season" });
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

  // Resolve invitee — look up by ID or email
  let resolvedInviteeId: string | null = inviteeId ?? null;
  let resolvedEmail: string | null = inviteeEmail ?? null;

  if (!resolvedInviteeId && resolvedEmail) {
    // Try to find existing player by email
    const [found] = await db.select().from(playersTable).where(eq(playersTable.email, resolvedEmail.toLowerCase().trim())).limit(1);
    if (found) {
      resolvedInviteeId = found.id;
      resolvedEmail = null;
    }
  }

  // Can't invite yourself
  if (resolvedInviteeId === player.id) {
    res.status(400).json({ error: "You cannot invite yourself" });
    return;
  }

  // If resolved to a known player, make sure they're not already on a team
  if (resolvedInviteeId) {
    const existingTeam = await db.select().from(teamsTable).where(
      and(eq(teamsTable.seasonId, activeSeason.id), or(eq(teamsTable.player1Id, resolvedInviteeId), eq(teamsTable.player2Id, resolvedInviteeId)))
    ).limit(1);
    if (existingTeam.length > 0) {
      res.status(400).json({ error: "That player is already on a team this season" });
      return;
    }
  }

  const [inv] = await db.insert(teamInvitationsTable).values({
    seasonId: activeSeason.id,
    inviterId: player.id,
    inviteeId: resolvedInviteeId ?? undefined,
    inviteeEmail: resolvedEmail ?? undefined,
    teamName,
    status: "pending",
  } as any).returning();

  // Send email — either to the registered player or the external address
  const emailTarget = resolvedEmail ?? (resolvedInviteeId
    ? await db.select().from(playersTable).where(eq(playersTable.id, resolvedInviteeId)).limit(1).then(r => r[0]?.email ?? null)
    : null);

  if (emailTarget) {
    sendTeamInvitationEmail(emailTarget, player.fullName, teamName, activeSeason.name);
  }

  if (resolvedInviteeId) {
    notifyPlayers([resolvedInviteeId], "invitation_received", `${player.fullName} invited you to join team "${teamName}"`, "/team");
  }

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
    player2Id: inv.inviteeId!,
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

router.post("/invitations/:id/resend", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [inv] = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.id, id)).limit(1);
  if (!inv || inv.inviterId !== player.id) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (inv.status !== "pending") {
    res.status(400).json({ error: "Can only resend pending invitations" });
    return;
  }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, inv.seasonId)).limit(1);
  const seasonName = season?.name ?? "current season";

  const emailTarget = inv.inviteeEmail ?? (inv.inviteeId
    ? await db.select().from(playersTable).where(eq(playersTable.id, inv.inviteeId)).limit(1).then(r => r[0]?.email ?? null)
    : null);

  if (!emailTarget) {
    res.status(400).json({ error: "No email address on file for this invitation" });
    return;
  }

  sendTeamInvitationEmail(emailTarget, player.fullName, inv.teamName, seasonName);

  if (inv.inviteeId) {
    notifyPlayers([inv.inviteeId], "invitation_received", `${player.fullName} resent their invitation for team "${inv.teamName}"`, "/team");
  }

  res.json({ success: true, message: "Invitation resent" });
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
