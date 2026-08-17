"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import HeroPreview from "@/components/HeroPreview";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";
import { useTheme } from "@/lib/ThemeContext";

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M7.5 12.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HowItWorksCard({ icon, title, children, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="group rounded-2xl border border-line bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#7C5CFF]/30 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55)] hover:shadow-glow/10">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E1C2E] text-[#7C5CFF] ring-1 ring-[#7C5CFF]/20 transition duration-300 group-hover:scale-105 group-hover:bg-[#7C5CFF] group-hover:text-text">
          {icon}
        </div>
        <h3 className="font-display text-base font-semibold tracking-tight text-text">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-soft">{children}</p>
      </div>
    </Reveal>
  );
}

function LandingPage() {
  const { theme } = useTheme();
  const logoVariant = theme === "dark" ? "light" : "dark";
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is DECK?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "DECK is the minimal control center for marketing teams to plan campaigns, track goals by channel (Social, Paid Ads, SEO, Content, Email), and achieve outcomes — without the noise.",
        },
      },
      {
        "@type": "Question",
        name: "How does DECK help plan marketing campaigns?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Every client or campaign lives as a project in DECK. You create projects, set channel goals with targets, and break them into tasks linked to those goals. Progress, due dates, and ownership stay visible on one board.",
        },
      },
      {
        "@type": "Question",
        name: "How does goal tracking work in DECK?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pick a channel, set a target (e.g., 20 Reels, 500 leads), and watch the meter fill as linked tasks are completed. Each task completion moves its goal by the goal's step, so progress is always tied to real work.",
        },
      },
      {
        "@type": "Question",
        name: "How are tasks linked to goals in DECK?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "When you create a task you can link it to a goal. Completing the task advances the goal. This creates accountability and shows which work actually moved the metric.",
        },
      },
      {
        "@type": "Question",
        name: "Who is DECK for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "DECK is for creators, founders, and marketers who need clarity over clutter. It is designed for busy teams that run multiple campaigns across multiple clients.",
        },
      },
      {
        "@type": "Question",
        name: "Is DECK free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, DECK is free to start. Create your first project in under a minute, no credit card required.",
        },
      },
    ],
  };
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to organize marketing projects with DECK",
    description: "Organize any marketing campaign in three layers — Projects, Goals, Tasks — to keep every channel and deadline visible.",
    totalTime: "PT5M",
    supply: [{ "@type": "HowToSupply", name: "DECK account (free)" }],
    tool: [{ "@type": "HowToTool", name: "DECK — Plan. Track. Achieve." }],
    step: [
      {
        "@type": "HowToStep",
        name: "Create a Project",
        text: "Create a project for every client or campaign (e.g., Q3 Launch — Acme). It becomes the single board for all goals and tasks.",
        url: "https://planyourdeck.com/#how-it-works",
      },
      {
        "@type": "HowToStep",
        name: "Set channel Goals",
        text: "Add goals by channel — Social Media, Paid Ads, SEO, Content, Email — set a target (e.g., 20 Reels, 500 leads) and watch the meter fill as work completes.",
        url: "https://planyourdeck.com/#how-it-works",
      },
      {
        "@type": "HowToStep",
        name: "Break into linked Tasks",
        text: "Break goals into tasks, link each task to its goal, assign and set due dates. Completing a task advances its goal, so progress is always tied to real, accountable work.",
        url: "https://planyourdeck.com/#how-it-works",
      },
    ],
  };
  return (
    <div className="bg-paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line/60 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="DECK home">
            <Logo variant={logoVariant} size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex rounded-full px-4 py-2 text-sm font-medium text-text-soft transition hover:text-text">
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center rounded-full bg-[#7C5CFF] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,92,255,0.35)] transition hover:bg-[#6A44FF] hover:shadow-[0_0_28px_rgba(124,92,255,0.45)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* subtle violet glow - only accent, not full gradient */}
        <div className="pointer-events-none absolute -top-24 right-0 h-[600px] w-[700px] rounded-full bg-[#7C5CFF]/[0.08] blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[500px] w-[600px] rounded-full bg-[#4F7BFF]/[0.06] blur-[120px]" />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24 lg:pt-16">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2/80 px-3 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7C5CFF] animate-pulse_dot" />
              <span className="text-xs font-medium tracking-wide text-text-soft">AI-first · Minimal · Confident</span>
            </div>

            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-[44px] lg:text-[52px]">
              Plan.
              <br />
              Track.
              <br />
              <span className="bg-gradient-to-r from-[#7C5CFF] to-[#4F7BFF] bg-clip-text text-transparent">Achieve.</span>
            </h1>

            <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-text-soft">
              The minimal control center for marketing teams. One dark, focused workspace where every project, goal and task is visible — nothing slips, nothing extra.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center rounded-full bg-[#7C5CFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,92,255,0.4)] transition hover:bg-[#6A44FF] hover:shadow-[0_0_32px_rgba(124,92,255,0.5)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Create free account
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-2">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-full border border-line bg-card px-6 py-3 text-sm font-medium text-text transition hover:border-[#7C5CFF]/30 hover:bg-card"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#22D3A6]" /> No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#4F7BFF]" /> Under 60 seconds
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#7C5CFF]" /> Built for teams that ship
              </span>
            </div>
          </Reveal>

          <Reveal delay={140} className="flex justify-center lg:justify-end">
            <HeroPreview />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-ink-2 px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-faint">How it works</p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
                Three layers. One clear picture.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-soft">
                No decoration. No dashboards for decoration&apos;s sake. Just the three things that actually move a campaign forward.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <HowItWorksCard icon={<IconGrid />} title="Projects" delay={0}>
              Every client or campaign lives as a project — focused, contained, shareable.
            </HowItWorksCard>
            <HowItWorksCard icon={<IconTarget />} title="Goals" delay={100}>
              Channels become goals. Targets, progress, and category — visible at a glance.
            </HowItWorksCard>
            <HowItWorksCard icon={<IconCheck />} title="Tasks" delay={200}>
              Goals break into tasks. Linked, completable, and traceable to the outcome they moved.
            </HowItWorksCard>
          </div>
        </div>
      </section>

      {/* Social proof / minimal strip */}
      <section className="border-y border-line bg-ink-2/50 px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <span className="h-8 w-8 rounded-full border-2 border-paper bg-[#1E1C2E] flex items-center justify-center text-xs font-semibold text-[#7C5CFF]">A</span>
                <span className="h-8 w-8 rounded-full border-2 border-paper bg-[#1A2332] flex items-center justify-center text-xs font-semibold text-[#4F7BFF]">M</span>
                <span className="h-8 w-8 rounded-full border-2 border-paper bg-[#132A24] flex items-center justify-center text-xs font-semibold text-[#22D3A6]">S</span>
              </div>
              <p className="text-sm text-text-soft">
                <span className="font-semibold text-text">For creators, founders, marketers</span> — clarity over clutter
              </p>
            </div>
            <p className="max-w-md text-center text-sm italic text-text-faint sm:text-right">
              “Finally a project tool that feels designed, not decorated. It just gets out of the way.”
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-5 py-16 text-center sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#7C5CFF]/[0.06] via-transparent to-transparent" />
        <Reveal>
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
              Ready to see campaigns clearly?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-soft">
              Free to use. Minimal by design. Powerful where it counts. Create your first project in under a minute.
            </p>
            <Link
              href="/login?mode=signup"
              className="mt-7 inline-flex items-center rounded-full bg-text text-paper px-7 py-3 text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Create free account
            </Link>
            <p className="mt-3 text-xs text-text-faint">No spam. No onboarding calls. Just DECK.</p>
          </div>
        </Reveal>
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

  return <LandingPage />;
}
