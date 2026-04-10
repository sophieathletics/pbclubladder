import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const unreadOnly = req.query.unread_only === "true";

  const whereClause = unreadOnly
    ? and(eq(notificationsTable.playerId, player.id), eq(notificationsTable.isRead, false))
    : eq(notificationsTable.playerId, player.id);

  const notifications = await db.select().from(notificationsTable)
    .where(whereClause)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  res.json({ notifications, unreadCount });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  await db.update(notificationsTable).set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.playerId, player.id)));

  res.json({ success: true, message: "Notification marked as read" });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const player = (req as any).player;
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.playerId, player.id));
  res.json({ success: true, message: "All notifications marked as read" });
});

export default router;
