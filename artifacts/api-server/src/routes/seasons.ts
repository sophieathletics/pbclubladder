import { Router, type IRouter } from "express";
import { db, seasonsTable, laddersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/seasons", async (req, res): Promise<void> => {
  const ladderId = req.query.ladder_id as string | undefined;
  let seasons = await db.select().from(seasonsTable).orderBy(seasonsTable.createdAt);
  if (ladderId) seasons = seasons.filter(s => s.ladderId === ladderId);
  res.json(seasons);
});

router.get("/seasons/active", async (req, res): Promise<void> => {
  const ladderId = req.query.ladder_id as string | undefined;
  if (ladderId) {
    const [season] = await db.select().from(seasonsTable)
      .where(and(eq(seasonsTable.ladderId, ladderId), eq(seasonsTable.isActive, true)))
      .limit(1);
    if (!season) {
      res.status(404).json({ error: "No active season for this ladder" });
      return;
    }
    res.json(season);
    return;
  }
  // Backwards compat: return first active season anywhere
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!season) {
    res.status(404).json({ error: "No active season" });
    return;
  }
  res.json(season);
});

router.get("/seasons/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, id));
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }
  res.json(season);
});

router.post("/seasons", requireAdmin, async (req, res): Promise<void> => {
  const { ladderId, name, startDate, endDate, signupDeadline } = req.body;
  if (!ladderId || !name || !startDate || !endDate) {
    res.status(400).json({ error: "ladderId, name, startDate, endDate required" });
    return;
  }
  const [ladder] = await db.select().from(laddersTable).where(eq(laddersTable.id, ladderId)).limit(1);
  if (!ladder) {
    res.status(400).json({ error: "Ladder not found" });
    return;
  }
  const [season] = await db.insert(seasonsTable).values({
    ladderId, name, startDate, endDate,
    signupDeadline: signupDeadline || null,
    isActive: false,
  }).returning();
  res.status(201).json(season);
});

router.patch("/seasons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, startDate, endDate, signupDeadline } = req.body;
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, id)).limit(1);
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }
  const [updated] = await db.update(seasonsTable).set({
    name: name ?? season.name,
    startDate: startDate ?? season.startDate,
    endDate: endDate ?? season.endDate,
    signupDeadline: signupDeadline !== undefined ? (signupDeadline || null) : season.signupDeadline,
  }).where(eq(seasonsTable.id, id)).returning();
  res.json(updated);
});

router.post("/seasons/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [target] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ error: "Season not found" });
    return;
  }
  // Deactivate other seasons in the same ladder
  if (target.ladderId) {
    await db.update(seasonsTable).set({ isActive: false }).where(eq(seasonsTable.ladderId, target.ladderId));
  }
  const [season] = await db.update(seasonsTable).set({ isActive: true }).where(eq(seasonsTable.id, id)).returning();
  res.json(season);
});

router.post("/seasons/:id/deactivate", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [season] = await db.update(seasonsTable).set({ isActive: false }).where(eq(seasonsTable.id, id)).returning();
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }
  res.json(season);
});

export default router;
