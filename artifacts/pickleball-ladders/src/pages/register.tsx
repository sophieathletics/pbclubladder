import { useState, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useRegisterPlayer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const RATINGS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0+"];

const RATING_DESCRIPTIONS: Record<string, string> = {
  "2.0": "New to the sport — still learning rules and basic strokes.",
  "2.5": "Can sustain a short rally; consistent serves and forehands.",
  "3.0": "Reliable serves/returns, developing third-shot drops, decent dink rallies.",
  "3.5": "Solid all-court play; effective dinking, lobs, and patient point construction.",
  "4.0": "Strong shot variety, good court positioning, controlled offense and defense.",
  "4.5": "Tournament-level: rarely makes unforced errors, executes most shots with intent.",
  "5.0+": "Advanced competitive — Open / Pro level play.",
};

export default function Register() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const redirectTo = params.get("redirect") || "/ladders";
  const prefillEmail = params.get("email") || "";
  const loginHref = `/login?redirect=${encodeURIComponent(redirectTo)}${prefillEmail ? `&email=${encodeURIComponent(prefillEmail)}` : ""}`;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selfRating, setSelfRating] = useState("");
  const [sex, setSex] = useState("");
  const [shareContact, setShareContact] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setToken } = useAuth();
  const register = useRegisterPlayer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfRating) {
      toast({ title: "Please choose a self-rating", variant: "destructive" });
      return;
    }
    if (!sex) {
      toast({ title: "Please select your sex", variant: "destructive" });
      return;
    }
    register.mutate(
      {
        data: {
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          password,
          selfRating,
          sex: sex as "male" | "female" | "other",
          shareContact,
        },
      },
      {
        onSuccess: (data: any) => {
          setToken(data.token);
          setLocation(redirectTo);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-primary/5 to-background">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="Jane"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    data-testid="input-firstName"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                    data-testid="input-lastName"
                  />
                </div>
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
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="123-456-7891"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger id="sex" data-testid="select-sex">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other / Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating">Self-rating</Label>
                <Select value={selfRating} onValueChange={setSelfRating}>
                  <SelectTrigger id="rating" data-testid="select-rating">
                    <SelectValue placeholder="Choose your skill level" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATINGS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selfRating ? (
                  <p className="text-xs text-muted-foreground leading-snug">
                    <span className="font-medium text-foreground">{selfRating}:</span>{" "}
                    {RATING_DESCRIPTIONS[selfRating]}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Please rate yourself honestly — fair self-rating keeps matches competitive for everyone.
                  </p>
                )}
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

              <label className="flex items-start gap-2 rounded-md border border-border p-3 bg-muted/30 cursor-pointer">
                <Checkbox
                  checked={shareContact}
                  onCheckedChange={(v) => setShareContact(v === true)}
                  data-testid="checkbox-share-contact"
                  className="mt-0.5"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  I agree to share my email and phone number with the other team
                  if no overlapping availability slot is found, so we can
                  coordinate a match time directly.
                </span>
              </label>

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
              <Link href={loginHref} className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
