import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Ladders from "@/pages/ladders";
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
import Pay from "@/pages/pay";
import PaymentComplete from "@/pages/payment-complete";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";

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
      <Route path="/ladders" component={Ladders} />
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
      <Route path="/pay/:teamId" component={Pay} />
      <Route path="/payment-complete" component={PaymentComplete} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
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
