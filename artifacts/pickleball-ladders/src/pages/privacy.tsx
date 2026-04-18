import { Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";

export default function Privacy() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 prose prose-sm">
        <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: April 2026</p>

        <section className="space-y-4 text-sm leading-relaxed">
          <p>
            This policy describes what information Pickleball Club Ladder collects, how we use it,
            and the choices you have.
          </p>

          <h2 className="text-xl font-bold mt-6">1. Information we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Account info you provide: name, email, optional phone, self-rating, sex.</li>
            <li>Match and ladder data: teams, challenges, scores, availability, position history.</li>
            <li>Payment metadata processed by Stripe (we do not store full card numbers).</li>
            <li>Basic technical logs (IP, browser, request timestamps) for security and debugging.</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">2. How we use information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To run the ladder, schedule matches, and notify you of activity.</li>
            <li>To process entry-fee payments and refunds via Stripe.</li>
            <li>To send transactional emails (invitations, confirmations, disputes, reminders) via Resend.</li>
            <li>To prevent fraud, abuse, and to comply with legal obligations.</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">3. Sharing</h2>
          <p>
            We share data only with service providers needed to operate the Service (Stripe for
            payments, Resend for email, our hosting provider). We do not sell your personal
            information. Your name and team membership are visible on the public ladder.
            Contact info (email/phone) is shared with opponents only when scheduling a match.
          </p>

          <h2 className="text-xl font-bold mt-6">4. Data retention</h2>
          <p>
            We keep your data for as long as your account is active. You may request account
            deletion by emailing us; we'll remove personal information except where retention is
            required by law (for example, payment records).
          </p>

          <h2 className="text-xl font-bold mt-6">5. Security</h2>
          <p>
            We use HTTPS in transit, encrypted database storage, hashed passwords with per-user
            salts, and signed session tokens. No system is perfectly secure; please use a strong,
            unique password.
          </p>

          <h2 className="text-xl font-bold mt-6">6. Your rights</h2>
          <p>
            Depending on where you live, you may have the right to access, correct, or delete your
            personal data. Contact us to exercise these rights.
          </p>

          <h2 className="text-xl font-bold mt-6">7. Contact</h2>
          <p>
            Email{" "}
            <a href="mailto:info@pbclubladder.com" className="text-primary underline">
              info@pbclubladder.com
            </a>
            .
          </p>

          <p className="text-xs text-muted-foreground mt-8">
            See also our <Link href="/terms" className="text-primary underline">Terms of Service</Link>.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
