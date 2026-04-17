import { Link } from "wouter";
import { useListLadders } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, ArrowRight, Calendar } from "lucide-react";

export default function Ladders() {
  const { data: ladders, isLoading } = useListLadders();

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
            ladders.map((ladder) => (
              <Card
                key={ladder.id}
                className="hover:border-primary/40 transition-colors"
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
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
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
                    <Button asChild data-testid={`btn-join-${ladder.id}`}>
                      <Link href={`/team?ladder=${ladder.id}`} className="flex items-center gap-1">
                        Join
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
