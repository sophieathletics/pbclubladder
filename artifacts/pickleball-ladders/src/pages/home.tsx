import { useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { Trophy, ArrowRight, Activity, Users, MapPin, Tag, DollarSign, Check } from "lucide-react";
import { useGetTopLadder, useGetCurrentPlayer, useListLadders, useGetMyTeams } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

function isLadderEligible(sex: string | null | undefined, category: string | null | undefined): boolean {
  const cat = category ?? "coed";
  if (!sex) return true;
  if (cat === "men") return sex === "male";
  if (cat === "women") return sex === "female";
  if (cat === "mixed") return sex === "male" || sex === "female";
  return true;
}

export default function Home() {
  const { data: ladderResponse, isLoading: isLoadingStandings } = useGetTopLadder();
  const { data: currentPlayer } = useGetCurrentPlayer();
  const { data: laddersData, isLoading: isLoadingLadders } = useListLadders();
  const { data: myTeamsData } = useGetMyTeams();
  const playerSex = (currentPlayer as any)?.sex as string | undefined;
  const myLadderIds = useMemo(
    () => new Set(((myTeamsData as any[]) ?? []).map((t: any) => t.season?.ladderId).filter(Boolean)),
    [myTeamsData]
  );
  const ladders = useMemo(() => {
    const list = ((laddersData as any[]) ?? []).filter(l => l.isActive);
    return [...list].sort((a, b) => {
      const aElig = isLadderEligible(playerSex, a.category) ? 0 : 1;
      const bElig = isLadderEligible(playerSex, b.category) ? 0 : 1;
      if (aElig !== bElig) return aElig - bElig;
      const aIn = myLadderIds.has(a.id) ? 1 : 0;
      const bIn = myLadderIds.has(b.id) ? 1 : 0;
      return aIn - bIn;
    });
  }, [laddersData, playerSex, myLadderIds]);
  const joinHref = currentPlayer ? "/ladders" : "/register";
  const hasStandings = !!ladderResponse?.standings?.length;
  const isLoading = isLoadingStandings || (!hasStandings && isLoadingLadders);

  return (
    <MainLayout>
      <div className="flex flex-col gap-12 pb-12">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24 px-4 flex flex-col items-center justify-center relative overflow-hidden rounded-3xl bg-gradient-to-b from-primary/10 to-transparent border border-primary/10">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
          <Badge className="mb-6 px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 border-none">
            Competitive Ladder Season Active
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground max-w-3xl mb-6">
            <span className="text-primary">Pickleball Club Ladder</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
            Challenge teams, record scores, and climb the ranks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" asChild className="font-semibold px-8" data-testid="hero-btn-join">
              <Link href={joinHref}>Join a Ladder</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="font-semibold px-8" data-testid="hero-btn-leaderboard">
              <Link href="/leaderboard">View Leaderboard</Link>
            </Button>
          </div>
        </section>

        {/* Features + Standings/Ladders combined section */}
        <section className="max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Left column: feature cards stacked */}
          <div className="flex flex-col gap-6">
            <Card className="bg-card">
              <CardContent className="pt-6">
                <Trophy className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-bold text-lg mb-2">Dynamic Rankings</h3>
                <p className="text-muted-foreground text-sm">
                  Challenge teams up to 3 spots above you. Win to take their place, lose and drop down.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <Activity className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-bold text-lg mb-2">Automated Scheduling</h3>
                <p className="text-muted-foreground text-sm">
                  Submit availability, find overlapping times, and book matches without the back-and-forth text messages.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <Users className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-bold text-lg mb-2">Player Profiles</h3>
                <p className="text-muted-foreground text-sm">
                  Track your personal and team stats across multiple seasons. Build your reputation on the courts.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Standings or Ladders */}
          <div className="md:pl-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="w-6 h-6 text-primary" />
                {isLoading ? "Top 10 Standings" : hasStandings ? "Top 10 Standings" : "Open Ladders"}
              </h2>
              <Button variant="ghost" size="sm" className="group" asChild data-testid="btn-view-all-ladder">
                <Link href={hasStandings ? "/leaderboard" : "/ladders"} className="flex items-center gap-2">
                  {hasStandings ? "Full Ladder" : "Browse all"}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>

            <Card className="border-primary/10 shadow-lg shadow-primary/5">
            <CardContent className="p-0">
              <div className="divide-y">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-4">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))
                ) : !hasStandings ? (
                  ladders.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center">
                      <Trophy className="w-12 h-12 mb-4 text-muted-foreground/50" />
                      <p className="font-semibold">No ladders open yet</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Once an admin creates a ladder and starts a season, teams and standings will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-5 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
                        <p className="text-sm text-muted-foreground">
                          The first season hasn't kicked off yet. Pick a ladder, grab a partner, and you'll be on the board day one.
                        </p>
                      </div>
                      {ladders.slice(0, 5).map((l: any) => {
                        const cat = l.category ?? "coed";
                        const catLabel: Record<string, string> = { men: "Men's", women: "Women's", mixed: "Mixed", coed: "Co-ed" };
                        const eligible = isLadderEligible(playerSex, cat);
                        const alreadyIn = myLadderIds.has(l.id);
                        return (
                          <div key={l.id} className={`p-4 flex items-center gap-4 transition-colors ${eligible ? "hover:bg-muted/50" : "opacity-60"}`}>
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Trophy className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground truncate flex items-center gap-2 flex-wrap">
                                {l.name}
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">{catLabel[cat]}</span>
                                {l.activeSeason && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-500/10 text-green-700">Season open</span>}
                              </h3>
                              <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                                {l.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{l.location}</span>}
                                {l.level && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />Level {l.level}</span>}
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {l.entryFeeCents != null ? `$${(l.entryFeeCents / 100).toFixed(2)}` : "Free"}
                                </span>
                              </p>
                            </div>
                            {alreadyIn ? (
                              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-500/10 px-2.5 py-1.5 rounded-md">
                                <Check className="w-3.5 h-3.5" /> Joined
                              </span>
                            ) : eligible ? (
                              <Button size="sm" asChild className="shrink-0" data-testid={`btn-join-${l.id}`}>
                                <Link href={currentPlayer ? `/team?ladder=${l.id}` : "/register"}>Join</Link>
                              </Button>
                            ) : (
                              <span className="shrink-0 text-[11px] text-muted-foreground italic">Not your category</span>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )
                ) : (
                  ladderResponse!.standings!.map((standing) => (
                    <div key={standing.id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        standing.position === 1 ? 'bg-yellow-400/20 text-yellow-600' :
                        standing.position === 2 ? 'bg-gray-300/20 text-gray-500' :
                        standing.position === 3 ? 'bg-amber-600/20 text-amber-700' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {standing.position}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {standing.team?.teamName || "Unknown Team"}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {standing.team?.player1?.fullName} & {standing.team?.player2?.fullName}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="font-medium text-sm">
                          {standing.wins}W - {standing.losses}L
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>;
}
