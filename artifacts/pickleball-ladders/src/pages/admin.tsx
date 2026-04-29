import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetAdminStats, useListAdminPlayers, useListDisputes, useResolveDispute,
  useCreateSeason, useActivateSeason, useDeactivateSeason, useGetInactivityLog,
  useListLadders, useCreateLadder, useUpdateLadder, useDeleteLadder, useListSeasons,
  useDeactivatePlayer, useListAllTeamsAdmin, useAdminRemoveTeam, useGetAdminRoster,
} from "@workspace/api-client-react";
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
import { Shield, Users, BarChart3, CheckCircle, AlertTriangle, Activity, Loader2, Layers, Edit3, Plus, Minus, ChevronDown, ChevronRight, Mail, Phone, Trophy } from "lucide-react";
import { US_STATES, STATE_NAME } from "@/lib/us-states";
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
  const deleteLadder = useDeleteLadder();
  const { toast } = useToast();
  const qc = useQueryClient();

  const ladderList = (ladders as any[]) ?? [];
  const seasonList = (allSeasons as any[]) ?? [];
  const playerList = (players as any[]) ?? [];
  const disputeList = (disputes as any[]) ?? [];
  const inactList = (inactivityLog as any[]) ?? [];
  const s = stats as any;

  const [newSeason, setNewSeason] = useState({ name: "", startDate: "", endDate: "", ladderId: "" });
  const [newLadder, setNewLadder] = useState<{ name: string; description: string; category: "men" | "women" | "mixed" | "coed"; location: string; address: string; city: string; state: string; level: string; isPaid: boolean; entryFeeDollars: string; startDate: string; endDate: string; signupDeadline: string }>({ name: "", description: "", category: "coed", location: "", address: "", city: "", state: "", level: "", isPaid: false, entryFeeDollars: "", startDate: "", endDate: "", signupDeadline: "" });

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
    if (!newLadder.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!newLadder.state) {
      toast({ title: "State is required", variant: "destructive" });
      return;
    }
    let entryFeeCents: number | null = null;
    if (newLadder.isPaid) {
      const parsed = parseFloat(newLadder.entryFeeDollars);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast({ title: "Enter an entry fee greater than $0, or choose Free.", variant: "destructive" });
        return;
      }
      entryFeeCents = Math.round(parsed * 100);
    }
    createLadder.mutate(
      {
        data: {
          name: newLadder.name,
          description: newLadder.description,
          category: newLadder.category,
          location: newLadder.location || undefined,
          address: newLadder.address || undefined,
          city: newLadder.city.trim(),
          state: newLadder.state,
          level: newLadder.level || undefined,
          entryFeeCents,
          startDate: newLadder.startDate || undefined,
          endDate: newLadder.endDate || undefined,
          signupDeadline: newLadder.signupDeadline || undefined,
        },
      },
      {
        onSuccess: () => { toast({ title: "Ladder created!" }); qc.invalidateQueries(); setNewLadder({ name: "", description: "", category: "coed", location: "", address: "", city: "", state: "", level: "", isPaid: false, entryFeeDollars: "", startDate: "", endDate: "", signupDeadline: "" }); },
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
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="inactivity">Inactivity Log</TabsTrigger>
          </TabsList>
          <TabsContent value="teams"><AdminTeamsPanel /></TabsContent>

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
                    <LadderRow key={l.id} ladder={l} onUpdate={updateLadder} onDelete={deleteLadder} />
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">City <span className="text-destructive">*</span></Label>
                    <Input value={newLadder.city} onChange={e => setNewLadder(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Austin" className="mt-1" data-testid="input-new-ladder-city" />
                  </div>
                  <div>
                    <Label className="text-xs">State <span className="text-destructive">*</span></Label>
                    <Select value={newLadder.state} onValueChange={(v) => setNewLadder(p => ({ ...p, state: v }))}>
                      <SelectTrigger className="mt-1" data-testid="select-new-ladder-state"><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Location name (optional)</Label>
                    <Input value={newLadder.location} onChange={e => setNewLadder(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Westside Courts" className="mt-1" data-testid="input-new-ladder-location" />
                  </div>
                  <div>
                    <Label className="text-xs">Level (optional)</Label>
                    <Input value={newLadder.level} onChange={e => setNewLadder(p => ({ ...p, level: e.target.value }))} placeholder="e.g. 3.5, 4.0, Beginner" className="mt-1" data-testid="input-new-ladder-level" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Street address (optional, opens in Google Maps)</Label>
                  <Input value={newLadder.address} onChange={e => setNewLadder(p => ({ ...p, address: e.target.value }))} placeholder="123 Court St" className="mt-1" data-testid="input-new-ladder-address" />
                </div>
                <div>
                  <Label className="text-xs">Pricing</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setNewLadder(p => ({ ...p, isPaid: false, entryFeeDollars: "" }))}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${!newLadder.isPaid ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:bg-muted/50"}`}
                      data-testid="btn-ladder-free"
                    >
                      Free
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewLadder(p => ({ ...p, isPaid: true }))}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${newLadder.isPaid ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:bg-muted/50"}`}
                      data-testid="btn-ladder-paid"
                    >
                      Paid Entry
                    </button>
                  </div>
                  {newLadder.isPaid && (
                    <div className="mt-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newLadder.entryFeeDollars}
                          onChange={e => setNewLadder(p => ({ ...p, entryFeeDollars: e.target.value }))}
                          placeholder="25.00"
                          className="pl-7"
                          data-testid="input-new-ladder-fee"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Players will be charged this amount via Stripe to join.</p>
                    </div>
                  )}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" className="mt-1" value={newLadder.startDate} onChange={e => setNewLadder(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" className="mt-1" value={newLadder.endDate} onChange={e => setNewLadder(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Signup Deadline</Label>
                    <Input type="date" className="mt-1" value={newLadder.signupDeadline} onChange={e => setNewLadder(p => ({ ...p, signupDeadline: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Last day players can join.</p>
                  </div>
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
                <div className="divide-y max-h-[500px] overflow-y-auto">
                  {playerList.map((p: any) => (
                    <PlayerRow key={p.id} player={p} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Inactivity Log */}
          <TabsContent value="roster"><AdminRosterPanel /></TabsContent>

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

function PlayerRow({ player }: { player: any }) {
  const deactivate = useDeactivatePlayer();
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleRemove = () => {
    if (!confirm(`Remove ${player.fullName}? They will no longer be able to log in.`)) return;
    deactivate.mutate(
      { id: player.id },
      {
        onSuccess: () => { toast({ title: `${player.fullName} removed` }); qc.invalidateQueries(); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const sexLabel: Record<string, string> = { male: "M", female: "F", other: "—" };

  return (
    <div className="p-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{player.fullName}</p>
        <p className="text-xs text-muted-foreground truncate">{player.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {player.sex && <Badge variant="outline" className="text-[10px]">{sexLabel[player.sex] ?? player.sex}</Badge>}
        <Badge variant={player.role === "admin" ? "default" : "outline"} className="text-[10px]">{player.role}</Badge>
        {!player.isActive ? (
          <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
            onClick={handleRemove}
            disabled={deactivate.isPending || player.role === "admin"}
            data-testid={`btn-remove-player-${player.id}`}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function LadderRow({ ladder, onUpdate, onDelete }: { ladder: any; onUpdate: ReturnType<typeof useUpdateLadder>; onDelete: ReturnType<typeof useDeleteLadder> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ladder.name);
  const [description, setDescription] = useState(ladder.description ?? "");
  const [category, setCategory] = useState<"men" | "women" | "mixed" | "coed">(ladder.category ?? "coed");
  const [location, setLocation] = useState(ladder.location ?? "");
  const [address, setAddress] = useState(ladder.address ?? "");
  const [city, setCity] = useState(ladder.city ?? "");
  const [stateCode, setStateCode] = useState(ladder.state ?? "");
  const [level, setLevel] = useState(ladder.level ?? "");
  const [feeDollars, setFeeDollars] = useState(ladder.entryFeeCents != null ? (ladder.entryFeeCents / 100).toFixed(2) : "");
  const [isActive, setIsActive] = useState(ladder.isActive);
  const [startDate, setStartDate] = useState(ladder.activeSeason?.startDate ?? "");
  const [endDate, setEndDate] = useState(ladder.activeSeason?.endDate ?? "");
  const [signupDeadline, setSignupDeadline] = useState(ladder.activeSeason?.signupDeadline ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  // Sync date fields when the ladder prop refreshes after a save
  useEffect(() => {
    setStartDate(ladder.activeSeason?.startDate ?? "");
    setEndDate(ladder.activeSeason?.endDate ?? "");
    setSignupDeadline(ladder.activeSeason?.signupDeadline ?? "");
  }, [ladder.activeSeason?.startDate, ladder.activeSeason?.endDate, ladder.activeSeason?.signupDeadline]);

  const handleSave = () => {
    if (!city.trim()) { toast({ title: "City is required", variant: "destructive" }); return; }
    if (!stateCode) { toast({ title: "State is required", variant: "destructive" }); return; }
    onUpdate.mutate(
      {
        id: ladder.id,
        data: {
          name, description, isActive, category,
          location: location || undefined,
          address: address || undefined,
          city: city.trim(),
          state: stateCode,
          level: level || undefined,
          entryFeeCents: feeDollars === "" ? null : Math.round(parseFloat(feeDollars) * 100),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          signupDeadline: signupDeadline || undefined,
        } as any,
      },
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
        <div className="grid grid-cols-2 gap-2">
          <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City *" />
          <Select value={stateCode} onValueChange={setStateCode}>
            <SelectTrigger><SelectValue placeholder="State *" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location name" />
          <Input value={level} onChange={e => setLevel(e.target.value)} placeholder="Level" />
        </div>
        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address (opens in Google Maps)" />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFeeDollars("")}
            className={`px-3 py-2 rounded-md border text-sm font-medium ${feeDollars === "" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background"}`}
          >Free</button>
          <button
            type="button"
            onClick={() => setFeeDollars(feeDollars === "" ? "25.00" : feeDollars)}
            className={`px-3 py-2 rounded-md border text-sm font-medium ${feeDollars !== "" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background"}`}
          >Paid</button>
        </div>
        {feeDollars !== "" && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input type="number" min="0" step="0.01" value={feeDollars} onChange={e => setFeeDollars(e.target.value)} placeholder="25.00" className="pl-7" />
          </div>
        )}
        <Select value={category} onValueChange={(v) => setCategory(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="men">Men's</SelectItem>
            <SelectItem value="women">Women's</SelectItem>
            <SelectItem value="mixed">Mixed (1 man + 1 woman)</SelectItem>
            <SelectItem value="coed">Co-ed</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Start Date</Label>
            <Input type="date" className="mt-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">End Date</Label>
            <Input type="date" className="mt-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Signup Deadline</Label>
            <Input type="date" className="mt-1" value={signupDeadline} onChange={e => setSignupDeadline(e.target.value)} />
          </div>
        </div>
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
          {ladder.level && <Badge variant="outline" className="text-xs">Level {ladder.level}</Badge>}
          {ladder.entryFeeCents != null && <Badge variant="outline" className="text-xs">${(ladder.entryFeeCents / 100).toFixed(2)}</Badge>}
          {!ladder.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
          {ladder.activeSeason && <Badge variant="outline" className="text-xs">{ladder.activeSeason.name}</Badge>}
        </div>
        {(ladder.city || ladder.state) && (
          <p className="text-xs text-muted-foreground">📍 {[ladder.city, ladder.state].filter(Boolean).join(", ")}{ladder.location ? ` — ${ladder.location}` : ""}</p>
        )}
        {!ladder.city && !ladder.state && ladder.location && <p className="text-xs text-muted-foreground">📍 {ladder.location}</p>}
        {ladder.address && <p className="text-xs text-muted-foreground truncate">🗺️ {ladder.address}</p>}
        {ladder.description && <p className="text-xs text-muted-foreground truncate">{ladder.description}</p>}
        {ladder.activeSeason && (
          <p className="text-xs text-muted-foreground">
            📅 {ladder.activeSeason.startDate} → {ladder.activeSeason.endDate}
            {ladder.activeSeason.signupDeadline && ` · Signup closes ${ladder.activeSeason.signupDeadline}`}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">Delete</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{ladder.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the ladder and all its seasons, teams, challenges and matches. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete.mutate({ id: ladder.id }, {
                  onSuccess: () => { toast({ title: "Ladder deleted" }); qc.invalidateQueries(); },
                  onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
                })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
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

function AdminTeamsPanel() {
  const { data: teams } = useListAllTeamsAdmin();
  const list: any[] = (teams as any[]) ?? [];
  const [filter, setFilter] = useState("");
  const filtered = list.filter(t => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return (
      t.teamName?.toLowerCase().includes(q) ||
      t.player1?.fullName?.toLowerCase().includes(q) ||
      t.player2?.fullName?.toLowerCase().includes(q) ||
      t.player1?.email?.toLowerCase().includes(q) ||
      t.player2?.email?.toLowerCase().includes(q)
    );
  });
  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" /> All Teams ({list.length})
        </CardTitle>
        <Input placeholder="Search team or player..." value={filter} onChange={e => setFilter(e.target.value)} className="mt-2 max-w-md" data-testid="input-team-filter" />
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams match.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <AdminTeamRow key={t.id} team={t} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminTeamRow({ team }: { team: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [refundChecked, setRefundChecked] = useState(true);
  const removeMut = useAdminRemoveTeam({
    mutation: {
      onSuccess: () => {
        toast({ title: "Team removed", description: refundChecked ? "Refunds processed where applicable." : "Removed without refund." });
        qc.invalidateQueries();
      },
      onError: (err: any) => {
        toast({ title: "Failed to remove team", description: err?.response?.data?.error ?? "Try again.", variant: "destructive" });
      },
    },
  });
  const isWithdrawn = !!team.withdrawnAt;
  return (
    <div className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3" data-testid={`row-team-${team.id}`}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold break-words">{team.teamName}</span>
          {isWithdrawn ? (
            <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-50">Removed ({team.withdrawnReason ?? "—"})</Badge>
          ) : team.paymentStatus === "paid" ? (
            <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50">Paid</Badge>
          ) : team.paymentStatus === "partial" ? (
            <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">Partial</Badge>
          ) : team.paymentStatus === "not_required" ? (
            <Badge variant="outline" className="text-[10px]">No fee</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Unpaid</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground break-words">
          {team.player1?.fullName ?? "—"} & {team.player2?.fullName ?? "—"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Season: {team.season?.name ?? "—"} · Created {new Date(team.createdAt).toLocaleDateString()}
        </p>
      </div>
      {!isWithdrawn && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/5" data-testid={`btn-admin-remove-team-${team.id}`}>
              Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove team "{team.teamName}"?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>This dissolves the team and removes it from the ladder. Both players will be notified.</p>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={refundChecked} onChange={e => setRefundChecked(e.target.checked)} data-testid={`chk-refund-${team.id}`} />
                    <span>Issue refunds to both players (where Stripe payments exist)</span>
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeMut.mutate({ id: team.id, data: { refund: refundChecked } })}
                disabled={removeMut.isPending}
                data-testid={`btn-confirm-admin-remove-${team.id}`}
              >
                {removeMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Remove team
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ── Admin Roster Panel ──────────────────────────────────────────────────────

function AdminRosterPanel() {
  const { data, isLoading } = useGetAdminRoster();
  const roster = (data as any[]) ?? [];
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleTeam = (id: string) =>
    setExpandedTeams(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const catLabel: Record<string, string> = { men: "Men's", women: "Women's", mixed: "Mixed", coed: "Co-ed" };

  const fmtScore = (match: any) => {
    const scores: any[] = match.scores ?? [];
    return scores.length > 0 ? scores.map((s: any) => `${s.team1Score}–${s.team2Score}`).join(", ") : "—";
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (roster.length === 0) return <Card className="border-primary/10"><CardContent className="py-10 text-center text-muted-foreground">No players signed up yet.</CardContent></Card>;

  return (
    <div className="space-y-6">
      {roster.map(({ ladder, activeSeason, teams }: any) => (
        <Card key={ladder.id} className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="w-4 h-4 text-primary" />
              {ladder.name}
              <Badge variant="outline" className="text-[10px]">{catLabel[ladder.category ?? "coed"]}</Badge>
              <Badge variant="outline" className="text-[10px]">{teams.length} team{teams.length !== 1 ? "s" : ""}</Badge>
            </CardTitle>
            {activeSeason && (
              <p className="text-xs text-muted-foreground">{activeSeason.startDate} – {activeSeason.endDate}</p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {teams.map((team: any) => {
                const isExpanded = expandedTeams.has(team.id);
                const pos = team.standing?.position;
                return (
                  <div key={team.id}>
                    {/* Team row */}
                    <button
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      onClick={() => toggleTeam(team.id)}
                    >
                      {pos && (
                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          #{pos}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{team.teamName}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.player1?.fullName ?? "?"} &amp; {team.player2?.fullName ?? "?"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{team.matches?.length ?? 0} match{team.matches?.length !== 1 ? "es" : ""}</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded: player info + matches */}
                    {isExpanded && (
                      <div className="bg-muted/20 px-4 pb-4 pt-2 space-y-4">
                        {/* Players */}
                        <div className="grid sm:grid-cols-2 gap-3">
                          {[team.player1, team.player2].filter(Boolean).map((p: any) => (
                            <div key={p.id} className="bg-background rounded-lg border p-3 text-xs space-y-1">
                              <p className="font-semibold text-sm">{p.fullName}</p>
                              <p className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{p.email}</p>
                              {p.phone && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{p.phone}</p>}
                              <div className="flex gap-2 flex-wrap pt-1">
                                {p.selfRating && <Badge variant="outline" className="text-[10px]">Rating {p.selfRating}</Badge>}
                                {p.sex && <Badge variant="outline" className="text-[10px] capitalize">{p.sex}</Badge>}
                                {p.emailVerified ? <Badge variant="outline" className="text-[10px] text-green-600">Verified</Badge> : <Badge variant="outline" className="text-[10px] text-yellow-600">Unverified</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Matches */}
                        {team.matches?.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Match History</p>
                            <div className="space-y-1.5">
                              {team.matches.map((m: any) => {
                                const result = m.result;
                                const won = result?.winnerTeamId === team.id;
                                const lost = result?.loserTeamId === team.id;
                                const opponentId = m.challengerTeamId === team.id ? m.challengedTeamId : m.challengerTeamId;
                                return (
                                  <div key={m.id} className="flex items-center justify-between text-xs bg-background rounded border px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      {result?.confirmedAt ? (
                                        won
                                          ? <Trophy className="w-3 h-3 text-yellow-500" />
                                          : <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                                      ) : (
                                        <span className="w-3 h-3 rounded-full bg-muted-foreground/30 inline-block" />
                                      )}
                                      <span className="text-muted-foreground">{m.scheduledDate ?? "TBD"}</span>
                                    </div>
                                    <span className="font-mono">{fmtScore(m)}</span>
                                    <Badge variant="outline" className={`text-[10px] ${won ? "text-green-600" : lost ? "text-red-500" : "text-muted-foreground"}`}>
                                      {result?.confirmedAt ? (won ? "W" : "L") : "Pending"}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No matches played yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
