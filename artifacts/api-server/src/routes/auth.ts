import { Router, type IRouter } from "express";
import { db, playersTable, teamInvitationsTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { hashPassword, verifyPassword, createToken, requireAuth } from "../lib/auth";
import { sendPasswordResetEmail, sendVerificationEmail, sendNoTeamNudgeEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { firstName, lastName, email, phone, password, selfRating, sex, shareContact } = req.body;
  const finalFirst = (firstName ?? "").trim();
  const finalLast = (lastName ?? "").trim();
  const finalFullName = `${finalFirst} ${finalLast}`.trim();

  if (!finalFirst || !finalLast || !email || !password) {
    res.status(400).json({ error: "First name, last name, email and password are required" });
    return;
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }
  if (!selfRating) {
    res.status(400).json({ error: "Self-rating is required" });
    return;
  }
  const allowedSex = ["male", "female", "other"];
  if (!sex || !allowedSex.includes(sex)) {
    res.status(400).json({ error: "Sex must be one of: male, female, other" });
    return;
  }

  const existing = await db.select().from(playersTable).where(eq(playersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = hashPassword(password);
  const verificationToken = randomBytes(32).toString("hex");
  const [player] = await db.insert(playersTable).values({
    fullName: finalFullName,
    firstName: finalFirst || null,
    lastName: finalLast || null,
    email: email.toLowerCase(),
    phone: phone ?? null,
    selfRating: selfRating ?? null,
    sex: sex ?? null,
    shareContact: shareContact === true,
    passwordHash,
    role: "player",
    isActive: true,
    emailVerified: false,
    emailVerificationToken: verificationToken,
  }).returning();

  // Link any pending email invitations sent to this address before they registered
  await db.update(teamInvitationsTable)
    .set({ inviteeId: player.id, inviteeEmail: null })
    .where(eq(teamInvitationsTable.inviteeEmail, player.email))
    .catch(() => {}); // non-fatal

  try { sendVerificationEmail(player.email, verificationToken); } catch (e) { logger.error({ err: e }, "Failed to send verification email"); }
  try { sendNoTeamNudgeEmail(player.email, finalFirst, false); } catch (e) { logger.error({ err: e }, "Failed to send getting started email"); }

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
  const { fullName, phone, sex } = req.body;

  const allowedSex = ["male", "female", "other"];
  if (sex !== undefined && !allowedSex.includes(sex)) {
    res.status(400).json({ error: "Sex must be one of: male, female, other" });
    return;
  }

  const [updated] = await db.update(playersTable)
    .set({
      fullName: fullName ?? player.fullName,
      phone: phone !== undefined ? phone : player.phone,
      sex: sex !== undefined ? sex : player.sex,
    })
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
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const passwordHash = hashPassword(newPassword);
  await db.update(playersTable).set({ passwordHash }).where(eq(playersTable.id, player.id));

  res.json({ success: true, message: "Password changed" });
});

// Request a password reset link. Always returns 200 to avoid leaking which emails are registered.
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const [player] = await db.select().from(playersTable).where(eq(playersTable.email, normalized)).limit(1);

  if (player && player.isActive) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    try {
      await db.insert(passwordResetTokensTable).values({
        playerId: player.id,
        tokenHash,
        expiresAt,
      });
      const baseUrl = process.env.APP_URL ?? "https://pbclubladder.com";
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(normalized, resetUrl);
      logger.info({ playerId: player.id }, "Password reset email sent");
    } catch (err: any) {
      logger.error({ err: err?.message, playerId: player.id }, "Failed to issue password reset");
    }
  } else {
    logger.info({ email: normalized }, "Password reset requested for unknown email");
  }

  res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body ?? {};
  if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
    res.status(400).json({ error: "token and newPassword are required" });
    return;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();

  // Atomically claim the token: only one reset can succeed.
  const claimed = await db.update(passwordResetTokensTable)
    .set({ usedAt: now })
    .where(and(
      eq(passwordResetTokensTable.tokenHash, tokenHash),
      isNull(passwordResetTokensTable.usedAt),
      gt(passwordResetTokensTable.expiresAt, now),
    ))
    .returning();

  if (claimed.length === 0) {
    res.status(400).json({ error: "Reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const tokenRow = claimed[0];
  const passwordHash = hashPassword(newPassword);
  await db.update(playersTable).set({ passwordHash }).where(eq(playersTable.id, tokenRow.playerId));
  logger.info({ playerId: tokenRow.playerId }, "Password reset completed");

  res.json({ success: true, message: "Password updated. You can now sign in." });
});

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.emailVerificationToken, token)).limit(1);
  if (!player) {
    res.status(400).json({ error: "Invalid or expired verification link." });
    return;
  }
  await db.update(playersTable)
    .set({ emailVerified: true, emailVerificationToken: null })
    .where(eq(playersTable.id, player.id));
  res.json({ success: true, message: "Email verified!" });
});

router.post("/auth/resend-verification", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  if (player.emailVerified) {
    res.json({ success: true, message: "Email already verified" });
    return;
  }
  const verificationToken = randomBytes(32).toString("hex");
  await db.update(playersTable).set({ emailVerificationToken: verificationToken }).where(eq(playersTable.id, player.id));
  try { sendVerificationEmail(player.email, verificationToken); } catch (e) { logger.error({ err: e }, "Failed to send verification email"); }
  res.json({ success: true, message: "A new verification link has been sent. Any previous link is now invalid." });
});

export function sanitizePlayer(player: any) {
  const { passwordHash, emailVerificationToken, ...safe } = player;
  return safe;
}

// Use this when returning player data to OTHER users (public/leaderboard)
// Strips all PII — only returns what's needed for display
export function sanitizePublicPlayer(player: any) {
  const { passwordHash, email, phone, ...safe } = player;
  return safe;
}

export default router;
