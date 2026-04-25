import { useState, useMemo, useEffect } from "react";
import { useGetLadder, useListLadders, useGetMyTeams, useCreateChallenge, useGetCurrentPlayer, useGetMyLadderPosition } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Medal, Search, Swords } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";

export default function Leaderboard() {
  const [search, setSearch] = useState("");
  const { data: ladders } = useListLadders();
  const { data: player } = useGetCurrentPlayer();
  const { data: myTeams } = useGetMyTeams();
  const allLadderList = (ladders as any[]) ?? [];
  const myLadderIds = useMemo(
    () => new Set(((myTeams as any[]) ?? []).map((t: any) => t.season?.ladderId).filter(Boolean)),
    [myTeams]
  );
  const playerSex = (player as any)?.sex as string | undefined;
  const isEligible = (cat: string | null | undefined) => {
    const c = cat ?? "coed";
    if (!playerSex) return true;
    if (c === "men") return playerSex === "male";
    if (c === "women") return playerSex === "female";
    if (c === "mixed") return playerSex === "male" || playerSex === "female";
    return true;
  };
  const ladderList = useMemo(() => {
    if (!player) return allLadderList;
    const base = myLadderIds.size > 0
      ? allLadderList.filter(l => myLadderIds.has(l.id))
      : allLadderList;
    // Sort eligible-by-gender ladders first so the default selection matches the user.
    return [...base].sort((a, b) => {
      const ae = isEligible(a.category) ? 0 : 1;
      const be = isEligible(b.category) ? 0 : 1;
      return ae - be;
    });
  }, [allLadderList, player, myLadderIds, playerSex]);

  const locationSearch = useSearch();
  const urlLadderId = useMemo(() => new URLSearchParams(locationSearch).get("ladder") ?? undefined, [locationSearch]);
  const [ladderId, setLadderId] = useState<string | undefined>(urlLadderId);

  useEffect(() => {
    if (ladderList.length === 0) return;
    // Honour ?ladder= URL param if it matches a known ladder
    if (urlLadderId && ladderList.some(l => l.id === urlLadderId)) {
      setLadderId(urlLadderId);
      return;
    }
    if (!ladderId || !ladderList.some(l => l.id === ladderId)) {
      const withSeason = ladderList.find(l => l.activeSeason) ?? ladderList[0];
      setLadderId(withSeason.id);
    }
  }, [ladderList, ladderId, urlLadderId]);

  const { data, isLoading } = useGetLadder(
    { search: search || undefined, ladder_id: ladderId },
    { query: { enabled: !!ladderId } }
  );

  const standings = data?.standings ?? [];
  const season = data?.season;
  const currentLadder = useMemo(() => ladderList.find(l => l.id === ladderId), [ladderList, ladderId]);

  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const createChallenge = useCreateChallenge();
  const { data: myPositionData } = useGetMyLadderPosition(
    { ladder_id: ladderId } as any,
    { query: { enabled: !!ladderId && !!player } } as any,
  );
  const hasActiveChallenge = !!(myPositionData as any)?.hasActiveChallenge;

  const seasonStarted = useMemo(() => {
    if (!season?.startDate) return true;
    return new Date() >= new Date(season.startDate);
  }, [season]);

  const seasonStartLabel = useMemo(() => {
    if (!season?.startDate) return "";
    return new Date(season.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [season]);

  const myTeamInLadder = useMemo(() => {
    if (!season || !myTeams) return undefined;
    return (myTeams as any[]).find(t => t.seasonId === season.id);
  }, [myTeams, season]);

  const myStanding = useMemo(() => {
    if (!myTeamInLadder) return undefined;
    return (standings as any[]).find(s => (s as any).team?.id === myTeamInLadder.id);
  }, [standings, myTeamInLadder]);

  const canChallenge = (pos: number) => {
    if (!player || !myStanding) return false;
    const myPos = myStanding.position ?? 0;
    return pos < myPos && pos >= myPos - 3;
  };

  const handleChallenge = (challengedTeamId: string, teamName: string) => {
    createChallenge.mutate(
      { data: { challengedTeamId } },
      {
        onSuccess: (resp: any) => {
          toast({ title: `Challenge sent to ${teamName}!`, description: "They have 48 hours to respond." });
          qc.invalidateQueries();
          setLocation(`/challenges/${resp.id}`);
        },
        onError: (err: any) => {
          const msg: string = err?.data?.error ?? "Failed to send challenge";
          const isPaymentBlock = /entry fee/i.test(msg);
          if (isPaymentBlock) {
            toast({
              title: "Entry fees needed first",
              description: msg,
            });
          } else {
            toast({ title: "Failed to send challenge", description: msg, variant: "destructive" });
          }
        },
      }
    );
  };

  function formatDateRange(start?: string, end?: string) {
    if (!start || !end) return "—";
    const fmt = (d: string) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }

  function positionColor(pos: number) {
    if (pos === 1) return "bg-yellow-400/20 text-yellow-600 border border-yellow-400/40";
    if (pos === 2) return "bg-slate-300/30 text-slate-600 border border-slate-300/50";
    if (pos === 3) return "bg-amber-600/20 text-amber-700 border border-amber-600/30";
    return "bg-primary/10 text-primary";
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-5 px-3 sm:py-8 sm:px-4">
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Leaderboard
          </h1>
          {!myTeamInLadder && (
            <Button asChild size="sm" className="shrink-0" data-testid="btn-join-ladder-top">
              <Link href={player ? "/ladders" : "/register"}>Join a Ladder</Link>
            </Button>
          )}
        </div>

        {ladderList.length > 0 && (() => {
          const catLabel: Record<string, string> = { men: "Men's", women: "Women's", mixed: "Mixed", coed: "Co-ed" };
          const selectedCat = currentLadder?.category ?? "coed";
          return (
            <div className="my-5 sm:my-6">
              <Select value={ladderId} onValueChange={setLadderId}>
                <SelectTrigger
                  className="w-full h-auto min-h-[64px] py-3 px-4 text-sm sm:text-base font-semibold border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 hover:border-primary/60 transition-all shadow-sm [&>span]:line-clamp-none [&>span]:block [&>span]:text-left [&>span]:flex-1 [&>span]:min-w-0"
                  data-testid="select-ladder"
                >
                  {currentLadder ? (
                    <div className="flex flex-col gap-1 min-w-0 w-full">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold break-words">{currentLadder.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{catLabel[selectedCat]}</Badge>
                      </span>
                      {currentLadder.activeSeason && (
                        <span className="text-xs font-normal text-muted-foreground break-words">
                          {formatDateRange(currentLadder.activeSeason.startDate, currentLadder.activeSeason.endDate)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Pick your ladder</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {ladderList.map((l: any) => {
                    const cat = l.category ?? "coed";
                    return (
                      <SelectItem key={l.id} value={l.id} className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium flex items-center gap-1.5">
                            <span>{l.name}</span>
                            <Badge variant="outline" className="text-[10px] ml-1">{catLabel[cat]}</Badge>
                          </span>
                          {l.activeSeason && (
                            <span className="text-xs text-muted-foreground">
                              {formatDateRange(l.activeSeason.startDate, l.activeSeason.endDate)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          );
        })()}

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 w-full"
              placeholder="Search teams or players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        <Card className="border-primary/10 shadow-lg shadow-primary/5">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : standings.length === 0 ? (
              <div className="p-10 sm:p-12 text-center flex flex-col items-center">
                <Trophy className="w-12 h-12 mb-4 text-muted-foreground/50" />
                <p className="font-semibold text-foreground">
                  {currentLadder?.activeSeason ? "Be the first team on the board" : "No active season yet"}
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {currentLadder?.activeSeason
                    ? "Grab a partner, join this ladder, and you'll show up here as soon as you're in."
                    : "An admin needs to start a season for this ladder before teams can compete."}
                </p>
                {currentLadder?.activeSeason && !myTeamInLadder && (
                  <Button asChild className="mt-5" data-testid="btn-join-ladder-empty">
                    <Link href={player ? "/ladders" : "/register"}>Join this Ladder</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {standings.map((standing) => {
                  const showChallenge = canChallenge(standing.position ?? 0);
                  const isMine = !!myTeamInLadder && (standing as any).team?.id === myTeamInLadder.id;
                  return (
                    <div
                      key={standing.id}
                      className={`p-3 sm:p-4 transition-colors ${
                        isMine
                          ? "bg-primary/10 border-l-4 border-primary"
                          : "hover:bg-muted/50"
                      }`}
                      data-testid={isMine ? "row-my-team" : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${positionColor(standing.position ?? 0)}`}>
                          {standing.position === 1 ? (
                            <span className="flex items-center gap-0.5">
                              <Medal className="w-4 h-4" aria-hidden="true" />
                              <span className="sr-only">1</span>
                            </span>
                          ) : standing.position}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {(standing as any).team?.teamName ?? "Unknown Team"}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 truncate">
                            <Users className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{(standing as any).team?.player1?.fullName ?? "?"} &amp; {(standing as any).team?.player2?.fullName ?? "?"}</span>
                          </p>
                        </div>
                        <div className="font-bold text-xs sm:text-sm shrink-0 tabular-nums">
                          <span className="text-green-600">{standing.wins}W</span>
                          <span className="text-muted-foreground mx-0.5 sm:mx-1">-</span>
                          <span className="text-red-500">{standing.losses}L</span>
                        </div>
                      </div>
                      {showChallenge && !hasActiveChallenge && (
                        <div className="mt-2 pl-12">
                          {seasonStarted ? (
                            <Button
                              size="sm"
                              onClick={() => handleChallenge((standing as any).team?.id, (standing as any).team?.teamName)}
                              disabled={createChallenge.isPending}
                              data-testid={`btn-challenge-${(standing as any).team?.id}`}
                            >
                              <Swords className="w-3.5 h-3.5 mr-1" />
                              Challenge
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Challenges open {seasonStartLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Challenge teams 1 to 3 spots above you to climb the ladder. Win to take their place.
        </p>
        {hasActiveChallenge && myTeamInLadder && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            You already have an active challenge. Finish it before starting another.
          </p>
        )}
      </div>
    </MainLayout>
  );
}
