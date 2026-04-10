import { useState } from "react";
import { Link } from "wouter";
import { useGetAdminStats, useListAdminPlayers, useListDisputes, useResolveDispute, useGetActiveSeason, useCreateSeason, useActivateSeason, useDeactivateSeason, useGetInactivityLog } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Swords, BarChart3, CheckCircle, AlertTriangle, Calendar, Activity, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Admin() {
  return (
    <ProtectedRoute adminOnly>
      <AdminContent />
    </ProtectedRoute>
  );
}

function AdminContent() {
  const { data: stats } = useGetAdminStats();
  const { data: players } = useListAdminPlayers({});
  const { data: disputes } = useListDisputes({ resolved: false });
  const { data: inactivityLog } = useGetInactivityLog();
  const { data: activeSeason } = useGetActiveSeason();
  const createSeason = useCreateSeason();
  const activateSeason = useActivateSeason();
  const deactivateSeason = useDeactivateSeason();
  const resolveDispute = useResolveDispute();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newSeason, setNewSeason] = useState({ name: "", startDate: "", endDate: "" });
  const [disputeReason, setDisputeReason] = useState<Record<string, string>>({});

  const handleCreateSeason = () => {
    const { name, startDate, endDate } = newSeason;
    if (!name || !startDate || !endDate) {
      toast({ title: "Fill in all season fields", variant: "destructive" });
      return;
    }
    createSeason.mutate(
      { data: { name, startDate, endDate } },
      {
        onSuccess: () => { toast({ title: "Season created!" }); qc.invalidateQueries(); setNewSeason({ name: "", startDate: "", endDate: "" }); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleResolve = (matchId: string, action: "confirm" | "cancel") => {
    resolveDispute.mutate(
      { id: matchId, data: { action } },
      {
        onSuccess: () => { toast({ title: "Dispute resolved!" }); qc.invalidateQueries(); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const s = stats as any;
  const playerList = (players as any[]) ?? [];
  const disputeList = (disputes as any[]) ?? [];
  const inactList = (inactivityLog as any[]) ?? [];

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-2">
          <Shield className="w-8 h-8 text-destructive" />
          Admin Panel
        </h1>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Players", value: s?.totalPlayers ?? "—", icon: <Users className="w-5 h-5" /> },
            { label: "Teams This Season", value: s?.totalTeams ?? "—", icon: <Users className="w-5 h-5" /> },
            { label: "Matches Completed", value: s?.matchesThisSeason ?? "—", icon: <BarChart3 className="w-5 h-5" /> },
            { label: "Open Disputes", value: s?.openDisputes ?? "—", icon: <AlertTriangle className="w-5 h-5" />, danger: (s?.openDisputes ?? 0) > 0 },
          ].map(({ label, value, icon, danger }) => (
            <Card key={label} className={`border-${danger ? "destructive/20" : "primary/10"}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`text-3xl font-black ${danger ? "text-destructive" : "text-primary"}`}>{value}</p>
                  </div>
                  <span className={danger ? "text-destructive/30" : "text-primary/30"}>{icon}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="disputes">
          <TabsList className="mb-6">
            <TabsTrigger value="disputes">
              Disputes {disputeList.length > 0 && <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{disputeList.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="seasons">Seasons</TabsTrigger>
            <TabsTrigger value="inactivity">Inactivity Log</TabsTrigger>
          </TabsList>

          {/* Disputes */}
          <TabsContent value="disputes">
            {disputeList.length === 0 ? (
              <Card className="border-primary/10">
                <CardContent className="py-10 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
                  <p>No open disputes!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {disputeList.map((d: any) => (
                  <Card key={d.matchResult?.id} className="border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-semibold mb-1">
                            {d.match?.challenge?.challengerTeam?.teamName ?? "Team A"} vs {d.match?.challenge?.challengedTeam?.teamName ?? "Team B"}
                          </p>
                          <p className="text-sm text-orange-600 mb-2">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            {d.matchResult?.disputeReason}
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleResolve(d.matchResult?.matchId, "confirm")} disabled={resolveDispute.isPending}>
                              <CheckCircle className="w-4 h-4 mr-1" /> Confirm Original
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleResolve(d.matchResult?.matchId, "cancel")} disabled={resolveDispute.isPending}>
                              Cancel Result
                            </Button>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/matches/${d.matchResult?.matchId}`}>View Match</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Players */}
          <TabsContent value="players">
            <Card className="border-primary/10">
              <CardContent className="p-0">
                <div className="divide-y max-h-96 overflow-y-auto">
                  {playerList.map((p: any) => (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{p.fullName}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.role === "admin" ? "default" : "outline"}>{p.role}</Badge>
                        {!p.isActive && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seasons */}
          <TabsContent value="seasons">
            {activeSeason && (
              <Card className="border-green-200 bg-green-50/40 mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{(activeSeason as any).name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(activeSeason as any).startDate} — {(activeSeason as any).endDate}
                      </p>
                    </div>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="border-primary/10">
              <CardHeader><CardTitle className="text-base">Create New Season</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Season Name</Label>
                  <Input value={newSeason.name} onChange={e => setNewSeason(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Fall 2026" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={newSeason.startDate} onChange={e => setNewSeason(p => ({ ...p, startDate: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" value={newSeason.endDate} onChange={e => setNewSeason(p => ({ ...p, endDate: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                <Button onClick={handleCreateSeason} disabled={createSeason.isPending}>
                  {createSeason.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create Season
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inactivity Log */}
          <TabsContent value="inactivity">
            {inactList.length === 0 ? (
              <Card className="border-primary/10">
                <CardContent className="py-8 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p>No inactivity drops recorded.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/10">
                <CardContent className="p-0">
                  <div className="divide-y">
                    {inactList.slice(0, 50).map((d: any) => (
                      <div key={d.id} className="p-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{d.team?.teamName ?? "Unknown Team"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(d.droppedAt).toLocaleDateString()}</p>
                        </div>
                        <p className="text-muted-foreground">
                          #{d.oldPosition} → #{d.newPosition}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
