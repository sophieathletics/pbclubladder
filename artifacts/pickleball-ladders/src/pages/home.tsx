import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/main-layout";
import { Trophy, ArrowRight, Activity, Users } from "lucide-react";
import { useGetTopLadder } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: ladderResponse, isLoading } = useGetTopLadder();

  return (
    <MainLayout>
      <div className="flex flex-col gap-12 pb-12">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24 px-4 flex flex-col items-center justify-center relative overflow-hidden rounded-3xl bg-gradient-to-b from-primary/10 to-transparent border border-primary/10">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
          <Badge className="mb-6 px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 border-none">
            Competitive Ladder Season Active
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground max-w-3xl mb-6">
            <span className="text-primary">Pickleball Club Ladder</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
            Challenge teams, record scores, and climb the ranks.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" asChild className="font-semibold px-8" data-testid="hero-btn-join">
              <Link href="/register">Join a Ladder</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="font-semibold px-8" data-testid="hero-btn-leaderboard">
              <Link href="/leaderboard">View Leaderboard</Link>
            </Button>
          </div>
        </section>

        {/* Top 10 Preview */}
        <section className="max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              Top 10 Standings
            </h2>
            <Button variant="ghost" className="group" asChild data-testid="btn-view-all-ladder">
              <Link href="/leaderboard" className="flex items-center gap-2">
                Full Ladder
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          <Card className="border-primary/10 shadow-lg shadow-primary/5">
            <CardContent className="p-0">
              <div className="divide-y">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-4">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))
                ) : !ladderResponse?.standings?.length ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Trophy className="w-12 h-12 mb-4 text-muted" />
                    <p>No standings available for the current season.</p>
                  </div>
                ) : (
                  ladderResponse.standings.map((standing) => (
                    <div key={standing.id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        standing.position === 1 ? 'bg-yellow-400/20 text-yellow-600' :
                        standing.position === 2 ? 'bg-gray-300/20 text-gray-500' :
                        standing.position === 3 ? 'bg-amber-600/20 text-amber-700' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {standing.position}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {standing.team?.teamName || "Unknown Team"}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {standing.team?.player1?.fullName} & {standing.team?.player2?.fullName}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="font-medium text-sm">
                          {standing.wins}W - {standing.losses}L
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </section>
        
        {/* Features grid */}
        <section className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          <Card className="bg-card">
            <CardContent className="pt-6">
              <Trophy className="w-10 h-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">Dynamic Rankings</h3>
              <p className="text-muted-foreground text-sm">
                Challenge teams up to 3 spots above you. Win to take their place, lose and drop down.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="pt-6">
              <Activity className="w-10 h-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">Automated Scheduling</h3>
              <p className="text-muted-foreground text-sm">
                Submit availability, find overlapping times, and book matches without the back-and-forth text messages.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="pt-6">
              <Users className="w-10 h-10 text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">Player Profiles</h3>
              <p className="text-muted-foreground text-sm">
                Track your personal and team stats across multiple seasons. Build your reputation on the courts.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>;
}
