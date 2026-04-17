import { useMemo } from "react";
import { Link } from "wouter";
import { useListLadders, useGetCurrentPlayer, useGetMyTeams } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, ArrowRight, Calendar, MapPin, Tag, DollarSign, Check } from "lucide-react";

function isLadderEligible(sex: string | null | undefined, category: string | null | undefined): boolean {
  const cat = category ?? "coed";
  if (!sex) return true;
  if (cat === "men") return sex === "male";
  if (cat === "women") return sex === "female";
  if (cat === "mixed") return sex === "male" || sex === "female";
  return true;
}

export default function Ladders() {
  const { data: laddersData, isLoading } = useListLadders();
  const { data: currentPlayer } = useGetCurrentPlayer();
  const { data: myTeamsData } = useGetMyTeams();
  const playerSex = (currentPlayer as any)?.sex as string | undefined;
  const myLadderIds = useMemo(
    () => new Set(((myTeamsData as any[]) ?? []).map((t: any) => t.season?.ladderId).filter(Boolean)),
    [myTeamsData]
  );
  const ladders = useMemo(() => {
    const list = (laddersData as any[]) ?? [];
    return [...list].sort((a, b) => {
      const aElig = isLadderEligible(playerSex, a.category) ? 0 : 1;
      const bElig = isLadderEligible(playerSex, b.category) ? 0 : 1;
      if (aElig !== bElig) return aElig - bElig;
      const aIn = myLadderIds.has(a.id) ? 1 : 0;
      const bIn = myLadderIds.has(b.id) ? 1 : 0;
      return aIn - bIn;
    });
  }, [laddersData, playerSex, myLadderIds]);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-3">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Choose a Ladder</h1>
          <p className="text-muted-foreground">
            Pick a ladder to view standings or invite a partner and start competing.
          </p>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))
          ) : !ladders?.length ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No ladders are available yet. Check back soon.
              </CardContent>
            </Card>
          ) : (
            ladders.map((ladder: any) => {
              const eligible = isLadderEligible(playerSex, ladder.category);
              const alreadyIn = myLadderIds.has(ladder.id);
              return (
              <Card
                key={ladder.id}
                className={`transition-colors ${eligible ? "hover:border-primary/40" : "opacity-70"}`}
                data-testid={`ladder-card-${ladder.id}`}
              >
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg">{ladder.name}</h3>
                    {ladder.description ? (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {ladder.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {ladder.location && (
                        ladder.address ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ladder.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                            data-testid={`link-map-${ladder.id}`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {ladder.location}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {ladder.location}
                          </span>
                        )
                      )}
                      {ladder.level && (
                        <span className="inline-flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          Level {ladder.level}
                        </span>
                      )}
                      {ladder.entryFeeCents != null && (
                        <span className="inline-flex items-center gap-1 text-foreground font-medium">
                          <DollarSign className="w-3.5 h-3.5" />
                          {(ladder.entryFeeCents / 100).toFixed(2)} entry
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {ladder.teamCount ?? 0} teams
                      </span>
                      {ladder.activeSeason ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {ladder.activeSeason.name}
                        </span>
                      ) : (
                        <span className="text-amber-600">No active season</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
                    <Button
                      variant="outline"
                      asChild
                      data-testid={`btn-leaderboard-${ladder.id}`}
                    >
                      <Link href={`/leaderboard?ladder=${ladder.id}`}>
                        Standings
                      </Link>
                    </Button>
                    {alreadyIn ? (
                      <Button variant="secondary" disabled data-testid={`btn-joined-${ladder.id}`} className="cursor-default">
                        <Check className="w-4 h-4 mr-1" />
                        Joined
                      </Button>
                    ) : eligible ? (
                      <Button asChild data-testid={`btn-join-${ladder.id}`}>
                        <Link href={`/team?ladder=${ladder.id}`} className="flex items-center gap-1">
                          Join
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="ghost" disabled className="cursor-default text-xs italic">
                        Not your category
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}
