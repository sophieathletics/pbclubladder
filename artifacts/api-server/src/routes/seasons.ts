import { Router, type IRouter } from "express";
import { db, seasonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/seasons", async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(seasonsTable.createdAt);
  res.json(seasons);
});

router.get("/seasons/active", async (_req, res): Promise<void> => {
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
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "name, startDate, endDate required" });
    return;
  }
  const [season] = await db.insert(seasonsTable).values({ name, startDate, endDate, isActive: false }).returning();
  res.status(201).json(season);
});

router.post("/seasons/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  // Deactivate all other seasons
  await db.update(seasonsTable).set({ isActive: false });
  const [season] = await db.update(seasonsTable).set({ isActive: true }).where(eq(seasonsTable.id, id)).returning();
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }
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
