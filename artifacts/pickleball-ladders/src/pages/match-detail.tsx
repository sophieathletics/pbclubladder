import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetMatch, useGetCurrentPlayer, useGetMyTeam, useSubmitScore, useConfirmScore, useDisputeScore, useConfirmAttendance } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Calendar, MapPin, Clock, CheckCircle, AlertTriangle, Plus, Minus, Loader2, CalendarClock, UserCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function MatchDetail() {
  return (
    <ProtectedRoute>
      <MatchDetailContent />
    </ProtectedRoute>
  );
}

function MatchDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: match, isLoading } = useGetMatch(id!);
  const { data: player } = useGetCurrentPlayer();
  const { data: myTeam } = useGetMyTeam();
  const submitScore = useSubmitScore();
  const confirmScore = useConfirmScore();
  const disputeScore = useDisputeScore();
  const confirmAttendance = useConfirmAttendance();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [games, setGames] = useState([{ gameNumber: 1, team1Score: 0, team2Score: 0 }]);
  const [tieBreakerWinnerId, setTieBreakerWinnerId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  if (isLoading) return (
    <MainLayout>
      <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    </MainLayout>
  );

  if (!match) return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-8 px-4 text-center">
        <p>Match not found.</p>
        <Button asChild className="mt-4"><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    </MainLayout>
  );

  const m = match as any;
  const c = m.challenge;
  const challengerTeam = c?.challengerTeam;
  const challengedTeam = c?.challengedTeam;
  const isTeamInMatch = myTeam && (myTeam.id === challengerTeam?.id || myTeam.id === challengedTeam?.id);

  const addGame = () => setGames(prev => [...prev, { gameNumber: prev.length + 1, team1Score: 0, team2Score: 0 }]);
  const removeGame = () => setGames(prev => prev.slice(0, -1));
  const updateScore = (i: number, field: "team1Score" | "team2Score", val: number) =>
    setGames(prev => prev.map((g, gi) => gi === i ? { ...g, [field]: val } : g));

  // Compute games won from the entered scores
  const { team1Wins, team2Wins } = (() => {
    let t1 = 0;
    let t2 = 0;
    for (const g of games) {
      const a = Number.isFinite(g.team1Score) ? g.team1Score : 0;
      const b = Number.isFinite(g.team2Score) ? g.team2Score : 0;
      if (a === 0 && b === 0) continue;
      if (a > b) t1++;
      else if (b > a) t2++;
    }
    return { team1Wins: t1, team2Wins: t2 };
  })();

  const computedWinnerTeamId = (() => {
    if (!challengerTeam?.id || !challengedTeam?.id) return "";
    if (team1Wins === 0 && team2Wins === 0) return "";
    if (team1Wins > team2Wins) return challengerTeam.id;
    if (team2Wins > team1Wins) return challengedTeam.id;
    return ""; // tie
  })();

  const isTie = team1Wins > 0 && team1Wins === team2Wins;
  const effectiveWinnerTeamId = computedWinnerTeamId || (isTie ? tieBreakerWinnerId : "");

  const handleSubmitScore = () => {
    const finalWinner = effectiveWinnerTeamId;
    if (!finalWinner) { toast({ title: "Select the winner", variant: "destructive" }); return; }
    submitScore.mutate(
      { id: id!, data: { games, winnerTeamId: finalWinner } },
      {
        onSuccess: () => { toast({ title: "Score submitted!" }); qc.invalidateQueries(); setShowScoreForm(false); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleConfirm = () => {
    confirmScore.mutate(
      { id: id! },
      {
        onSuccess: () => { toast({ title: "Score confirmed! Rankings updated." }); qc.invalidateQueries(); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleDispute = () => {
    if (!disputeReason) { toast({ title: "Provide a reason", variant: "destructive" }); return; }
    disputeScore.mutate(
      { id: id!, data: { reason: disputeReason } },
      {
        onSuccess: () => { toast({ title: "Dispute filed. Admin has been notified." }); qc.invalidateQueries(); setShowDisputeForm(false); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleConfirmAttendance = () => {
    confirmAttendance.mutate(
      { id: id! },
      {
        onSuccess: () => { toast({ title: "You're confirmed! See you on the court." }); qc.invalidateQueries(); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
          <span>/</span>
          {c && <><Link href={`/challenges/${c.id}`} className="hover:text-primary">Challenge</Link><span>/</span></>}
          <span>Match</span>
        </div>

        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          Match Details
        </h1>

        {/* Match info */}
        <Card className="border-primary/10 mb-6">
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{m.scheduledDate}</span>
              <Clock className="w-4 h-4 text-muted-foreground ml-2" />
              <span>{m.scheduledTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{m.courtLocation}</span>
            </div>
            <Badge variant="outline" className="capitalize">{m.status}</Badge>
          </CardContent>
        </Card>

        {/* Teams */}
        <Card className="border-primary/10 mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">Challenger</p>
                <p className="font-bold break-words">{challengerTeam?.teamName ?? "—"}</p>
              </div>
              <div className="text-lg sm:text-xl font-black text-muted-foreground shrink-0">VS</div>
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">Challenged</p>
                <p className="font-bold break-words">{challengedTeam?.teamName ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance confirmation — scheduled matches only */}
        {m.status === "scheduled" && isTeamInMatch && (() => {
          const attendance: any[] = m.attendance ?? [];
          const myPlayerId = player?.id;
          const alreadyConfirmed = attendance.some((a: any) => a.playerId === myPlayerId);

          // Build all four expected players from both teams
          const allPlayers = [
            ...(challengerTeam ? [
              { player: challengerTeam.player1, teamName: challengerTeam.teamName },
              { player: challengerTeam.player2, teamName: challengerTeam.teamName },
            ] : []),
            ...(challengedTeam ? [
              { player: challengedTeam.player1, teamName: challengedTeam.teamName },
              { player: challengedTeam.player2, teamName: challengedTeam.teamName },
            ] : []),
          ].filter(({ player }) => !!player);

          return (
            <Card className="border-primary/10 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Attendance Confirmation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {allPlayers.map(({ player: p, teamName }) => {
                    const confirmed = attendance.some((a: any) => a.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {p.fullName}
                          <span className="ml-1 text-xs">({teamName})</span>
                        </span>
                        {confirmed ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Confirmed
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Pending</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!alreadyConfirmed && (
                  <Button
                    onClick={handleConfirmAttendance}
                    disabled={confirmAttendance.isPending}
                    variant="outline"
                    className="w-full"
                    data-testid="btn-confirm-attendance"
                  >
                    {confirmAttendance.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    I've seen the date, time, and location — see you there!
                  </Button>
                )}
                {alreadyConfirmed && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> You've confirmed your attendance.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Reschedule — available to participants while not completed */}
        {isTeamInMatch && m.status !== "completed" && m.challengeId && (
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Link href={`/availability/${m.challengeId}`}>
                <CalendarClock className="w-4 h-4 mr-1" />
                Reschedule match
              </Link>
            </Button>
          </div>
        )}

        {/* Score / Result */}
        {m.result && (
          <Card className={`border-green-200 bg-green-50/40 mb-6`}>
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                {m.result.confirmedAt ? "Match Result (Confirmed)" : "Pending Confirmation"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-2">
                <div className="grid grid-cols-[60px_1fr_auto_1fr] gap-2 items-center text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  <span></span>
                  <span className="text-right truncate">{challengerTeam?.teamName ?? "Team 1"}</span>
                  <span></span>
                  <span className="text-left truncate">{challengedTeam?.teamName ?? "Team 2"}</span>
                </div>
                {m.scores?.map((s: any) => {
                  const t1Win = s.team1Score > s.team2Score;
                  const t2Win = s.team2Score > s.team1Score;
                  return (
                    <div key={s.id} className="grid grid-cols-[60px_1fr_auto_1fr] gap-2 items-center text-sm">
                      <span className="text-xs text-muted-foreground">Game {s.gameNumber}</span>
                      <span className={`text-right font-bold tabular-nums ${t1Win ? "text-green-700" : ""}`}>{s.team1Score}</span>
                      <span className="text-muted-foreground">–</span>
                      <span className={`text-left font-bold tabular-nums ${t2Win ? "text-green-700" : ""}`}>{s.team2Score}</span>
                    </div>
                  );
                })}
              </div>
              {m.result.winnerTeamId && (
                <p className="mt-3 font-semibold text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Winner: {[challengerTeam, challengedTeam].find((t: any) => t?.id === m.result.winnerTeamId)?.teamName ?? "Unknown"}
                </p>
              )}
              {m.result.disputeReason && !m.result.disputeResolved && (
                <p className="mt-2 text-orange-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Disputed: {m.result.disputeReason}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Score entry — initial submission */}
        {m.status === "scheduled" && isTeamInMatch && !m.result && (
          <Card className="border-primary/10 mb-6">
            <CardHeader><CardTitle>Submit Score</CardTitle></CardHeader>
            <CardContent>
              {!showScoreForm ? (
                <Button onClick={() => setShowScoreForm(true)}>Enter Score</Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Winner</Label>
                    {effectiveWinnerTeamId && !isTie ? (
                      <div className="mt-2 p-3 rounded-lg border border-primary bg-primary/10 text-primary text-sm font-semibold flex items-center justify-between">
                        <span>
                          {[challengerTeam, challengedTeam].find((t: any) => t?.id === effectiveWinnerTeamId)?.teamName}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Won {Math.max(team1Wins, team2Wins)} of {team1Wins + team2Wins} games
                        </span>
                      </div>
                    ) : isTie ? (
                      <>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                          Games are tied {team1Wins}–{team2Wins}. Pick the overall winner:
                        </p>
                        <div className="flex gap-3">
                          {[challengerTeam, challengedTeam].filter(Boolean).map((t: any) => (
                            <button
                              key={t.id}
                              onClick={() => setTieBreakerWinnerId(t.id)}
                              data-testid={`btn-winner-${t.id}`}
                              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${tieBreakerWinnerId === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                            >
                              {t.teamName}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Enter game scores below — winner is selected automatically.</p>
                    )}
                  </div>

                  {games.map((game, i) => (
                    <div key={i} className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
                      <div>
                        <Label className="text-xs">{challengerTeam?.teamName ?? "Team 1"}</Label>
                        <Input type="number" min={0} value={game.team1Score} onChange={e => updateScore(i, "team1Score", parseInt(e.target.value) || 0)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{challengedTeam?.teamName ?? "Team 2"}</Label>
                        <Input type="number" min={0} value={game.team2Score} onChange={e => updateScore(i, "team2Score", parseInt(e.target.value) || 0)} className="mt-1" />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addGame}>
                      <Plus className="w-4 h-4 mr-1" /> Add Game
                    </Button>
                    {games.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={removeGame}>
                        <Minus className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmitScore} disabled={submitScore.isPending || !effectiveWinnerTeamId}>
                      {submitScore.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Submit Score
                    </Button>
                    <Button variant="outline" onClick={() => setShowScoreForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit score — submitter only, while pending confirmation */}
        {m.result && !m.result.confirmedAt && !m.result.disputeReason && isTeamInMatch && myTeam?.id === m.result.submittedByTeamId && (
          <Card className="border-primary/10 mb-6">
            <CardHeader><CardTitle>Edit Submitted Score</CardTitle></CardHeader>
            <CardContent>
              {!showScoreForm ? (
                <>
                  <p className="text-sm text-muted-foreground italic mb-3">
                    Waiting for {[challengerTeam, challengedTeam].find((t: any) => t?.id !== myTeam.id)?.teamName ?? "the other team"} to confirm or dispute this score. You can still edit it until they do.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGames(
                        (m.scores ?? []).length > 0
                          ? m.scores.map((s: any) => ({ gameNumber: s.gameNumber, team1Score: s.team1Score, team2Score: s.team2Score }))
                          : [{ gameNumber: 1, team1Score: 0, team2Score: 0 }]
                      );
                      setTieBreakerWinnerId("");
                      setShowScoreForm(true);
                    }}
                    data-testid="btn-edit-score"
                  >
                    Edit Score
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Winner</Label>
                    {effectiveWinnerTeamId && !isTie ? (
                      <div className="mt-2 p-3 rounded-lg border border-primary bg-primary/10 text-primary text-sm font-semibold flex items-center justify-between">
                        <span>{[challengerTeam, challengedTeam].find((t: any) => t?.id === effectiveWinnerTeamId)?.teamName}</span>
                        <span className="text-xs font-normal text-muted-foreground">Won {Math.max(team1Wins, team2Wins)} of {team1Wins + team2Wins} games</span>
                      </div>
                    ) : isTie ? (
                      <>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">Games are tied {team1Wins}–{team2Wins}. Pick the overall winner:</p>
                        <div className="flex gap-3">
                          {[challengerTeam, challengedTeam].filter(Boolean).map((t: any) => (
                            <button
                              key={t.id}
                              onClick={() => setTieBreakerWinnerId(t.id)}
                              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium ${tieBreakerWinnerId === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                            >
                              {t.teamName}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Enter game scores below — winner is selected automatically.</p>
                    )}
                  </div>

                  {games.map((game, i) => (
                    <div key={i} className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
                      <div>
                        <Label className="text-xs">{challengerTeam?.teamName ?? "Team 1"}</Label>
                        <Input type="number" min={0} value={game.team1Score} onChange={e => updateScore(i, "team1Score", parseInt(e.target.value) || 0)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{challengedTeam?.teamName ?? "Team 2"}</Label>
                        <Input type="number" min={0} value={game.team2Score} onChange={e => updateScore(i, "team2Score", parseInt(e.target.value) || 0)} className="mt-1" />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addGame}><Plus className="w-4 h-4 mr-1" /> Add Game</Button>
                    {games.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={removeGame}><Minus className="w-4 h-4 mr-1" /> Remove</Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmitScore} disabled={submitScore.isPending || !effectiveWinnerTeamId} data-testid="btn-save-edited-score">
                      {submitScore.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setShowScoreForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confirm / Dispute — opposing team only */}
        {m.result && !m.result.confirmedAt && !m.result.disputeReason && isTeamInMatch && myTeam?.id !== m.result.submittedByTeamId && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={handleConfirm} disabled={confirmScore.isPending} data-testid="btn-confirm-score">
                <CheckCircle className="w-4 h-4 mr-1" />
                Confirm Score
              </Button>
              <Button variant="outline" onClick={() => setShowDisputeForm(true)} data-testid="btn-dispute">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Dispute
              </Button>
            </div>
            {showDisputeForm && (
              <Card className="border-orange-200">
                <CardContent className="pt-4 space-y-3">
                  <Label>Reason for dispute</Label>
                  <Textarea
                    placeholder="Explain what is incorrect about the submitted score..."
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleDispute} disabled={disputeScore.isPending}>
                      File Dispute
                    </Button>
                    <Button variant="outline" onClick={() => setShowDisputeForm(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
