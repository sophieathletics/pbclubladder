import { db, ladderStandingsTable, teamsTable, matchResultsTable, matchesTable, challengesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export async function swapLadderPositions(
  seasonId: string,
  winnerTeamId: string,
  loserTeamId: string
): Promise<void> {
  // Wrap the whole swap in a transaction with row-level locks so two concurrent
  // confirmations on the same standings can't corrupt position numbers.
  await db.transaction(async (tx) => {
    const standings = await tx.execute(sql`
      SELECT * FROM ladder_standings
      WHERE season_id = ${seasonId}
        AND team_id IN (${winnerTeamId}, ${loserTeamId})
      ORDER BY position
      FOR UPDATE
    `);
    const rows: any[] = (standings as any).rows ?? [];
    const winnerStanding = rows.find((s: any) => s.team_id === winnerTeamId);
    const loserStanding = rows.find((s: any) => s.team_id === loserTeamId);
    if (!winnerStanding || !loserStanding) return;

    // Only swap if winner is below loser (challenger wins = move up)
    if (winnerStanding.position <= loserStanding.position) return;

    const winnerPos = winnerStanding.position;
    const loserPos = loserStanding.position;
    const now = new Date();

    // Use a temp position derived from the winner's CURRENT position so two
    // concurrent disjoint swaps within the same season cannot both park at the
    // same negative sentinel and trip the (season_id, position) unique index.
    // Each team has a unique position, so this temp value is unique per row.
    const tempPos = -1_000_000 - winnerPos;
    await tx.update(ladderStandingsTable)
      .set({ position: tempPos })
      .where(eq(ladderStandingsTable.id, winnerStanding.id));

    // Loser falls to the winner's old (lower) position, gains a loss
    await tx.update(ladderStandingsTable)
      .set({ position: winnerPos, losses: loserStanding.losses + 1, lastMatchDate: now })
      .where(eq(ladderStandingsTable.id, loserStanding.id));

    // Winner climbs to the loser's old (higher) position, gains a win
    await tx.update(ladderStandingsTable)
      .set({ position: loserPos, wins: winnerStanding.wins + 1, lastMatchDate: now })
      .where(eq(ladderStandingsTable.id, winnerStanding.id));
  });
}

export async function applyMatchResult(
  seasonId: string,
  winnerTeamId: string,
  loserTeamId: string,
  _challengerTeamId: string
): Promise<void> {
  // Look up both standings; if the winner is currently ranked below the loser,
  // swap their positions. Otherwise just update wins/losses.
  const standings = await db.select().from(ladderStandingsTable).where(
    and(
      eq(ladderStandingsTable.seasonId, seasonId),
      sql`${ladderStandingsTable.teamId} IN (${winnerTeamId}, ${loserTeamId})`
    )
  );
  const winnerStanding = standings.find(s => s.teamId === winnerTeamId);
  const loserStanding = standings.find(s => s.teamId === loserTeamId);

  if (winnerStanding && loserStanding && winnerStanding.position > loserStanding.position) {
    // Winner is currently ranked below loser → climb up by swapping
    await swapLadderPositions(seasonId, winnerTeamId, loserTeamId);
  } else {
    // Winner already ranked above (or equal); just record W/L
    const now = new Date();
    await db.update(ladderStandingsTable)
      .set({ wins: sql`wins + 1`, lastMatchDate: now })
      .where(and(eq(ladderStandingsTable.seasonId, seasonId), eq(ladderStandingsTable.teamId, winnerTeamId)));
    await db.update(ladderStandingsTable)
      .set({ losses: sql`losses + 1`, lastMatchDate: now })
      .where(and(eq(ladderStandingsTable.seasonId, seasonId), eq(ladderStandingsTable.teamId, loserTeamId)));
  }
}

export function findOverlappingSlots(
  slots1: Array<{ date: string; times: string[] }>,
  slots2: Array<{ date: string; times: string[] }>
): Array<{ date: string; times: string[] }> {
  const result: Array<{ date: string; times: string[] }> = [];

  for (const s1 of slots1) {
    const s2 = slots2.find(s => s.date === s1.date);
    if (!s2) continue;
    const commonTimes = s1.times.filter(t => s2.times.includes(t));
    if (commonTimes.length > 0) {
      result.push({ date: s1.date, times: commonTimes });
    }
  }

  return result;
}
