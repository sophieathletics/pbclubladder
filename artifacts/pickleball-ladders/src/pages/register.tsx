import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegisterPlayer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setToken } = useAuth();
  const register = useRegisterPlayer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(
      { data: { fullName, email, phone: phone || undefined, password } },
      {
        onSuccess: (data: any) => {
          setToken(data.token);
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({
            title: "Registration failed",
            description: err?.data?.error ?? "An error occurred",
            variant: "destructive",
          });
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
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Join the pickleball ladder competition</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  data-testid="input-fullName"
                />
              </div>
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
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="555-1234"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={register.isPending}
                data-testid="btn-register"
              >
                {register.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </form>
            <p className="text-sm text-center text-muted-foreground mt-4">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
