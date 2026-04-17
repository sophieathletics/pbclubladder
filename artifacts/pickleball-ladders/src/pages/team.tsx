import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetCurrentPlayer,
  useGetMyTeams,
  useListInvitations,
  useListPlayers,
  useCreateInvitation,
  useAcceptInvitation,
  useDeclineInvitation,
  useResendInvitation,
  useGetMyLadderPosition,
  useListLadders,
} from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Send, CheckCircle, XCircle, Trophy, Mail, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function isValidEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

export default function Team() {
  return (
    <ProtectedRoute>
      <TeamContent />
    </ProtectedRoute>
  );
}

function TeamContent() {
  const { data: player } = useGetCurrentPlayer();
  const { data: myTeams } = useGetMyTeams();
  const { data: invitations } = useListInvitations();
  const { data: ladders } = useListLadders();
  const ladderList = (ladders as any[]) ?? [];
  const teams = (myTeams as any[]) ?? [];
  const laddersWithoutTeam = ladderList.filter(
    l => l.activeSeason && !teams.some(t => t.season?.ladderId === l.id),
  );

  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [inviteeId, setInviteeId] = useState<string | null>(null);
  const [inviteeEmail, setInviteeEmail] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [selectedLadderId, setSelectedLadderId] = useState<string | undefined>(undefined);

  const effectiveLadderId = selectedLadderId ?? laddersWithoutTeam[0]?.id;

  const { data: players } = useListPlayers(
    { search: searchQuery, limit: 8 },
    { query: { enabled: searchQuery.length > 1 && !inviteeId && !inviteeEmail } }
  );

  const sendInvite = useCreateInvitation();
  const acceptInv = useAcceptInvitation();
  const declineInv = useDeclineInvitation();
  const resendInv = useResendInvitation();

  const filteredPlayers = (players as any[] | undefined)?.filter((p: any) => p.id !== player?.id) ?? [];
  const showDropdown = filteredPlayers.length > 0 && !inviteeId && !inviteeEmail;

  const emailFromInput = !inviteeId && !inviteeEmail && isValidEmail(searchQuery) ? searchQuery.trim() : null;
  const canSend = !!teamName && !!effectiveLadderId && (!!inviteeId || !!inviteeEmail || !!emailFromInput);

  const handleSendInvite = () => {
    if (!canSend) return;
    const payload: any = { data: { teamName, ladderId: effectiveLadderId } };
    if (inviteeId) payload.data.inviteeId = inviteeId;
    else payload.data.inviteeEmail = inviteeEmail ?? emailFromInput;

    sendInvite.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Invitation sent!" });
        setShowInviteForm(false);
        setInviteeId(null);
        setInviteeEmail(null);
        setTeamName("");
        setSearchQuery("");
        setSelectedLadderId(undefined);
        qc.invalidateQueries();
      },
      onError: (err: any) => {
        toast({ title: "Failed to send invitation", description: err?.data?.error, variant: "destructive" });
      },
    });
  };

  const handleSelectPlayer = (p: any) => {
    setInviteeId(p.id);
    setInviteeEmail(null);
    setSearchQuery(p.fullName);
  };

  const handleClearSelection = () => {
    setInviteeId(null);
    setInviteeEmail(null);
    setSearchQuery("");
  };

  const handleAccept = (id: string) => {
    acceptInv.mutate({ id }, {
      onSuccess: () => { toast({ title: "Invitation accepted! Welcome to the ladder!" }); qc.invalidateQueries(); },
      onError: (err: any) => toast({ title: "Failed to accept", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleDecline = (id: string) => {
    declineInv.mutate({ id }, {
      onSuccess: () => { toast({ title: "Invitation declined" }); qc.invalidateQueries(); },
      onError: (err: any) => toast({ title: "Failed to decline", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const pendingReceived = invitations?.received?.filter((i: any) => i.status === "pending") ?? [];
  const sentInvitations = invitations?.sent ?? [];

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-2">
          <Users className="w-8 h-8 text-primary" />
          My Teams
        </h1>

        {/* Current Teams */}
        {teams.length > 0 ? (
          <div className="space-y-4 mb-6">
            {teams.map((team: any) => (
              <TeamCard key={team.id} team={team} ladders={ladderList} />
            ))}
          </div>
        ) : (
          <Card className="border-primary/10 mb-6">
            <CardContent className="py-10 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">You're not on any team yet</p>
              <p className="text-muted-foreground mb-6">Invite a partner to form a team and join a ladder.</p>
              <Button onClick={() => setShowInviteForm(true)} disabled={laddersWithoutTeam.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                Invite a Partner
              </Button>
              {laddersWithoutTeam.length === 0 && (
                <p className="text-xs text-muted-foreground mt-3">No ladders with active seasons available.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invite Form: Available if any ladder still has no team */}
        {laddersWithoutTeam.length > 0 && (showInviteForm ? (
          <Card className="border-primary/10 mb-6">
            <CardHeader>
              <CardTitle>Invite a Partner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {laddersWithoutTeam.length > 1 && (
                <div>
                  <Label>Ladder</Label>
                  <Select value={effectiveLadderId} onValueChange={setSelectedLadderId}>
                    <SelectTrigger className="mt-1" data-testid="select-invite-ladder">
                      <SelectValue placeholder="Select ladder" />
                    </SelectTrigger>
                    <SelectContent>
                      {laddersWithoutTeam.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {laddersWithoutTeam.length === 1 && (
                <p className="text-sm text-muted-foreground">
                  Ladder: <span className="font-semibold text-foreground">{laddersWithoutTeam[0].name}</span>
                </p>
              )}

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
                <Label>Partner's Name or Email</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Search for someone already on the app, or type their email to invite them to join.
                </p>

                {(inviteeId || inviteeEmail) ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-50 border-green-200">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{searchQuery}</p>
                      {inviteeEmail && <p className="text-xs text-green-600">Will receive an email invite to join</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearSelection} className="text-green-700 h-7 px-2">
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search by name, or type an email address..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="mt-1"
                      data-testid="input-search-partner"
                    />

                    {showDropdown && (
                      <div className="absolute z-10 w-full mt-1 border rounded-lg bg-white shadow-lg divide-y">
                        {filteredPlayers.map((p: any) => (
                          <button
                            key={p.id}
                            className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left"
                            onClick={() => handleSelectPlayer(p)}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                              {p.fullName[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{p.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery.length > 1 && isValidEmail(searchQuery) && filteredPlayers.length === 0 && (
                      <div className="mt-2 p-3 border rounded-lg bg-blue-50 border-blue-200 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">{searchQuery.trim()}</span> isn't on the app yet — they'll get an email invite to sign up.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSendInvite}
                  disabled={sendInvite.isPending || !canSend}
                  data-testid="btn-send-invite"
                >
                  {sendInvite.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Send className="w-4 h-4 mr-2" />}
                  Send Invitation
                </Button>
                <Button variant="outline" onClick={() => { setShowInviteForm(false); handleClearSelection(); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-6">
            <Button variant="outline" onClick={() => setShowInviteForm(true)}>
              <Send className="w-4 h-4 mr-2" /> Invite a Partner for Another Ladder
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
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white rounded-lg border">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{inv.teamName}</p>
                    <p className="text-sm text-muted-foreground">From: {inv.inviter?.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      Season: {inv.season?.name}
                      {inv.season?.ladderId && (() => {
                        const l = ladderList.find((x: any) => x.id === inv.season.ladderId);
                        return l ? <> · Ladder: {l.name}</> : null;
                      })()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
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
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">{inv.teamName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      To: {inv.invitee?.fullName ?? inv.inviteeEmail ?? "—"}
                    </p>
                    {inv.inviteeEmail && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Awaiting registration
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          resendInv.mutate({ id: inv.id }, {
                            onSuccess: () => toast({ title: "Invitation resent!" }),
                            onError: (err: any) => toast({ title: "Failed to resend", description: err?.data?.error, variant: "destructive" }),
                          });
                        }}
                        disabled={resendInv.isPending}
                        data-testid={`btn-resend-${inv.id}`}
                      >
                        {resendInv.isPending && resendInv.variables?.id === inv.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Send className="w-4 h-4 mr-1" />}
                        Resend
                      </Button>
                    )}
                    <Badge variant={inv.status === "pending" ? "outline" : inv.status === "accepted" ? "default" : "secondary"}>
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function TeamCard({ team, ladders }: { team: any; ladders: any[] }) {
  const ladderName = useMemo(() => {
    const l = ladders.find((x: any) => x.id === team.season?.ladderId);
    return l?.name ?? "Ladder";
  }, [ladders, team.season?.ladderId]);

  const { data: pos } = useGetMyLadderPosition({ ladder_id: team.season?.ladderId });
  const myStanding = pos?.myStanding;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">{ladderName}</span>
        </div>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="break-words">{team.teamName}</span>
          {myStanding && <Badge className="text-base font-bold px-3 py-1 self-start sm:self-auto">#{myStanding.position}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Player 1</p>
            <p className="font-semibold break-words">{team.player1?.fullName ?? "—"}</p>
            <p className="text-sm text-muted-foreground break-all">{team.player1?.email ?? ""}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Player 2</p>
            <p className="font-semibold break-words">{team.player2?.fullName ?? "—"}</p>
            <p className="text-sm text-muted-foreground break-all">{team.player2?.email ?? ""}</p>
          </div>
        </div>
        {myStanding && (
          <div className="mt-4 pt-4 border-t flex flex-wrap items-end gap-4 sm:gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Wins</p>
              <p className="text-2xl font-black text-green-600">{myStanding.wins}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Losses</p>
              <p className="text-2xl font-black text-red-500">{myStanding.losses}</p>
            </div>
            <div className="ml-auto">
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
  );
}
