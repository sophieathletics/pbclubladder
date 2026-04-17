import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetAvailability, useGetChallenge, useSubmitAvailability } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function Availability() {
  return (
    <ProtectedRoute>
      <AvailabilityContent />
    </ProtectedRoute>
  );
}

const ALL_TIME_SLOTS = [
  { label: "9am", value: "09:00" },
  { label: "10am", value: "10:00" },
  { label: "11am", value: "11:00" },
  { label: "12pm", value: "12:00" },
  { label: "1pm", value: "13:00" },
  { label: "2pm", value: "14:00" },
  { label: "3pm", value: "15:00" },
  { label: "4pm", value: "16:00" },
  { label: "5pm", value: "17:00" },
  { label: "6pm", value: "18:00" },
  { label: "7pm", value: "19:00" },
];

const WEEKEND_END_VALUE = "16:00"; // Sat/Sun end at 4pm
const WEEKDAY_END_VALUE = "19:00"; // Mon-Fri end at 7pm

function slotsForDate(dateValue: string) {
  const d = new Date(dateValue + "T00:00:00");
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const endValue = isWeekend ? WEEKEND_END_VALUE : WEEKDAY_END_VALUE;
  return ALL_TIME_SLOTS.filter(t => t.value <= endValue);
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function AvailabilityContent() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const { data: availData } = useGetAvailability(challengeId!);
  const { data: challenge } = useGetChallenge(challengeId!);
  const submitAvail = useSubmitAvailability();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  // Generate the next 14 days
  const dates = useMemo(() => {
    const out: { value: string; weekday: string; day: string; month: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push({
        value: formatDate(d),
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
        day: String(d.getDate()),
        month: d.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    return out;
  }, []);

  // selected: Set of "date|time"
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleCell = (date: string, time: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = `${date}|${time}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllForDate = (date: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      const slots = slotsForDate(date);
      const allSelected = slots.every(t => next.has(`${date}|${t.value}`));
      if (allSelected) {
        slots.forEach(t => next.delete(`${date}|${t.value}`));
      } else {
        slots.forEach(t => next.add(`${date}|${t.value}`));
      }
      return next;
    });
  };

  const handleSubmit = () => {
    // Group selected cells by date
    const byDate = new Map<string, string[]>();
    selected.forEach(key => {
      const [date, time] = key.split("|");
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(time);
    });

    if (byDate.size === 0) {
      toast({ title: "Pick at least one time slot", variant: "destructive" });
      return;
    }

    const cleaned = Array.from(byDate.entries())
      .map(([date, times]) => ({ date, times: times.sort() }))
      .sort((a, b) => a.date.localeCompare(b.date));

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
  const totalSelected = selected.size;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
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
          Tap the times when you and your teammate are both available to play. Weekdays 9 AM – 7 PM, weekends 9 AM – 4 PM.
          {c && <span> Challenge: <strong>{c.challengerTeam?.teamName}</strong> vs <strong>{c.challengedTeam?.teamName}</strong></span>}
        </p>

        {/* Existing availability status */}
        {avail && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className={`p-3 rounded-lg border text-sm ${avail.challengerAvailability ? "border-green-200 bg-green-50" : "border-muted"}`} data-testid="status-challenger">
              <div className="flex items-center gap-2 font-medium">
                {avail.challengerAvailability ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="w-4 h-4 rounded-full border-2 inline-block" />}
                {c?.challengerTeam?.teamName ?? "Challenger"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {avail.challengerAvailability ? "Submitted" : "Not submitted yet"}
              </p>
            </div>
            <div className={`p-3 rounded-lg border text-sm ${avail.challengedAvailability ? "border-green-200 bg-green-50" : "border-muted"}`} data-testid="status-challenged">
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Pick Your Times</CardTitle>
              <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
                {totalSelected} {totalSelected === 1 ? "slot" : "slots"} selected
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dates.map(date => {
                const slotsForThisDate = slotsForDate(date.value);
                const allSelected = slotsForThisDate.every(t => selected.has(`${date.value}|${t.value}`));
                const anySelected = slotsForThisDate.some(t => selected.has(`${date.value}|${t.value}`));
                return (
                  <div key={date.value} className="border rounded-lg p-3" data-testid={`row-date-${date.value}`}>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => toggleAllForDate(date.value)}
                        className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2 -mt-1"
                        data-testid={`btn-date-${date.value}`}
                      >
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted/50">
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">{date.weekday}</span>
                          <span className="text-lg font-bold leading-none">{date.day}</span>
                          <span className="text-[10px] text-muted-foreground">{date.month}</span>
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            {anySelected ? `${slotsForThisDate.filter(t => selected.has(`${date.value}|${t.value}`)).length} times` : "Tap times below"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {allSelected ? "Tap day to clear" : "Tap day to select all"}
                          </div>
                        </div>
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {slotsForThisDate.map(slot => {
                        const key = `${date.value}|${slot.value}`;
                        const isSelected = selected.has(key);
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => toggleCell(date.value, slot.value)}
                            data-testid={`cell-${date.value}-${slot.value}`}
                            className={cn(
                              "h-9 rounded-md text-xs font-medium border transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover-elevate active-elevate-2"
                            )}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSubmit} disabled={submitAvail.isPending} data-testid="btn-submit-availability">
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
