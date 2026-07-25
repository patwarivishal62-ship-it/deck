import TopBar from "@/components/TopBar";

export const metadata = {
  title: "Terms & Conditions — Deck",
};

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-lg font-semibold text-text">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-soft">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="mb-1 font-display text-2xl font-semibold text-text">Terms &amp; Conditions</h1>
        <p className="mb-8 text-sm text-text-faint">Last updated: July 2026</p>

        <Section title="Acceptance of Terms">
          <p>By creating an account and using Deck, you agree to these Terms &amp; Conditions.</p>
        </Section>

        <Section title="User Responsibilities">
          <p>
            You're responsible for the accuracy of the information you enter into Deck and for using it in
            compliance with applicable laws.
          </p>
        </Section>

        <Section title="Account Security">
          <p>
            You're responsible for keeping your password confidential and for all activity under your
            account. Let us know right away if you suspect unauthorized access.
          </p>
        </Section>

        <Section title="Intellectual Property">
          <p>
            The Deck application, its design, and code are the property of its creator. The content you
            create (projects, goals, tasks) remains yours.
          </p>
        </Section>

        <Section title="Prohibited Activities">
          <p>
            You agree not to use Deck to store unlawful content, attempt to disrupt the service, or gain
            unauthorized access to other accounts or systems.
          </p>
        </Section>

        <Section title="Service Availability">
          <p>
            Deck is provided on an "as available" basis. We aim for reliable uptime but don't guarantee
            uninterrupted access, and scheduled maintenance or downtime may occur.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            Deck is provided without warranties of any kind. To the extent permitted by law, we aren't liable
            for indirect or consequential damages arising from your use of the service.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You may stop using Deck and request account deletion at any time from Settings. We may suspend
            or terminate accounts that violate these terms.
          </p>
        </Section>

        <Section title="Governing Law">
          <p>These terms are governed by the laws of India, without regard to conflict-of-law principles.</p>
        </Section>

        <Section title="Contact Information">
          <p>
            Questions about these terms? Reach out at{" "}
            <a href="mailto:support@deck.app" className="text-signal-deep underline">
              support@deck.app
            </a>
            .
          </p>
        </Section>
      </main>
    </div>
  );
}
