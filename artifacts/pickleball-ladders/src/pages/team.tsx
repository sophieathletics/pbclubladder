import { useState, useMemo, useEffect } from "react";
import { Link, useSearch } from "wouter";
import {
  useGetCurrentPlayer,
  useGetMyTeams,
  useWithdrawTeam,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Send, CheckCircle, XCircle, Trophy, Mail, Loader2, CreditCard } from "lucide-react";
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

  const search = useSearch();
  const requestedLadderId = useMemo(() => new URLSearchParams(search).get("ladder") ?? undefined, [search]);
  const requestedLadder = useMemo(
    () => ladderList.find(l => l.id === requestedLadderId),
    [ladderList, requestedLadderId]
  );
  const alreadyOnRequestedLadder = !!requestedLadderId && teams.some((t: any) => t.season?.ladderId === requestedLadderId);
  const canJoinRequested = !!requestedLadderId && laddersWithoutTeam.some(l => l.id === requestedLadderId);

  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [inviteeId, setInviteeId] = useState<string | null>(null);
  const [inviteeEmail, setInviteeEmail] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [selectedLadderId, setSelectedLadderId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (canJoinRequested && requestedLadderId) {
      setSelectedLadderId(requestedLadderId);
      setShowInviteForm(true);
    }
  }, [canJoinRequested, requestedLadderId]);

  const effectiveLadderId = selectedLadderId ?? requestedLadderId ?? laddersWithoutTeam[0]?.id;

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

        {/* Banner shown when arriving via Join button on a specific ladder */}
        {requestedLadder && (
          <Card className="border-2 border-primary/40 bg-primary/5 mb-6 shadow-sm">
            <CardContent className="py-4 px-5">
              {alreadyOnRequestedLadder ? (
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">You're already on the {requestedLadder.name} ladder.</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Find your team below, or pick a different ladder from the <Link href="/ladders" className="text-primary underline">ladder list</Link>.
                    </p>
                  </div>
                </div>
              ) : canJoinRequested ? (
                <div className="flex items-start gap-3">
                  <Send className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">To join {requestedLadder.name}, you need a team first.</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Invite a partner below to form a new team — or accept a pending invitation if someone already invited you.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{requestedLadder.name} isn't open right now.</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      It either has no active season yet, or you can't join based on your category. <Link href="/ladders" className="text-primary underline">Browse other ladders</Link>.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prominent CTA at top — visible whenever any ladder still needs a team */}
        {laddersWithoutTeam.length > 0 && !showInviteForm && (
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 mb-6 shadow-md">
            <CardContent className="py-5 px-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 mb-1">
                  <Send className="w-5 h-5 text-primary" />
                  {teams.length === 0 ? "Start your first team" : "Join another ladder"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {teams.length === 0
                    ? "Invite a partner to form a team and start competing."
                    : `${laddersWithoutTeam.length} ladder${laddersWithoutTeam.length === 1 ? "" : "s"} ${laddersWithoutTeam.length === 1 ? "is" : "are"} open — invite a partner to join.`}
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => setShowInviteForm(true)}
                className="w-full sm:w-auto shrink-0 font-semibold"
                data-testid="btn-invite-cta"
              >
                <Send className="w-4 h-4 mr-2" />
                Invite a Partner
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Invite Form: Available if any ladder still has no team — shown at top so it stays prominent */}
        {laddersWithoutTeam.length > 0 && showInviteForm && (
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
        )}

        {/* Current Teams */}
        {teams.length > 0 ? (
          <div className="space-y-4 mb-6">
            {teams.map((team: any) => (
              <TeamCard key={team.id} team={team} ladders={ladderList} />
            ))}
          </div>
        ) : laddersWithoutTeam.length === 0 && !showInviteForm ? (
          <Card className="border-primary/10 mb-6">
            <CardContent className="py-10 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">You're not on any team yet</p>
              <p className="text-xs text-muted-foreground mt-3">No ladders with active seasons available.</p>
            </CardContent>
          </Card>
        ) : null}

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
                    {inv.teamDissolved ? (
                      <Badge variant="secondary">dissolved</Badge>
                    ) : (
                      <Badge variant={inv.status === "pending" ? "outline" : inv.status === "accepted" ? "default" : "secondary"}>
                        {inv.status}
                      </Badge>
                    )}
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
  const { data: me } = useGetCurrentPlayer();
  const { toast: cardToast } = useToast();
  const cardQc = useQueryClient();
  const withdrawMut = useWithdrawTeam({
    mutation: {
      onSuccess: (data: any) => {
        const cents = data?.refundedAmountCents ?? 0;
        cardToast({
          title: "Team dissolved",
          description: data?.refundIssued
            ? `You've been refunded $${(cents / 100).toFixed(2)}.`
            : "Your team has been dissolved. No refund was issued (outside the 48-hour window or no payment on file).",
        });
        cardQc.invalidateQueries();
      },
      onError: (err: any) => {
        cardToast({
          title: "Could not leave team",
          description: err?.response?.data?.error ?? "Please try again or contact support.",
          variant: "destructive",
        });
      },
    },
  });
  const ladder = useMemo(
    () => ladders.find((x: any) => x.id === team.season?.ladderId),
    [ladders, team.season?.ladderId]
  );
  const ladderName = ladder?.name ?? "Ladder";

  const { data: pos } = useGetMyLadderPosition({ ladder_id: team.season?.ladderId });
  const myStanding = pos?.myStanding;

  const feeRequired = team.paymentStatus !== "not_required";
  const feeDollars = ladder?.entryFeeCents != null ? (ladder.entryFeeCents / 100).toFixed(2) : null;

  const amIPlayer1 = me?.id === team.player1Id;
  const amIPlayer2 = me?.id === team.player2Id;
  const fullyPaid = team.paymentStatus === "paid";
  // Legacy teams may have paymentStatus="paid" without per-player timestamps — treat as both paid.
  const player1Paid = fullyPaid || !!team.player1PaidAt;
  const player2Paid = fullyPaid || !!team.player2PaidAt;
  const iPaid = amIPlayer1 ? player1Paid : amIPlayer2 ? player2Paid : false;
  const partnerPaid = amIPlayer1 ? player2Paid : amIPlayer2 ? player1Paid : false;
  const partnerName = amIPlayer1 ? team.player2?.fullName : amIPlayer2 ? team.player1?.fullName : null;

  const showPayCta = feeRequired && !iPaid;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0 break-words text-2xl font-black text-primary">
            <Trophy className="w-6 h-6 shrink-0" />
            {ladderName}
          </span>
          {myStanding && <Badge className="text-base font-bold px-3 py-1 self-start sm:self-auto">#{myStanding.position}</Badge>}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">Team:</span>
          <span className="text-sm font-semibold break-words">{team.teamName}</span>
          {fullyPaid && (
            <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50">Team Paid</Badge>
          )}
          {feeRequired && !fullyPaid && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Payment due</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showPayCta && (
          <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Pay your {feeDollars ? `$${feeDollars}` : ""} entry fee to start challenging.
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Each player pays their own entry fee.
                {partnerName && (partnerPaid
                  ? ` ${partnerName} has paid.`
                  : ` ${partnerName} hasn't paid yet.`)}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0" data-testid={`btn-pay-${team.id}`}>
              <Link href={`/pay/${team.id}`}>
                <CreditCard className="w-4 h-4 mr-1" />
                Pay {feeDollars ? `$${feeDollars}` : "now"}
              </Link>
            </Button>
          </div>
        )}
        {feeRequired && iPaid && !partnerPaid && partnerName && (
          <div className="mb-4 p-3 rounded-lg border border-blue-300 bg-blue-50 text-sm">
            <p className="text-blue-900">
              <span className="font-semibold">You're paid up.</span> Waiting on {partnerName} to pay before your team can challenge or be challenged.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Player 1</p>
              {feeRequired && (
                player1Paid
                  ? <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50">Paid</Badge>
                  : <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Unpaid</Badge>
              )}
            </div>
            <p className="font-semibold break-words">{team.player1?.fullName ?? "—"}</p>
            <p className="text-sm text-muted-foreground break-all">{team.player1?.email ?? ""}</p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Player 2</p>
              {feeRequired && (
                player2Paid
                  ? <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50">Paid</Badge>
                  : <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Unpaid</Badge>
              )}
            </div>
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
        {(amIPlayer1 || amIPlayer2) && (
          <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 text-xs text-muted-foreground">
              Need to step away? Leaving the team dissolves it for both players. Refunds are issued automatically if it's been less than 48 hours since you paid.
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/5"
                  data-testid={`btn-leave-team-${team.id}`}
                >
                  Leave Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave team "{team.teamName}"?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm">
                      <p>This dissolves the team for both you and {partnerName ?? "your partner"}. You can join a new team afterward.</p>
                      {feeRequired && iPaid && (
                        <p>If it's been less than 48 hours since you paid, your {feeDollars ? `$${feeDollars}` : ""} entry fee will be refunded automatically. After 48 hours, refunds require admin approval.</p>
                      )}
                      <p className="text-amber-700 font-medium">You can't leave if your team has played a completed match or has an open challenge — finish those first.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => withdrawMut.mutate({ id: team.id })}
                    disabled={withdrawMut.isPending}
                    data-testid={`btn-confirm-leave-${team.id}`}
                  >
                    {withdrawMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Yes, leave team
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
