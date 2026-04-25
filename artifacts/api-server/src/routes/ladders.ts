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

const ALLOWED_CATEGORIES = ["men", "women", "mixed", "coed"] as const;

function validateFee(v: any): { ok: boolean; value?: number | null; error?: string } {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0 || n > 100000000) {
    return { ok: false, error: "entryFeeCents must be a non-negative integer (cents)" };
  }
  return { ok: true, value: n };
}

router.post("/ladders", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, sortOrder, category, location, address, city, state, level, entryFeeCents, startDate, endDate, signupDeadline } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const cityTrim = typeof city === "string" ? city.trim() : "";
  const stateTrim = typeof state === "string" ? state.trim().toUpperCase() : "";
  if (!cityTrim) {
    res.status(400).json({ error: "city is required" });
    return;
  }
  if (!/^[A-Z]{2}$/.test(stateTrim)) {
    res.status(400).json({ error: "state is required (2-letter code)" });
    return;
  }
  const cat = category ?? "coed";
  if (!ALLOWED_CATEGORIES.includes(cat)) {
    res.status(400).json({ error: "category must be one of: men, women, mixed, coed" });
    return;
  }
  const fee = validateFee(entryFeeCents);
  if (!fee.ok) { res.status(400).json({ error: fee.error }); return; }
  const [ladder] = await db.insert(laddersTable).values({
    name,
    description: description ?? null,
    category: cat,
    location: location?.trim() || null,
    address: address?.trim() || null,
    city: cityTrim,
    state: stateTrim,
    level: level?.trim() || null,
    entryFeeCents: fee.value ?? null,
    isActive: true,
    sortOrder: sortOrder ?? "0",
  }).returning();

  // Auto-create and activate a season if dates are provided
  if (startDate && endDate) {
    await db.insert(seasonsTable).values({
      ladderId: ladder.id,
      name,
      startDate,
      endDate,
      signupDeadline: signupDeadline || null,
      isActive: true,
    });
  }

  res.status(201).json(await enrichLadder(ladder));
});

router.patch("/ladders/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, description, isActive, sortOrder, category, location, address, city, state, level, entryFeeCents } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (location !== undefined) updates.location = (typeof location === "string" && location.trim()) ? location.trim() : null;
  if (address !== undefined) updates.address = (typeof address === "string" && address.trim()) ? address.trim() : null;
  if (city !== undefined) {
    const c = typeof city === "string" ? city.trim() : "";
    if (!c) { res.status(400).json({ error: "city cannot be empty" }); return; }
    updates.city = c;
  }
  if (state !== undefined) {
    const s = typeof state === "string" ? state.trim().toUpperCase() : "";
    if (!/^[A-Z]{2}$/.test(s)) { res.status(400).json({ error: "state must be a 2-letter code" }); return; }
    updates.state = s;
  }
  if (level !== undefined) updates.level = (typeof level === "string" && level.trim()) ? level.trim() : null;
  if (entryFeeCents !== undefined) {
    const fee = validateFee(entryFeeCents);
    if (!fee.ok) { res.status(400).json({ error: fee.error }); return; }
    updates.entryFeeCents = fee.value;
  }
  if (category !== undefined) {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      res.status(400).json({ error: "category must be one of: men, women, mixed, coed" });
      return;
    }
    updates.category = category;
  }
  const [ladder] = await db.update(laddersTable).set(updates).where(eq(laddersTable.id, id)).returning();
  if (!ladder) {
    res.status(404).json({ error: "Ladder not found" });
    return;
  }

  // If season dates were provided, update the active season (or create one if none exists)
  const { startDate, endDate, signupDeadline } = req.body;
  if (startDate || endDate || signupDeadline !== undefined) {
    const [activeSeason] = await db.select().from(seasonsTable)
      .where(and(eq(seasonsTable.ladderId, id), eq(seasonsTable.isActive, true)))
      .limit(1);
    if (activeSeason) {
      await db.update(seasonsTable).set({
        name: startDate || endDate ? ladder.name : activeSeason.name,
        startDate: startDate ?? activeSeason.startDate,
        endDate: endDate ?? activeSeason.endDate,
        signupDeadline: signupDeadline !== undefined ? (signupDeadline || null) : activeSeason.signupDeadline,
      }).where(eq(seasonsTable.id, activeSeason.id));
    } else if (startDate && endDate) {
      // No active season yet — create and activate one
      await db.insert(seasonsTable).values({
        ladderId: id,
        name: ladder.name,
        startDate,
        endDate,
        signupDeadline: signupDeadline || null,
        isActive: true,
      });
    }
  }

  res.json(await enrichLadder(ladder));
});

export default router;
