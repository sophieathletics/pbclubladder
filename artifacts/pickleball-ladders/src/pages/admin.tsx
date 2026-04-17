import { useState } from "react";
import { Link } from "wouter";
import {
  useGetAdminStats, useListAdminPlayers, useListDisputes, useResolveDispute,
  useCreateSeason, useActivateSeason, useDeactivateSeason, useGetInactivityLog,
  useListLadders, useCreateLadder, useUpdateLadder, useListSeasons,
} from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, BarChart3, CheckCircle, AlertTriangle, Activity, Loader2, Layers, Edit3, Plus, Minus } from "lucide-react";
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
  const { data: ladders } = useListLadders();
  const { data: allSeasons } = useListSeasons();
  const createSeason = useCreateSeason();
  const activateSeason = useActivateSeason();
  const deactivateSeason = useDeactivateSeason();
  const resolveDispute = useResolveDispute();
  const createLadder = useCreateLadder();
  const updateLadder = useUpdateLadder();
  const { toast } = useToast();
  const qc = useQueryClient();

  const ladderList = (ladders as any[]) ?? [];
  const seasonList = (allSeasons as any[]) ?? [];
  const playerList = (players as any[]) ?? [];
  const disputeList = (disputes as any[]) ?? [];
  const inactList = (inactivityLog as any[]) ?? [];
  const s = stats as any;

  const [newSeason, setNewSeason] = useState({ name: "", startDate: "", endDate: "", ladderId: "" });
  const [newLadder, setNewLadder] = useState<{ name: string; description: string; category: "men" | "women" | "mixed" | "coed" }>({ name: "", description: "", category: "coed" });

  const handleCreateSeason = () => {
    const { name, startDate, endDate, ladderId } = newSeason;
    if (!name || !startDate || !endDate || !ladderId) {
      toast({ title: "Fill in all season fields including ladder", variant: "destructive" });
      return;
    }
    createSeason.mutate(
      { data: { name, startDate, endDate, ladderId } },
      {
        onSuccess: () => { toast({ title: "Season created!" }); qc.invalidateQueries(); setNewSeason({ name: "", startDate: "", endDate: "", ladderId: "" }); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleCreateLadder = () => {
    if (!newLadder.name) {
      toast({ title: "Ladder name is required", variant: "destructive" });
      return;
    }
    createLadder.mutate(
      { data: newLadder },
      {
        onSuccess: () => { toast({ title: "Ladder created!" }); qc.invalidateQueries(); setNewLadder({ name: "", description: "", category: "coed" }); },
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

  const handleToggleSeason = (season: any) => {
    const mutation = season.isActive ? deactivateSeason : activateSeason;
    mutation.mutate(
      { id: season.id },
      {
        onSuccess: () => { toast({ title: season.isActive ? "Season deactivated" : "Season activated" }); qc.invalidateQueries(); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-2">
          <Shield className="w-8 h-8 text-destructive" />
          Admin Panel
        </h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Players", value: s?.totalPlayers ?? "—", icon: <Users className="w-5 h-5" /> },
            { label: "Teams (All Ladders)", value: s?.totalTeams ?? "—", icon: <Users className="w-5 h-5" /> },
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
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="disputes">
              Disputes {disputeList.length > 0 && <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{disputeList.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="ladders">Ladders</TabsTrigger>
            <TabsTrigger value="seasons">Seasons</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
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
                  <DisputeCard
                    key={d.matchResult?.id}
                    dispute={d}
                    onResolve={handleResolve}
                    onOverride={(matchId, correctedGames, winnerTeamId) => {
                      resolveDispute.mutate(
                        { id: matchId, data: { action: "correct", correctedGames, winnerTeamId } },
                        {
                          onSuccess: () => { toast({ title: "Result overridden!" }); qc.invalidateQueries(); },
                          onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
                        }
                      );
                    }}
                    isPending={resolveDispute.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ladders */}
          <TabsContent value="ladders" className="space-y-4">
            <Card className="border-primary/10">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4" /> Ladders</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {ladderList.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No ladders yet. Create one below.</p>
                  ) : ladderList.map((l: any) => (
                    <LadderRow key={l.id} ladder={l} onUpdate={updateLadder} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardHeader><CardTitle className="text-base">Create New Ladder</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={newLadder.name} onChange={e => setNewLadder(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Men's 3.5" className="mt-1" data-testid="input-new-ladder-name" />
                </div>
                <div>
                  <Label className="text-xs">Description (optional)</Label>
                  <Input value={newLadder.description} onChange={e => setNewLadder(p => ({ ...p, description: e.target.value }))} placeholder="Short description of this ladder" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={newLadder.category} onValueChange={(v) => setNewLadder(p => ({ ...p, category: v as any }))}>
                    <SelectTrigger className="mt-1" data-testid="select-new-ladder-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="men">Men's</SelectItem>
                      <SelectItem value="women">Women's</SelectItem>
                      <SelectItem value="mixed">Mixed (1 man + 1 woman per team)</SelectItem>
                      <SelectItem value="coed">Co-ed (any combination)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {newLadder.category === "men" && "Only male players can join."}
                    {newLadder.category === "women" && "Only female players can join."}
                    {newLadder.category === "mixed" && "Each team must have one man and one woman."}
                    {newLadder.category === "coed" && "Open to any combination of players."}
                  </p>
                </div>
                <Button onClick={handleCreateLadder} disabled={createLadder.isPending} data-testid="btn-create-ladder">
                  {createLadder.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create Ladder
                </Button>
              </CardContent>
            </Card>
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
          <TabsContent value="seasons" className="space-y-4">
            <Card className="border-primary/10">
              <CardHeader><CardTitle className="text-base">All Seasons (per Ladder)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {seasonList.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No seasons yet.</p>
                  ) : seasonList.map((season: any) => {
                    const ladder = ladderList.find((l: any) => l.id === season.ladderId);
                    return (
                      <div key={season.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{season.name}</p>
                            {season.isActive && <Badge className="bg-green-600 text-xs">Active</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {ladder?.name ?? "(no ladder)"} · {season.startDate} → {season.endDate}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={season.isActive ? "outline" : "default"}
                          onClick={() => handleToggleSeason(season)}
                          disabled={activateSeason.isPending || deactivateSeason.isPending}
                        >
                          {season.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/10">
              <CardHeader><CardTitle className="text-base">Create New Season</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Ladder</Label>
                  <Select value={newSeason.ladderId} onValueChange={v => setNewSeason(p => ({ ...p, ladderId: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-season-ladder">
                      <SelectValue placeholder={ladderList.length === 0 ? "Create a ladder first" : "Select ladder"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ladderList.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
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
                <Button onClick={handleCreateSeason} disabled={createSeason.isPending || ladderList.length === 0} data-testid="btn-create-season">
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

function LadderRow({ ladder, onUpdate }: { ladder: any; onUpdate: ReturnType<typeof useUpdateLadder> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ladder.name);
  const [description, setDescription] = useState(ladder.description ?? "");
  const [category, setCategory] = useState<"men" | "women" | "mixed" | "coed">(ladder.category ?? "coed");
  const [isActive, setIsActive] = useState(ladder.isActive);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleSave = () => {
    onUpdate.mutate(
      { id: ladder.id, data: { name, description, isActive, category } },
      {
        onSuccess: () => { toast({ title: "Ladder updated" }); qc.invalidateQueries(); setEditing(false); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  if (editing) {
    return (
      <div className="p-3 space-y-2">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
        <Select value={category} onValueChange={(v) => setCategory(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="men">Men's</SelectItem>
            <SelectItem value="women">Women's</SelectItem>
            <SelectItem value="mixed">Mixed (1 man + 1 woman)</SelectItem>
            <SelectItem value="coed">Co-ed</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Active
        </label>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={onUpdate.isPending}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  const categoryLabel: Record<string, string> = { men: "Men's", women: "Women's", mixed: "Mixed", coed: "Co-ed" };
  const cat = ladder.category ?? "coed";

  return (
    <div className="p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{ladder.name}</p>
          <Badge variant="outline" className="text-xs">{categoryLabel[cat]}</Badge>
          {!ladder.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
          {ladder.activeSeason && <Badge variant="outline" className="text-xs">{ladder.activeSeason.name}</Badge>}
        </div>
        {ladder.description && <p className="text-xs text-muted-foreground truncate">{ladder.description}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
    </div>
  );
}

function DisputeCard({
  dispute,
  onResolve,
  onOverride,
  isPending,
}: {
  dispute: any;
  onResolve: (matchId: string, action: "confirm" | "cancel") => void;
  onOverride: (matchId: string, correctedGames: any[], winnerTeamId: string) => void;
  isPending: boolean;
}) {
  const d = dispute;
  const matchId = d.matchResult?.matchId;
  const challengerTeam = d.match?.challenge?.challengerTeam;
  const challengedTeam = d.match?.challenge?.challengedTeam;
  const originalScores = (d.match?.scores ?? []) as any[];

  const [overriding, setOverriding] = useState(false);
  const [games, setGames] = useState<{ gameNumber: number; team1Score: number; team2Score: number }[]>(
    originalScores.length > 0
      ? originalScores.map(s => ({ gameNumber: s.gameNumber, team1Score: s.team1Score, team2Score: s.team2Score }))
      : [{ gameNumber: 1, team1Score: 0, team2Score: 0 }]
  );
  const [tieBreakerWinnerId, setTieBreakerWinnerId] = useState("");

  const updateScore = (i: number, field: "team1Score" | "team2Score", val: number) =>
    setGames(prev => prev.map((g, gi) => (gi === i ? { ...g, [field]: val } : g)));
  const addGame = () => setGames(prev => [...prev, { gameNumber: prev.length + 1, team1Score: 0, team2Score: 0 }]);
  const removeGame = () => setGames(prev => prev.slice(0, -1));

  let team1Wins = 0;
  let team2Wins = 0;
  for (const g of games) {
    const a = Number(g.team1Score) || 0;
    const b = Number(g.team2Score) || 0;
    if (a === b) continue;
    if (a > b) team1Wins++;
    else team2Wins++;
  }
  const isTie = team1Wins > 0 && team1Wins === team2Wins;
  const computedWinnerId =
    !challengerTeam?.id || !challengedTeam?.id || (team1Wins === 0 && team2Wins === 0)
      ? ""
      : team1Wins > team2Wins
        ? challengerTeam.id
        : team2Wins > team1Wins
          ? challengedTeam.id
          : "";
  const effectiveWinnerId = computedWinnerId || (isTie ? tieBreakerWinnerId : "");

  const submitOverride = () => {
    if (!effectiveWinnerId) return;
    onOverride(matchId, games, effectiveWinnerId);
  };

  return (
    <Card className="border-orange-200">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-1 break-words">
              {challengerTeam?.teamName ?? "Team A"} vs {challengedTeam?.teamName ?? "Team B"}
            </p>
            <p className="text-sm text-orange-600 mb-2">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {d.matchResult?.disputeReason}
            </p>
            {originalScores.length > 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                <span className="font-semibold">Original score: </span>
                {originalScores.map((s: any) => `${s.team1Score}–${s.team2Score}`).join(", ")}
                {d.matchResult?.winnerTeamId && (
                  <> · Winner: <span className="font-semibold">{[challengerTeam, challengedTeam].find((t: any) => t?.id === d.matchResult.winnerTeamId)?.teamName ?? "?"}</span></>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild className="self-start shrink-0">
            <Link href={`/matches/${matchId}`}>View Match</Link>
          </Button>
        </div>

        {!overriding ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onResolve(matchId, "confirm")} disabled={isPending}>
              <CheckCircle className="w-4 h-4 mr-1" /> Confirm Original
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOverriding(true)} disabled={isPending} data-testid="btn-override">
              <Edit3 className="w-4 h-4 mr-1" /> Override Score
            </Button>
            <Button size="sm" variant="outline" onClick={() => onResolve(matchId, "cancel")} disabled={isPending}>
              Cancel Result
            </Button>
          </div>
        ) : (
          <div className="space-y-3 p-3 bg-muted/40 rounded-lg border">
            <p className="text-sm font-semibold">Override match result</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
              <span>{challengerTeam?.teamName ?? "Team 1"}</span>
              <span>{challengedTeam?.teamName ?? "Team 2"}</span>
            </div>
            {games.map((game, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={game.team1Score}
                  onChange={e => updateScore(i, "team1Score", parseInt(e.target.value) || 0)}
                  data-testid={`override-team1-${i}`}
                />
                <span className="text-muted-foreground text-xs">Game {game.gameNumber}</span>
                <Input
                  type="number"
                  min={0}
                  value={game.team2Score}
                  onChange={e => updateScore(i, "team2Score", parseInt(e.target.value) || 0)}
                  data-testid={`override-team2-${i}`}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addGame} type="button">
                <Plus className="w-4 h-4 mr-1" /> Add Game
              </Button>
              {games.length > 1 && (
                <Button variant="ghost" size="sm" onClick={removeGame} type="button">
                  <Minus className="w-4 h-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            <div>
              <Label className="text-xs">Winner</Label>
              {effectiveWinnerId && !isTie ? (
                <p className="mt-1 p-2 rounded border border-primary bg-primary/10 text-primary text-sm font-semibold">
                  {[challengerTeam, challengedTeam].find((t: any) => t?.id === effectiveWinnerId)?.teamName} ({Math.max(team1Wins, team2Wins)}–{Math.min(team1Wins, team2Wins)} games)
                </p>
              ) : isTie ? (
                <div className="mt-1">
                  <p className="text-xs text-muted-foreground mb-1">Games tied {team1Wins}–{team2Wins} — pick winner:</p>
                  <div className="flex gap-2">
                    {[challengerTeam, challengedTeam].filter(Boolean).map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTieBreakerWinnerId(t.id)}
                        className={`flex-1 py-2 px-3 rounded border text-sm font-medium ${tieBreakerWinnerId === t.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                      >
                        {t.teamName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Enter scores to determine winner.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={submitOverride} disabled={isPending || !effectiveWinnerId} data-testid="btn-save-override">
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Override
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOverriding(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
