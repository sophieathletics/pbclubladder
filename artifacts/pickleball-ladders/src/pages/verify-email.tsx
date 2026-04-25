import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL ?? "";
    fetch(`${apiBase}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message ?? "Email verified!");
          setTimeout(() => setLocation("/team"), 3000);
        } else {
          setStatus("error");
          setMessage(data.error ?? "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, []);

  return (
    <MainLayout>
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying your email…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black mb-2">Email verified!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting to your team…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-black mb-2">Verification failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-3">
              Go to your <a href="/dashboard" className="text-primary underline">dashboard</a> to request a new link.
            </p>
          </>
        )}
      </div>
    </MainLayout>
  );
}
