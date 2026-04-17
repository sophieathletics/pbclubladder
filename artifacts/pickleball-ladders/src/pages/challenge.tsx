import { Link } from "wouter";
import { useGetCurrentPlayer, useGetMyLadderPosition, useGetMyActiveChallenge, useGetMyTeam, useCreateChallenge } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Swords, Trophy, Users, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export default function Challenge() {
  return (
    <ProtectedRoute>
      <ChallengeContent />
    </ProtectedRoute>
  );
}

function ChallengeContent() {
  const { data: ladderPos, isLoading } = useGetMyLadderPosition();
  const { data: activeChallenge } = useGetMyActiveChallenge();
  const { data: team } = useGetMyTeam();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const createChallenge = useCreateChallenge();

  const myStanding = ladderPos?.myStanding;
  const challengeableTeams = ladderPos?.challengeableTeams ?? [];
  const hasActiveChallenge = ladderPos?.hasActiveChallenge ?? false;

  const handleChallenge = (challengedTeamId: string, teamName: string) => {
    createChallenge.mutate(
      { data: { challengedTeamId } },
      {
        onSuccess: (data: any) => {
          toast({ title: `Challenge sent to ${teamName}!`, description: "They have 48 hours to respond." });
          qc.invalidateQueries();
          setLocation(`/challenges/${data.id}`);
        },
        onError: (err: any) => {
          toast({ title: "Failed to send challenge", description: err?.data?.error, variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
          <Swords className="w-8 h-8 text-primary" />
          Challenge
        </h1>
        <p className="text-muted-foreground mb-8">Challenge a team 2-3 positions above you on the ladder.</p>

        {!team && (
          <Card className="border-yellow-400/30 bg-yellow-50/40">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
              <p className="font-semibold mb-2">You need a team first</p>
              <p className="text-sm text-muted-foreground mb-4">Form a team with a partner before you can issue challenges.</p>
              <Button asChild>
                <Link href="/team">Go to Team Page</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {team && hasActiveChallenge && activeChallenge && (
          <Card className="border-primary/20 bg-primary/5 mb-6">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">You have an active challenge</p>
                  <p className="font-bold text-lg mt-1">
                    vs {activeChallenge.myTeamId === (activeChallenge as any).challengerTeam?.id
                      ? (activeChallenge as any).challengedTeam?.teamName
                      : (activeChallenge as any).challengerTeam?.teamName}
                  </p>
                  <Badge className="mt-1 capitalize">{activeChallenge.status}</Badge>
                </div>
                <Button asChild>
                  <Link href={`/challenges/${(activeChallenge as any).id}`}>
                    View Challenge <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {team && !hasActiveChallenge && (
          <>
            {/* My current position */}
            {myStanding && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-lg">
                  #{myStanding.position}
                </div>
                <div>
                  <p className="font-bold">{team.teamName}</p>
                  <p className="text-sm text-muted-foreground">{myStanding.wins}W - {myStanding.losses}L</p>
                </div>
              </div>
            )}

            {/* Challengeable teams */}
            {challengeableTeams.length === 0 ? (
              <Card className="border-primary/10">
                <CardContent className="py-10 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-semibold mb-2">
                    {!myStanding ? "No ladder standing found" : "No teams in challenge range"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {!myStanding
                      ? "Your team hasn't been placed on the ladder yet."
                      : myStanding.position <= 2
                      ? "You're at or near the top — keep defending!"
                      : "Teams 1-3 spots above you may already have active challenges."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Available Targets</h2>
                {challengeableTeams.map((standing: any) => (
                  <Card key={standing.id} className="border-primary/10 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          #{standing.position}
                        </div>
                        <div>
                          <p className="font-bold">{standing.team?.teamName}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {standing.team?.player1?.fullName} &amp; {standing.team?.player2?.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {standing.wins}W - {standing.losses}L
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleChallenge(standing.team?.id, standing.team?.teamName)}
                        disabled={createChallenge.isPending}
                        data-testid={`btn-challenge-${standing.team?.id}`}
                      >
                        <Swords className="w-4 h-4 mr-1" />
                        Challenge
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
