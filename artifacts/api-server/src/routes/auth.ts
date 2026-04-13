import { Router, type IRouter } from "express";
import { db, playersTable, teamInvitationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, createToken, requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { fullName, email, phone, password } = req.body;
  if (!fullName || !email || !password) {
    res.status(400).json({ error: "fullName, email and password are required" });
    return;
  }

  const existing = await db.select().from(playersTable).where(eq(playersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [player] = await db.insert(playersTable).values({
    fullName,
    email: email.toLowerCase(),
    phone: phone ?? null,
    passwordHash,
    role: "player",
    isActive: true,
  }).returning();

  // Link any pending email invitations sent to this address before they registered
  await db.update(teamInvitationsTable)
    .set({ inviteeId: player.id, inviteeEmail: null })
    .where(eq(teamInvitationsTable.inviteeEmail, player.email))
    .catch(() => {}); // non-fatal

  const token = createToken(player.id);

  res.status(201).json({
    player: sanitizePlayer(player),
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.email, email.toLowerCase())).limit(1);
  if (!player || !verifyPassword(password, player.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!player.isActive) {
    res.status(401).json({ error: "Account has been deactivated" });
    return;
  }

  const token = createToken(player.id);
  res.json({ player: sanitizePlayer(player), token });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  res.json(sanitizePlayer(player));
});

router.patch("/auth/me/update", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const { fullName, phone } = req.body;

  const [updated] = await db.update(playersTable)
    .set({ fullName: fullName ?? player.fullName, phone: phone !== undefined ? phone : player.phone })
    .where(eq(playersTable.id, player.id))
    .returning();

  res.json(sanitizePlayer(updated));
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  if (!verifyPassword(currentPassword, player.passwordHash)) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = hashPassword(newPassword);
  await db.update(playersTable).set({ passwordHash }).where(eq(playersTable.id, player.id));

  res.json({ success: true, message: "Password changed" });
});

export function sanitizePlayer(player: any) {
  const { passwordHash, ...safe } = player;
  return safe;
}

export default router;
