import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCreatePaymentIntent, useGetMyTeams, useListLadders } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { getStripePromise } from "@/lib/stripe";

export default function Pay() {
  return (
    <ProtectedRoute>
      <PayContent />
    </ProtectedRoute>
  );
}

function PayContent() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: myTeams } = useGetMyTeams();
  const { data: ladders } = useListLadders();
  const { toast } = useToast();

  const team = useMemo(
    () => (myTeams as any[] | undefined)?.find(t => t.id === teamId),
    [myTeams, teamId]
  );
  const ladder = useMemo(
    () => (ladders as any[] | undefined)?.find(l => l.id === team?.season?.ladderId),
    [ladders, team]
  );

  const createIntent = useCreatePaymentIntent();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentInfo, setIntentInfo] = useState<{ amount: number; currency: string } | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || clientSecret) return;
    if (team && team.paymentStatus === "paid") return;
    if (team && team.paymentStatus === "not_required") return;

    createIntent.mutate(
      { data: { teamId } },
      {
        onSuccess: (resp: any) => {
          setClientSecret(resp.clientSecret);
          setIntentInfo({ amount: resp.amount, currency: resp.currency });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || "Failed to start payment";
          setIntentError(msg);
          toast({ title: "Payment error", description: msg, variant: "destructive" });
        },
      }
    );
  }, [teamId, team, clientSecret]);

  if (myTeams && !team) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto py-12 px-4 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Team not found</h1>
          <p className="text-muted-foreground mb-4">You're not on this team, or it doesn't exist.</p>
          <Link href="/team"><Button>Back to my teams</Button></Link>
        </div>
      </MainLayout>
    );
  }

  if (team?.paymentStatus === "paid") {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto py-12 px-4 text-center">
          <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Already paid</h1>
          <p className="text-muted-foreground mb-4">Your team is paid up for {ladder?.name ?? "this ladder"}.</p>
          <Link href="/team"><Button>Back to my teams</Button></Link>
        </div>
      </MainLayout>
    );
  }

  if (team?.paymentStatus === "not_required") {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto py-12 px-4 text-center">
          <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">No payment needed</h1>
          <p className="text-muted-foreground mb-4">{ladder?.name ?? "This ladder"} is free to join.</p>
          <Link href="/team"><Button>Back to my teams</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-black mb-6 flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-primary" /> Pay Entry Fee
        </h1>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{team?.teamName}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Ladder: <span className="text-foreground font-medium">{ladder?.name ?? "—"}</span></p>
            <p>
              Entry fee:{" "}
              <span className="text-foreground font-medium">
                {intentInfo
                  ? `$${(intentInfo.amount / 100).toFixed(2)} ${intentInfo.currency.toUpperCase()}`
                  : ladder?.entryFeeCents != null
                    ? `$${(ladder.entryFeeCents / 100).toFixed(2)}`
                    : "—"}
              </span>
            </p>
          </CardContent>
        </Card>

        {intentError ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="font-semibold text-destructive">{intentError}</p>
              <Link href="/team"><Button variant="outline" className="mt-4">Back</Button></Link>
            </CardContent>
          </Card>
        ) : !clientSecret ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-muted-foreground">Preparing checkout…</p>
            </CardContent>
          </Card>
        ) : (
          <Elements stripe={getStripePromise()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <CheckoutForm teamId={teamId!} />
          </Elements>
        )}
      </div>
    </MainLayout>
  );
}

function CheckoutForm({ teamId }: { teamId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setStripeError(null);

    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const returnUrl = `${window.location.origin}${base}/payment-complete?team=${teamId}`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (error) {
      setStripeError(error.message ?? "Payment failed");
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Redirect didn't happen — payment succeeded inline (e.g. card with no auth)
    setLocation(`/payment-complete?team=${teamId}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="py-6 space-y-4">
          <PaymentElement />
          {stripeError && (
            <p className="text-sm text-destructive" data-testid="text-payment-error">{stripeError}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={!stripe || submitting} data-testid="btn-pay">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Pay now
            </Button>
            <Link href="/team"><Button type="button" variant="outline">Cancel</Button></Link>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
