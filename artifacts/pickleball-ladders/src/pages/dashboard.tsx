import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useGetCurrentPlayer, useGetMyTeams, useGetMyLadderPosition, useGetMyActiveChallenge, useListNotifications, useListMatches } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Swords, Bell, ArrowRight, TrendingUp, Target, Shield, History, CreditCard, CheckCircle2, Circle } from "lucide-react";

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { data: player } = useGetCurrentPlayer();
  const { data: teamsData } = useGetMyTeams();
  const teams = (teamsData as any[] | undefined) ?? [];

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const team = useMemo(() => {
    if (teams.length === 0) return null;
    return teams.find((t: any) => t.id === selectedTeamId) ?? teams[0];
  }, [teams, selectedTeamId]);

  const ladderId = (team as any)?.season?.ladderId as string | undefined;

  const { data: ladderPos } = useGetMyLadderPosition(
    ladderId ? { ladder_id: ladderId } : undefined,
    { query: { enabled: !!ladderId } }
  );
  const { data: activeChallengeRaw } = useGetMyActiveChallenge();
  const activeChallenge = (activeChallengeRaw as any)?.seasonId === (team as any)?.seasonId
    ? activeChallengeRaw
    : undefined;
  const { data: notifData } = useListNotifications({ unread_only: true });
  const { data: completedMatches } = useListMatches(
    { status: "completed", team_id: (team as any)?.id },
    { query: { enabled: !!(team as any)?.id } }
  );

  const isLoading = !player;
  const myStanding = ladderPos?.myStanding;
  const challengeableTeams = ladderPos?.challengeableTeams ?? [];

  const challengeStatusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    accepted: "bg-blue-100 text-blue-700",
    scheduling: "bg-purple-100 text-purple-700",
    scheduled: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-600",
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-black">
            Welcome back, {isLoading ? "..." : player?.fullName?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's your current season overview.</p>

          {teams.length > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Viewing ladder:</span>
              <Select
                value={(team as any)?.id ?? ""}
                onValueChange={(v) => setSelectedTeamId(v)}
              >
                <SelectTrigger className="w-auto min-w-[220px] h-9 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.season?.ladder?.name ?? "Ladder"} — {t.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Getting Started steps — shown until all steps are complete */}
        {!isLoading && (() => {
          const hasTeam = teams.length > 0;
          const hasPaid = teams.some((t: any) => {
            const amP1 = (player as any)?.id === t.player1Id;
            return t.paymentStatus === "not_required" || (amP1 ? !!t.player1PaidAt : !!t.player2PaidAt);
          });
          const hasChallenge = !!activeChallenge || (myStanding?.wins ?? 0) > 0 || (myStanding?.losses ?? 0) > 0;
          const allDone = hasTeam && hasPaid && hasChallenge;
          if (allDone) return null;

          const steps = [
            { label: "Invite your partner & join a ladder", done: hasTeam, href: "/team" },
            { label: "Pay your entry fee", done: hasPaid, href: "/team" },
            { label: "Challenge another team", done: hasChallenge, href: "/leaderboard" },
          ];

          return (
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
              <p className="font-bold text-sm mb-3">🎾 Getting started</p>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <Link key={i} href={step.done ? "#" : step.href}>
                    <div className={`flex items-center gap-3 text-sm py-1 ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {step.done
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <Circle className="w-4 h-4 text-primary shrink-0" />}
                      <span>{step.label}</span>
                      {!step.done && <ArrowRight className="w-3 h-3 ml-auto text-primary" />}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Unpaid entry fee banner — shown for any team where the current player hasn't paid */}
        {teams.some((t: any) => {
          const isMember = player && (t.player1Id === (player as any).id || t.player2Id === (player as any).id);
          if (!isMember || t.paymentStatus === "not_required") return false;
          const amP1 = (player as any).id === t.player1Id;
          return amP1 ? !t.player1PaidAt : !t.player2PaidAt;
        }) && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-amber-800">
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>You have an unpaid entry fee — pay it under <strong>My Team</strong> to start challenging.</span>
            </div>
            <Link href="/team">
              <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white border-0">Pay now</Button>
            </Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Your Position</p>
                  <p className="text-3xl font-black text-primary">
                    {myStanding ? `#${myStanding.position}` : "—"}
                  </p>
                </div>
                <Trophy className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Record</p>
                  <p className="text-3xl font-black">
                    <span className="text-green-600">{myStanding?.wins ?? 0}</span>
                    <span className="text-muted-foreground text-xl">-</span>
                    <span className="text-red-500">{myStanding?.losses ?? 0}</span>
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Challenge</p>
                  <p className="text-lg font-bold">
                    {activeChallenge
                      ? <span className={`text-sm px-2 py-0.5 rounded-full ${challengeStatusColor[activeChallenge.status] ?? "bg-gray-100"}`}>{activeChallenge.status}</span>
                      : <span className="text-muted-foreground text-sm">None</span>
                    }
                  </p>
                </div>
                <Swords className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Notifications</p>
                  <p className="text-3xl font-black text-primary">{notifData?.unreadCount ?? 0}</p>
                </div>
                <Bell className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* My Team */}
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                My Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!team ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">You're not on a team yet.</p>
                  <Button asChild size="sm">
                    <Link href="/team">Find a Partner</Link>
                  </Button>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold text-primary mb-2">{team.teamName}</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>👤 {(team as any).player1?.fullName}</p>
                    <p>👤 {(team as any).player2?.fullName}</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href="/team">
                      Team Details <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Challenge Info */}
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-primary" />
                Challenge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeChallenge ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Active challenge with:</p>
                  <p className="font-bold">
                    {activeChallenge.myTeamId === (activeChallenge as any).challengerTeam?.id
                      ? (activeChallenge as any).challengedTeam?.teamName
                      : (activeChallenge as any).challengerTeam?.teamName}
                  </p>
                  <Badge className="mt-2 capitalize">{activeChallenge.status}</Badge>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href={`/challenges/${(activeChallenge as any).id}`}>
                      View Challenge <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : challengeableTeams.length > 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Teams you can challenge:</p>
                  <div className="space-y-2">
                    {challengeableTeams.slice(0, 2).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.team?.teamName}</span>
                        <Badge variant="outline">#{s.position}</Badge>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="mt-4" asChild>
                    <Link href="/challenge">Challenge a Team</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {myStanding ? "No teams in challenge range." : "Join a team first to challenge."}
                  </p>
                  {!myStanding && (
                    <Button size="sm" asChild>
                      <Link href="/team">Get Started</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="border-primary/10 md:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button variant="outline" asChild className="h-auto flex-col py-4 gap-2">
                  <Link href="/leaderboard">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="text-xs">Leaderboard</span>
                  </Link>
                </Button>
                <Button variant="outline" asChild className="h-auto flex-col py-4 gap-2">
                  <Link href="/team">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="text-xs">My Team</span>
                  </Link>
                </Button>
                <Button variant="outline" asChild className="h-auto flex-col py-4 gap-2">
                  <Link href="/challenge">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="text-xs">Challenge</span>
                  </Link>
                </Button>
                <Button variant="outline" asChild className="h-auto flex-col py-4 gap-2">
                  <Link href="/notifications">
                    <Bell className="w-5 h-5 text-primary" />
                    <span className="text-xs">Notifications</span>
                  </Link>
                </Button>
              </div>
              {player?.role === "admin" && (
                <div className="mt-3">
                  <Button variant="destructive" size="sm" asChild>
                    <Link href="/admin">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Match History */}
          <Card className="border-primary/10 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Match History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!completedMatches || (completedMatches as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No matches played yet.</p>
              ) : (
                <div className="divide-y">
                  {(completedMatches as any[]).map((m: any) => {
                    const t1 = m.challenge?.challengerTeam;
                    const t2 = m.challenge?.challengedTeam;
                    const winnerId = m.result?.winnerTeamId;
                    const confirmed = !!m.result?.confirmedAt;
                    const renderTeam = (t: any, isWinner: boolean) => (
                      <div className={`flex-1 ${isWinner ? "font-semibold text-primary" : ""}`}>
                        <p className="text-sm">
                          {t?.teamName ?? "Unknown"}
                          {isWinner && <Trophy className="w-3 h-3 inline ml-1 text-yellow-500" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t?.player1?.fullName ?? "?"} & {t?.player2?.fullName ?? "?"}
                        </p>
                      </div>
                    );
                    return (
                      <Link key={m.id} href={`/matches/${m.id}`}>
                        <div className="py-3 hover:bg-muted/30 -mx-2 px-2 rounded cursor-pointer">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-muted-foreground">
                              {m.scheduledDate}
                              {!confirmed && m.result && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px]">
                                  {m.result.disputeReason ? "Disputed" : "Pending Confirmation"}
                                </span>
                              )}
                            </p>
                            {m.scores?.length > 0 && (
                              <p className="text-xs font-semibold">
                                {m.scores.map((s: any) => `${s.team1Score}–${s.team2Score}`).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {renderTeam(t1, winnerId === t1?.id)}
                            <span className="text-xs font-bold text-muted-foreground">vs</span>
                            {renderTeam(t2, winnerId === t2?.id)}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
