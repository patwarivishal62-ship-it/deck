import TopBar from "@/components/TopBar";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = {
  title: "Privacy Policy — Deck",
};

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-lg font-semibold text-text">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-soft">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Privacy Policy" }]} />
        <h1 className="mb-1 font-display text-2xl font-semibold text-text">Privacy Policy</h1>
        <p className="mb-8 text-sm text-text-faint">Last updated: July 2026</p>

        <Section title="Information We Collect">
          <p>
            When you create a Deck account, we collect your name, email address, and password (stored as a
            secure hash, never in plain text). We also store the projects, goals, and tasks you create while
            using the app.
          </p>
        </Section>

        <Section title="How We Use Information">
          <p>
            We use this information solely to operate Deck: to authenticate you, keep your projects private
            to your account, and let you track your goals and tasks. We do not sell or rent your information
            to third parties.
          </p>
        </Section>

        <Section title="Account Data">
          <p>
            Your projects, goals, and tasks are visible only to your account. We do not access or use your
            content except as needed to provide support or maintain the service.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Deck uses a single essential cookie to keep you signed in. It's used only for authentication and
            isn't shared with advertisers or used for tracking across other sites.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            Deck is hosted using third-party infrastructure providers (for hosting the app and its database).
            These providers process data on our behalf and don't use it for their own purposes.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            We retain your account data for as long as your account is active. If you request account
            deletion, your data is scheduled for permanent removal after review.
          </p>
        </Section>

        <Section title="User Rights">
          <p>
            You can update your profile information at any time from Settings. You can request deletion of
            your account and data from the Settings page as well.
          </p>
        </Section>

        <Section title="Contact Information">
          <p>
            Questions about this policy? Reach out at{" "}
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
