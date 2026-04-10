import { Router, type IRouter } from "express";
import { db, playersTable, teamsTable, ladderStandingsTable, seasonsTable } from "@workspace/db";
import { eq, like, or, and, ilike } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sanitizePlayer } from "./auth";

const router: IRouter = Router();

router.get("/players", requireAuth, async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string || "20"), 100);

  let query = db.select().from(playersTable).where(eq(playersTable.isActive, true)).limit(limit);

  if (search) {
    const results = await db.select().from(playersTable)
      .where(
        and(
          eq(playersTable.isActive, true),
          or(ilike(playersTable.fullName, `%${search}%`), ilike(playersTable.email, `%${search}%`))
        )
      ).limit(limit);
    res.json(results.map(sanitizePlayer));
    return;
  }

  const results = await query;
  res.json(results.map(sanitizePlayer));
});

router.get("/players/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(sanitizePlayer(player));
});

export default router;
