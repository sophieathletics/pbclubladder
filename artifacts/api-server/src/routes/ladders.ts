import { Router, type IRouter } from "express";
import { db, laddersTable, seasonsTable, teamsTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

async function enrichLadder(ladder: any) {
  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.ladderId, ladder.id), eq(seasonsTable.isActive, true)))
    .limit(1);

  let teamCount = 0;
  if (activeSeason) {
    const [c] = await db.select({ count: sql<number>`count(*)::int` })
      .from(teamsTable)
      .where(eq(teamsTable.seasonId, activeSeason.id));
    teamCount = c?.count ?? 0;
  }

  return { ...ladder, activeSeason: activeSeason ?? null, teamCount };
}

router.get("/ladders", async (req, res): Promise<void> => {
  const activeOnly = req.query.active_only === "true";
  let ladders = await db.select().from(laddersTable).orderBy(asc(laddersTable.sortOrder), asc(laddersTable.createdAt));
  if (activeOnly) ladders = ladders.filter(l => l.isActive);
  const enriched = await Promise.all(ladders.map(enrichLadder));
  res.json(enriched);
});

router.get("/ladders/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [ladder] = await db.select().from(laddersTable).where(eq(laddersTable.id, id)).limit(1);
  if (!ladder) {
    res.status(404).json({ error: "Ladder not found" });
    return;
  }
  res.json(await enrichLadder(ladder));
});

router.post("/ladders", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, sortOrder } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [ladder] = await db.insert(laddersTable).values({
    name,
    description: description ?? null,
    isActive: true,
    sortOrder: sortOrder ?? "0",
  }).returning();
  res.status(201).json(ladder);
});

router.patch("/ladders/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, description, isActive, sortOrder } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  const [ladder] = await db.update(laddersTable).set(updates).where(eq(laddersTable.id, id)).returning();
  if (!ladder) {
    res.status(404).json({ error: "Ladder not found" });
    return;
  }
  res.json(ladder);
});

export default router;
