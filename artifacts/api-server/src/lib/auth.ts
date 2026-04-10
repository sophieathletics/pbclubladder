import { type Request, type Response, type NextFunction } from "express";
import { db, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { logger } from "./logger";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "default-secret-change-me";
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHmac("sha256", salt).update(password).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const newHash = createHmac("sha256", salt).update(password).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(newHash, "hex"));
  } catch {
    return false;
  }
}

export function createToken(playerId: string): string {
  const payload = `${playerId}:${Date.now()}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function parseToken(token: string): { playerId: string; issuedAt: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    const secondLastColon = decoded.lastIndexOf(":", lastColon - 1);
    const payload = decoded.substring(0, lastColon);
    const sig = decoded.substring(lastColon + 1);
    const expectedSig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    const parts = payload.split(":");
    if (parts.length < 2) return null;
    const issuedAt = parseInt(parts[parts.length - 1], 10);
    const playerId = parts.slice(0, -1).join(":");
    if (Date.now() - issuedAt > TOKEN_EXPIRY_MS) return null;
    return { playerId, issuedAt };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.auth_token;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = parseToken(token);
  if (!parsed) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, parsed.playerId));
  if (!player || !player.isActive) {
    res.status(401).json({ error: "Player not found or deactivated" });
    return;
  }

  (req as Request & { player: typeof player }).player = player;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const player = (req as Request & { player: typeof playersTable.$inferSelect }).player;
    if (player.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Invalid cron secret" });
    return;
  }
  next();
}
