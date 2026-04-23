import { ReactNode, useState } from "react";
import { Navbar } from "./navbar";
import { useGetCurrentPlayer } from "@workspace/api-client-react";
import { useResendVerification } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { X, MailWarning, Loader2 } from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

function VerificationBanner() {
  const { token } = useAuth();
  const { data: player } = useGetCurrentPlayer({ query: { enabled: !!token } });
  const resend = useResendVerification();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  if (!token || !player || (player as any).emailVerified || dismissed) return null;

  const handleResend = () => {
    resend.mutate(undefined, {
      onSuccess: () => setSent(true),
    });
  };

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-sm text-amber-900">
      <MailWarning className="w-4 h-4 shrink-0 text-amber-600" />
      <span className="flex-1">
        Please verify your email — check your inbox for a confirmation link.
      </span>
      {sent ? (
        <span className="text-amber-700 font-medium shrink-0">Sent!</span>
      ) : (
        <button
          onClick={handleResend}
          disabled={resend.isPending}
          className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-700 flex items-center gap-1"
        >
          {resend.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          Resend email
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="shrink-0 text-amber-600 hover:text-amber-800 ml-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50/50 dark:bg-background">
      <Navbar />
      <VerificationBanner />
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {children}
      </main>
      <footer className="border-t mt-10 py-6 px-4 text-center text-sm text-muted-foreground space-y-2">
        <div>
          Want to organize a ladder?{" "}
          <a
            href="mailto:info@pbclubladder.com"
            className="text-primary font-medium hover:underline"
            data-testid="link-organize-ladder"
          >
            info@pbclubladder.com
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <a href="/terms" className="hover:underline" data-testid="link-terms">Terms of Service</a>
          <span aria-hidden>·</span>
          <a href="/privacy" className="hover:underline" data-testid="link-privacy">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
