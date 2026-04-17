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

  const [bookSlot, setBookSlot] = useState<string | null>(null);
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
    if (!bookSlot || !bookLocation) {
      toast({ title: "Pick a slot and add the court location", variant: "destructive" });
      return;
    }
    const [bookDate, bookTime] = bookSlot.split("|");
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

              <Button variant="outline" size="sm" asChild>
                <Link href={`/availability/${id}`}>
                  <Calendar className="w-4 h-4 mr-1" /> Submit Availability
                </Link>
              </Button>

              {(c.challengerAvailabilitySubmitted || c.challengedAvailabilitySubmitted) && (() => {
                const fmtSlots = (slots: any[]) => {
                  if (!slots || slots.length === 0) return null;
                  return slots
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(s => {
                      const d = new Date(s.date + "T00:00:00");
                      const dayLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                      const times = (s.times as string[]).slice().sort().map(t => {
                        const [hh, mm] = t.split(":");
                        const hr = parseInt(hh, 10);
                        const ampm = hr >= 12 ? "PM" : "AM";
                        const hr12 = hr % 12 === 0 ? 12 : hr % 12;
                        return `${hr12}${mm !== "00" ? ":" + mm : ""}${ampm}`;
                      });
                      return { dayLabel, times };
                    });
                };
                const overlapKey = new Set<string>();
                for (const s of c.overlappingSlots ?? []) {
                  for (const t of s.times) overlapKey.add(`${s.date}|${t}`);
                }
                const renderTeam = (name: string, submitted: boolean, slots: any[]) => {
                  const formatted = fmtSlots(slots);
                  return (
                    <div className="border rounded-lg p-3 bg-muted/20">
                      <p className="text-xs font-semibold mb-2">{name}</p>
                      {!submitted ? (
                        <p className="text-xs text-muted-foreground italic">Not submitted yet</p>
                      ) : !formatted || formatted.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No slots selected</p>
                      ) : (
                        <div className="space-y-1.5">
                          {formatted.map((row, i) => {
                            const dateRaw = (slots as any[]).slice().sort((a, b) => a.date.localeCompare(b.date))[i].date;
                            const rawTimes = ((slots as any[]).find((s: any) => s.date === dateRaw)?.times ?? []).slice().sort();
                            return (
                              <div key={i} className="text-xs">
                                <span className="font-medium">{row.dayLabel}</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {row.times.map((t, j) => {
                                    const isOverlap = overlapKey.has(`${dateRaw}|${rawTimes[j]}`);
                                    return (
                                      <span
                                        key={j}
                                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                                          isOverlap
                                            ? "bg-green-100 text-green-700 border border-green-300"
                                            : "bg-background border border-border text-muted-foreground"
                                        }`}
                                      >
                                        {t}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                };
                return (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderTeam(c.challengerTeam?.teamName, c.challengerAvailabilitySubmitted, c.challengerSlots ?? [])}
                    {renderTeam(c.challengedTeam?.teamName, c.challengedAvailabilitySubmitted, c.challengedSlots ?? [])}
                  </div>
                );
              })()}

              {c.challengerAvailabilitySubmitted && c.challengedAvailabilitySubmitted && (!c.overlappingSlots || c.overlappingSlots.length === 0) && (
                <div className="mt-4 p-3 rounded-lg border border-orange-200 bg-orange-50/60 text-sm">
                  <p className="font-semibold text-orange-700 mb-1 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> No common availability
                  </p>
                  <p className="text-orange-700/90 text-xs">
                    Both teams submitted availability but no time slots overlap. One or both teams should update their availability to find a match time.
                  </p>
                </div>
              )}

              {c.overlappingSlots?.length > 0 && (isChallenger || isChallenged) && (() => {
                const flatSlots: { date: string; time: string; key: string; label: string }[] = [];
                for (const s of c.overlappingSlots) {
                  for (const t of s.times) {
                    const d = new Date(s.date + "T00:00:00");
                    const dayLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                    const [hh, mm] = t.split(":");
                    const hr = parseInt(hh, 10);
                    const ampm = hr >= 12 ? "PM" : "AM";
                    const hr12 = hr % 12 === 0 ? 12 : hr % 12;
                    const timeLabel = `${hr12}${mm !== "00" ? ":" + mm : ""} ${ampm}`;
                    flatSlots.push({ date: s.date, time: t, key: `${s.date}|${t}`, label: `${dayLabel} • ${timeLabel}` });
                  }
                }

                return (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-green-700 mb-2">Common availability found — pick a slot:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                      {flatSlots.map(s => {
                        const isSelected = bookSlot === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => { setBookSlot(s.key); setShowBookForm(true); }}
                            data-testid={`slot-${s.key}`}
                            className={`text-left text-xs px-3 py-2 rounded-md border transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover-elevate active-elevate-2"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>

                    {showBookForm && bookSlot && (
                      <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                        <div>
                          <Label className="text-xs">Court Location</Label>
                          <Input
                            placeholder="e.g. Riverside Courts, Court 3"
                            value={bookLocation}
                            onChange={e => setBookLocation(e.target.value)}
                            className="mt-1"
                            data-testid="input-court-location"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleBook} disabled={bookMatch.isPending} size="sm" data-testid="btn-confirm-booking">
                            {bookMatch.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Confirm Booking
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setShowBookForm(false); setBookSlot(null); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
