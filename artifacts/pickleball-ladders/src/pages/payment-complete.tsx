import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useSyncPayment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";

export default function PaymentComplete() {
  return (
    <ProtectedRoute>
      <Body />
    </ProtectedRoute>
  );
}

function Body() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const teamId = params.get("team");
  const stripeStatus = params.get("redirect_status"); // succeeded | processing | failed
  const sync = useSyncPayment();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"loading" | "paid" | "partial" | "pending" | "failed">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!teamId) {
      setStatus("failed");
      setMessage("Missing team reference.");
      return;
    }
    if (stripeStatus === "failed") {
      setStatus("failed");
      setMessage("Stripe reported the payment failed. Please try again.");
      return;
    }
    sync.mutate(
      { teamId },
      {
        onSuccess: (resp: any) => {
          qc.invalidateQueries();
          if (resp.paymentStatus === "paid") {
            setStatus("paid");
          } else if (resp.myPaid) {
            setStatus("partial");
            setMessage("Your payment went through. Your partner still needs to pay their share before the team can challenge.");
          } else {
            setStatus("pending");
            setMessage("Your payment is processing. Refresh in a moment, or check back from the My Teams page.");
          }
        },
        onError: (err: any) => {
          setStatus("failed");
          setMessage(err?.data?.error || "Could not confirm payment status.");
        },
      }
    );
  }, [teamId, stripeStatus]);

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="py-10 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                <p className="text-lg font-semibold">Confirming your payment…</p>
              </>
            )}
            {status === "paid" && (
              <>
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <h1 className="text-2xl font-bold mb-1">Payment received!</h1>
                <p className="text-muted-foreground mb-5">Your team is paid and ready to play.</p>
                <Link href="/team"><Button>Back to My Teams</Button></Link>
              </>
            )}
            {status === "partial" && (
              <>
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <h1 className="text-2xl font-bold mb-1">Thanks — you're paid up!</h1>
                <p className="text-muted-foreground mb-5">{message}</p>
                <Link href="/team"><Button>Back to My Teams</Button></Link>
              </>
            )}
            {status === "pending" && (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                <h1 className="text-2xl font-bold mb-1">Almost there</h1>
                <p className="text-muted-foreground mb-5">{message}</p>
                <Link href="/team"><Button variant="outline">Back to My Teams</Button></Link>
              </>
            )}
            {status === "failed" && (
              <>
                <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
                <h1 className="text-2xl font-bold mb-1">Payment issue</h1>
                <p className="text-muted-foreground mb-5">{message}</p>
                <div className="flex gap-2 justify-center">
                  {teamId && <Link href={`/pay/${teamId}`}><Button>Try again</Button></Link>}
                  <Link href="/team"><Button variant="outline">Back to My Teams</Button></Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
