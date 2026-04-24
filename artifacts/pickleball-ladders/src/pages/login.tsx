import { useState, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useLoginPlayer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function Login() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const redirectTo = params.get("redirect") || "/dashboard";
  const prefillEmail = params.get("email") || "";
  const registerHref = `/register?redirect=${encodeURIComponent(redirectTo)}${prefillEmail ? `&email=${encodeURIComponent(prefillEmail)}` : ""}`;
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const login = useLoginPlayer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: async (data: any) => {
          setToken(data.token);
          // If an explicit redirect was provided (e.g. from email link), honour it
          if (params.get("redirect")) {
            setLocation(redirectTo);
            return;
          }
          // Otherwise smart-redirect: players with a team go to dashboard, others to ladders
          try {
            const apiBase = import.meta.env.VITE_API_URL ?? "";
            const res = await fetch(`${apiBase}/api/teams/my-teams`, {
              headers: { Authorization: `Bearer ${data.token}` },
            });
            const teams = await res.json();
            setLocation(Array.isArray(teams) && teams.length > 0 ? "/dashboard" : "/ladders");
          } catch {
            setLocation("/dashboard");
          }
        },
        onError: (err: any) => {
          setErrorMessage(err?.data?.error ?? "Invalid email or password");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <Trophy className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Pickleball Club Ladder</h1>
        </div>

        <Card className="border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline font-medium"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={login.isPending}
                data-testid="btn-login"
              >
                {login.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign in
              </Button>
            </form>
            <p className="text-sm text-center text-muted-foreground mt-4">
              Don't have an account?{" "}
              <Link href={registerHref} className="text-primary hover:underline font-medium">
                Register
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
