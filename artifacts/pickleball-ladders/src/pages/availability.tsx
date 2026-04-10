import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetAvailability, useGetChallenge, useSubmitAvailability } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Minus, CheckCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Availability() {
  return (
    <ProtectedRoute>
      <AvailabilityContent />
    </ProtectedRoute>
  );
}

function AvailabilityContent() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const { data: availData } = useGetAvailability({ challengeId: challengeId! });
  const { data: challenge } = useGetChallenge({ id: challengeId! });
  const submitAvail = useSubmitAvailability();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [slots, setSlots] = useState<Array<{ date: string; times: string[] }>>([{ date: "", times: [""] }]);

  const addSlot = () => setSlots(prev => [...prev, { date: "", times: [""] }]);
  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));
  const updateDate = (i: number, val: string) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, date: val } : s));
  const addTime = (i: number) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, times: [...s.times, ""] } : s));
  const removeTime = (i: number, ti: number) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, times: s.times.filter((_, tidx) => tidx !== ti) } : s));
  const updateTime = (i: number, ti: number, val: string) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, times: s.times.map((t, tidx) => tidx === ti ? val : t) } : s));

  const handleSubmit = () => {
    const valid = slots.filter(s => s.date && s.times.some(t => t));
    if (valid.length === 0) {
      toast({ title: "Add at least one date and time", variant: "destructive" });
      return;
    }
    const cleaned = valid.map(s => ({ date: s.date, times: s.times.filter(t => t) }));
    submitAvail.mutate(
      { challengeId: challengeId!, data: { slots: cleaned } },
      {
        onSuccess: () => {
          toast({ title: "Availability submitted!" });
          qc.invalidateQueries();
          setLocation(`/challenges/${challengeId}`);
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const c = challenge as any;
  const avail = availData as any;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href={`/challenges/${challengeId}`} className="hover:text-primary">Challenge</Link>
          <span>/</span>
          <span>Availability</span>
        </div>

        <h1 className="text-2xl font-black mb-2 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          Submit Availability
        </h1>
        <p className="text-muted-foreground mb-6">
          Add dates and times when you're available to play.
          {c && <span> Challenge: <strong>{c.challengerTeam?.teamName}</strong> vs <strong>{c.challengedTeam?.teamName}</strong></span>}
        </p>

        {/* Existing availability status */}
        {avail && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className={`p-3 rounded-lg border text-sm ${avail.challengerAvailability ? "border-green-200 bg-green-50" : "border-muted"}`}>
              <div className="flex items-center gap-2 font-medium">
                {avail.challengerAvailability ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="w-4 h-4 rounded-full border-2 inline-block" />}
                {c?.challengerTeam?.teamName ?? "Challenger"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {avail.challengerAvailability ? "Submitted" : "Not submitted yet"}
              </p>
            </div>
            <div className={`p-3 rounded-lg border text-sm ${avail.challengedAvailability ? "border-green-200 bg-green-50" : "border-muted"}`}>
              <div className="flex items-center gap-2 font-medium">
                {avail.challengedAvailability ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="w-4 h-4 rounded-full border-2 inline-block" />}
                {c?.challengedTeam?.teamName ?? "Challenged"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {avail.challengedAvailability ? "Submitted" : "Not submitted yet"}
              </p>
            </div>
          </div>
        )}

        <Card className="border-primary/10 mb-6">
          <CardHeader>
            <CardTitle>Your Available Dates & Times</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {slots.map((slot, i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Date {i + 1}</Label>
                  {slots.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeSlot(i)}>
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Input type="date" value={slot.date} onChange={e => updateDate(i, e.target.value)} />
                <Label>Available Times</Label>
                {slot.times.map((time, ti) => (
                  <div key={ti} className="flex gap-2">
                    <Input type="time" value={time} onChange={e => updateTime(i, ti, e.target.value)} className="flex-1" />
                    {slot.times.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeTime(i, ti)}>
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addTime(i)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Time
                </Button>
              </div>
            ))}

            <Button variant="outline" onClick={addSlot} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add Another Date
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSubmit} disabled={submitAvail.isPending}>
            {submitAvail.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Submit Availability
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/challenges/${challengeId}`}>Back</Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
