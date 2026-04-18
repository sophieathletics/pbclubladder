import { Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";

export default function Terms() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 prose prose-sm">
        <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: April 2026</p>

        <section className="space-y-4 text-sm leading-relaxed">
          <p>
            Welcome to Pickleball Club Ladder ("we", "us", "the Service"). By creating an account
            or paying an entry fee you agree to these Terms.
          </p>

          <h2 className="text-xl font-bold mt-6">1. Eligibility</h2>
          <p>You must be at least 18 years old (or have a legal guardian's consent) to create an account.</p>

          <h2 className="text-xl font-bold mt-6">2. Accounts</h2>
          <p>
            You are responsible for keeping your password confidential and for all activity under
            your account. Notify us immediately if you suspect unauthorized use.
          </p>

          <h2 className="text-xl font-bold mt-6">3. Entry fees and refunds</h2>
          <p>
            Entry fees are charged per player when both teammates have accepted an invitation. If
            you withdraw from a team within 48 hours of paying, you receive an automatic full
            refund. Withdrawals after 48 hours may be granted a refund at the organizer's
            discretion. Teams that have not been fully paid within 5 days are auto-dissolved and any
            partial payments are refunded.
          </p>

          <h2 className="text-xl font-bold mt-6">4. Match conduct</h2>
          <p>
            Players are expected to behave respectfully, report scores honestly, and resolve
            disputes through the dispute process. Repeated misconduct may result in account
            suspension at the organizer's discretion.
          </p>

          <h2 className="text-xl font-bold mt-6">5. Limitation of liability</h2>
          <p>
            The Service is provided "as is" without warranty of any kind. We are not liable for
            injuries that occur during matches, scheduling conflicts, or any indirect damages
            arising from use of the Service.
          </p>

          <h2 className="text-xl font-bold mt-6">6. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes
            are posted means you accept the updated Terms.
          </p>

          <h2 className="text-xl font-bold mt-6">7. Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:info@pbclubladder.com" className="text-primary underline">
              info@pbclubladder.com
            </a>
            .
          </p>

          <p className="text-xs text-muted-foreground mt-8">
            See also our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
