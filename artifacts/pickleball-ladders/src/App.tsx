import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Leaderboard from "@/pages/leaderboard";
import Dashboard from "@/pages/dashboard";
import Team from "@/pages/team";
import Challenge from "@/pages/challenge";
import ChallengeDetail from "@/pages/challenge-detail";
import Availability from "@/pages/availability";
import MatchDetail from "@/pages/match-detail";
import Notifications from "@/pages/notifications";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/team" component={Team} />
      <Route path="/challenge" component={Challenge} />
      <Route path="/challenges/:id" component={ChallengeDetail} />
      <Route path="/availability/:challengeId" component={Availability} />
      <Route path="/matches/:id" component={MatchDetail} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
