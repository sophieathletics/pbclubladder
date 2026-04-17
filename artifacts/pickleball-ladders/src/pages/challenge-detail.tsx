import { Link, useParams } from "wouter";
import { useGetChallenge, useAcceptChallenge, useDeclineChallenge, useCancelChallenge, useBookMatch } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Swords, Users, CheckCircle, XCircle, Calendar, ArrowRight, MapPin, Clock, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChallengeDetail() {
  return (
    <ProtectedRoute>
      <ChallengeDetailContent />
    </ProtectedRoute>
  );
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  accepted: "bg-blue-100 text-blue-700 border-blue-200",
  scheduling: "bg-purple-100 text-purple-700 border-purple-200",
  scheduled: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
  disputed: "bg-orange-100 text-orange-700",
};

function ChallengeDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: challenge, isLoading } = useGetChallenge(id!);
  const acceptChallenge = useAcceptChallenge();
  const declineChallenge = useDeclineChallenge();
  const cancelChallenge = useCancelChallenge();
  const bookMatch = useBookMatch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookLocation, setBookLocation] = useState("");
  const [showBookForm, setShowBookForm] = useState(false);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!challenge) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto py-8 px-4 text-center">
          <p>Challenge not found.</p>
          <Button asChild className="mt-4"><Link href="/dashboard">Back to Dashboard</Link></Button>
        </div>
      </MainLayout>
    );
  }

  const c = challenge as any;
  const isChallenged = c.myTeamId === c.challengedTeam?.id;
  const isChallenger = c.myTeamId === c.challengerTeam?.id;

  const handleAccept = () => {
    acceptChallenge.mutate({ id: id! }, {
      onSuccess: () => { toast({ title: "Challenge accepted!" }); qc.invalidateQueries(); },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleDecline = () => {
    declineChallenge.mutate({ id: id! }, {
      onSuccess: () => { toast({ title: "Challenge declined" }); qc.invalidateQueries(); setLocation("/dashboard"); },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleCancel = () => {
    cancelChallenge.mutate({ id: id! }, {
      onSuccess: () => { toast({ title: "Challenge cancelled" }); qc.invalidateQueries(); setLocation("/dashboard"); },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleBook = () => {
    if (!bookDate || !bookTime || !bookLocation) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    bookMatch.mutate(
      { id: id!, data: { date: bookDate, time: bookTime, courtLocation: bookLocation } },
      {
        onSuccess: (data: any) => {
          toast({ title: "Match booked!" });
          qc.invalidateQueries();
          setLocation(`/matches/${data.id}`);
        },
        onError: (err: any) => toast({ title: "Error booking", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
          <span>/</span>
          <span>Challenge</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Swords className="w-6 h-6 text-primary" />
            Challenge
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border capitalize ${statusColors[c.status] ?? "bg-gray-100"}`}>
            {c.status}
          </span>
        </div>

        {/* Teams */}
        <Card className="border-primary/10 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Challenger</p>
                <p className="font-bold text-lg">{c.challengerTeam?.teamName}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-primary">#{c.challengerTeam?.standing?.position}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.challengerTeam?.player1?.fullName} &amp; {c.challengerTeam?.player2?.fullName}
                </p>
              </div>
              <div className="text-2xl font-black text-muted-foreground">VS</div>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Challenged</p>
                <p className="font-bold text-lg">{c.challengedTeam?.teamName}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-primary">#{c.challengedTeam?.standing?.position}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.challengedTeam?.player1?.fullName} &amp; {c.challengedTeam?.player2?.fullName}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Match details if scheduled */}
        {c.match && c.status === "scheduled" && (
          <Card className="border-green-200 bg-green-50/40 mb-6">
            <CardHeader><CardTitle className="text-green-800 flex items-center gap-2"><Calendar className="w-5 h-5" /> Match Scheduled</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /> {c.match.scheduledDate}</p>
              <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> {c.match.scheduledTime}</p>
              <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {c.match.courtLocation}</p>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link href={`/matches/${c.match.id}`}>View Match Details <ArrowRight className="w-3 h-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Availability status */}
        {["accepted", "scheduling"].includes(c.status) && (
          <Card className="border-primary/10 mb-6">
            <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {c.challengerAvailabilitySubmitted
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm">{c.challengerTeam?.teamName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {c.challengedAvailabilitySubmitted
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm">{c.challengedTeam?.teamName}</span>
                </div>
              </div>

              {c.overlappingSlots && c.overlappingSlots.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-green-700 mb-2">Common availability found:</p>
                  <ul className="text-sm space-y-1">
                    {c.overlappingSlots.map((slot: any) => (
                      slot.times.map((t: string) => (
                        <li key={`${slot.date}-${t}`} className="text-muted-foreground">• {slot.date} at {t}</li>
                      ))
                    ))}
                  </ul>
                </div>
              )}

              <Button variant="outline" size="sm" asChild>
                <Link href={`/availability/${id}`}>
                  <Calendar className="w-4 h-4 mr-1" /> Submit Availability
                </Link>
              </Button>

              {c.overlappingSlots?.length > 0 && (isChallenger || isChallenged) && (
                <div className="mt-4">
                  {!showBookForm ? (
                    <Button size="sm" onClick={() => setShowBookForm(true)}>
                      Book the Match
                    </Button>
                  ) : (
                    <div className="space-y-3 mt-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input type="time" value={bookTime} onChange={e => setBookTime(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Court Location</Label>
                        <Input placeholder="e.g. Riverside Courts, Court 3" value={bookLocation} onChange={e => setBookLocation(e.target.value)} className="mt-1" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleBook} disabled={bookMatch.isPending} size="sm">
                          {bookMatch.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                          Confirm Booking
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowBookForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {c.status === "pending" && isChallenged && (
            <>
              <Button onClick={handleAccept} disabled={acceptChallenge.isPending} data-testid="btn-accept">
                <CheckCircle className="w-4 h-4 mr-1" /> Accept Challenge
              </Button>
              <Button variant="outline" onClick={handleDecline} disabled={declineChallenge.isPending} data-testid="btn-decline">
                <XCircle className="w-4 h-4 mr-1" /> Decline
              </Button>
            </>
          )}
          {["pending", "accepted", "scheduling"].includes(c.status) && (isChallenger || isChallenged) && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelChallenge.isPending}>
              Cancel Challenge
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
