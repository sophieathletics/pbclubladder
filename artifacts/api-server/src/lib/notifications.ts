import { db, notificationsTable } from "@workspace/db";

interface NotifyParams {
  playerId: string;
  type: string;
  message: string;
  link?: string;
}

export async function createNotification(params: NotifyParams): Promise<void> {
  await db.insert(notificationsTable).values({
    playerId: params.playerId,
    type: params.type,
    message: params.message,
    link: params.link ?? null,
    isRead: false,
  });
}

export async function notifyPlayers(playerIds: string[], type: string, message: string, link?: string): Promise<void> {
  if (playerIds.length === 0) return;
  await db.insert(notificationsTable).values(
    playerIds.map(pid => ({
      playerId: pid,
      type,
      message,
      link: link ?? null,
      isRead: false,
    }))
  );
}
