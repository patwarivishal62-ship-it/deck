"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import CategoryMeters from "@/components/CategoryMeters";

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M7.5 12.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HowItWorksCard({ icon, title, children }) {
  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-signal-tint text-signal-deep">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-text">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-soft">{children}</p>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="bg-ink">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse_dot rounded-full bg-signal" />
          <span className="font-display text-base font-semibold text-white">Deck</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
            Project Control Center
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-white/80 transition hover:text-white">
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal-deep"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-20 pt-10 lg:grid-cols-2 lg:gap-16 lg:pb-28 lg:pt-16">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-signal">
            Built for marketing teams
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] text-white sm:text-5xl">
            Run every campaign from one deck.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-text-faint">
            Deck keeps every project, goal, and task in one control center — so nothing quietly slips
            while you're juggling five campaigns across three clients.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login?mode=signup"
              className="rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-deep"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-ink-line px-5 py-2.5 text-sm font-medium text-white/80 transition hover:border-signal hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <CategoryMeters />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-paper px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-text-faint">How it works</p>
          <h2 className="mb-8 font-display text-2xl font-semibold text-text">
            Three layers. One clear picture.
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <HowItWorksCard icon={<IconGrid />} title="Projects">
              Every campaign or client gets its own project — a home for its goals and its to-dos.
            </HowItWorksCard>
            <HowItWorksCard icon={<IconTarget />} title="Goals">
              Set a target for each channel — social, ads, SEO, content, email — and watch the meter fill
              as real progress comes in.
            </HowItWorksCard>
            <HowItWorksCard icon={<IconCheck />} title="Tasks">
              Break goals into tasks, link them back to the target they move, and check them off as
              they're done.
            </HowItWorksCard>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">Ready to see your campaigns clearly?</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-faint">
          Free to use. Takes under a minute to create your first project.
        </p>
        <Link
          href="/login?mode=signup"
          className="mt-6 inline-block rounded-lg bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-deep"
        >
          Create free account
        </Link>
      </section>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/projects");
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <span className="font-mono text-xs uppercase tracking-widest text-text-faint">Loading…</span>
      </div>
    );
  }

  return <LandingPage />;
}
