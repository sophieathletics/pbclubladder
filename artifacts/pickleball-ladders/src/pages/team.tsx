import { useState } from "react";
import { Link } from "wouter";
import { useGetCurrentPlayer, useGetMyTeam, useListInvitations, useListPlayers, useCreateInvitation, useAcceptInvitation, useDeclineInvitation, useGetMyLadderPosition } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Send, CheckCircle, XCircle, Trophy, ArrowRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Team() {
  return (
    <ProtectedRoute>
      <TeamContent />
    </ProtectedRoute>
  );
}

function TeamContent() {
  const { data: player } = useGetCurrentPlayer();
  const { data: team } = useGetMyTeam();
  const { data: invitations } = useListInvitations();
  const { data: ladderPos } = useGetMyLadderPosition();
  const myStanding = ladderPos?.myStanding;

  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [inviteeId, setInviteeId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);

  const { data: players } = useListPlayers(
    { search: searchQuery, limit: 10 },
    { query: { enabled: searchQuery.length > 1 } }
  );

  const sendInvite = useCreateInvitation();
  const acceptInv = useAcceptInvitation();
  const declineInv = useDeclineInvitation();

  const handleSendInvite = () => {
    if (!inviteeId || !teamName) {
      toast({ title: "Fill in team name and select a player", variant: "destructive" });
      return;
    }
    sendInvite.mutate(
      { data: { inviteeId, teamName } },
      {
        onSuccess: () => {
          toast({ title: "Invitation sent!" });
          setShowInviteForm(false);
          setInviteeId("");
          setTeamName("");
          setSearchQuery("");
          qc.invalidateQueries();
        },
        onError: (err: any) => {
          toast({ title: "Failed to send invitation", description: err?.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const handleAccept = (id: string) => {
    acceptInv.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Invitation accepted! Welcome to the ladder!" });
          qc.invalidateQueries();
        },
        onError: (err: any) => {
          toast({ title: "Failed to accept", description: err?.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const handleDecline = (id: string) => {
    declineInv.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Invitation declined" });
          qc.invalidateQueries();
        },
        onError: (err: any) => {
          toast({ title: "Failed to decline", description: err?.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const pendingReceived = invitations?.received?.filter((i: any) => i.status === "pending") ?? [];
  const sentInvitations = invitations?.sent ?? [];

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-2">
          <Users className="w-8 h-8 text-primary" />
          My Team
        </h1>

        {/* Current Team */}
        {team ? (
          <Card className="border-primary/20 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{(team as any).teamName}</span>
                {myStanding && (
                  <Badge className="text-base font-bold px-3 py-1">
                    #{myStanding.position}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Player 1</p>
                  <p className="font-semibold">{(team as any).player1?.fullName ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{(team as any).player1?.email ?? ""}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Player 2</p>
                  <p className="font-semibold">{(team as any).player2?.fullName ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{(team as any).player2?.email ?? ""}</p>
                </div>
              </div>
              {myStanding && (
                <div className="mt-4 pt-4 border-t flex gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Wins</p>
                    <p className="text-2xl font-black text-green-600">{myStanding.wins}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Losses</p>
                    <p className="text-2xl font-black text-red-500">{myStanding.losses}</p>
                  </div>
                  <div className="ml-auto flex items-end">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/leaderboard">
                        <Trophy className="w-4 h-4 mr-1" />
                        View Ladder
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/10 mb-6">
            <CardContent className="py-10 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">You're not on a team yet</p>
              <p className="text-muted-foreground mb-6">Invite a partner to form a team and join the ladder.</p>
              <Button onClick={() => setShowInviteForm(true)}>
                <Send className="w-4 h-4 mr-2" />
                Invite a Partner
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Invite Form */}
        {!team && (showInviteForm ? (
          <Card className="border-primary/10 mb-6">
            <CardHeader>
              <CardTitle>Invite a Partner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Team Name</Label>
                <Input
                  placeholder="e.g. The Dinks"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  className="mt-1"
                  data-testid="input-team-name"
                />
              </div>
              <div>
                <Label>Search for Partner</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setInviteeId(""); }}
                    data-testid="input-search-partner"
                  />
                </div>
                {players && players.length > 0 && !inviteeId && (
                  <div className="mt-2 border rounded-lg divide-y">
                    {(players as any[]).filter((p: any) => p.id !== player?.id).map((p: any) => (
                      <button
                        key={p.id}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left"
                        onClick={() => { setInviteeId(p.id); setSearchQuery(p.fullName); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {p.fullName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{p.fullName}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {inviteeId && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Partner selected: {searchQuery}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleSendInvite}
                  disabled={sendInvite.isPending || !inviteeId || !teamName}
                  data-testid="btn-send-invite"
                >
                  {sendInvite.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Invitation
                </Button>
                <Button variant="outline" onClick={() => setShowInviteForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-6">
            <Button variant="outline" onClick={() => setShowInviteForm(true)}>
              <Send className="w-4 h-4 mr-2" /> Invite a Partner
            </Button>
          </div>
        ))}

        {/* Received Invitations */}
        {pendingReceived.length > 0 && (
          <Card className="border-yellow-400/30 bg-yellow-50/40 mb-6">
            <CardHeader>
              <CardTitle className="text-yellow-800">Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingReceived.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-semibold">{inv.teamName}</p>
                    <p className="text-sm text-muted-foreground">From: {inv.inviter?.fullName}</p>
                    <p className="text-xs text-muted-foreground">Season: {inv.season?.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(inv.id)} data-testid={`btn-accept-${inv.id}`}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDecline(inv.id)}>
                      <XCircle className="w-4 h-4 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Sent Invitations */}
        {sentInvitations.length > 0 && (
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle>Sent Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sentInvitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold">{inv.teamName}</p>
                    <p className="text-sm text-muted-foreground">To: {inv.invitee?.fullName}</p>
                  </div>
                  <Badge variant={inv.status === "pending" ? "outline" : inv.status === "accepted" ? "default" : "secondary"}>
                    {inv.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
