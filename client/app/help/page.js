"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CircleHelp,
  ChevronDown,
  Rocket,
  FolderKanban,
  ListTodo,
  CalendarDays,
  BarChart3,
  FileText,
  Settings,
  Users,
  Smartphone,
  Mail,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card, { CardHeading } from "@/components/app/Card";
import { EmptyState } from "@/components/app/UI";

const GETTING_STARTED = [
  {
    title: "Create your account",
    body: "Sign up with your email, or accept a workspace invite from a teammate. Every account starts with a personal workspace.",
  },
  {
    title: "Create a project",
    body: "Projects hold everything — goals, tasks, milestones, metrics, and files. Add a due date and priority so urgent work surfaces first.",
  },
  {
    title: "Set goals by channel",
    body: "Add goals like “Reach 50k followers” (Social) or “ROAS 4x” (Paid Ads) with a target value. Progress % everywhere comes from these numbers.",
  },
  {
    title: "Break work into tasks",
    body: "Add tasks with statuses and due dates. Use Quick add on the Projects page to file a task under any project in seconds.",
  },
  {
    title: "Track from Overview & Analytics",
    body: "Overview shows what needs attention today; Analytics breaks down status, progress, channels, and weekly completion trends.",
  },
  {
    title: "Download reports",
    body: "Pick any period on the Reports page and download a branded PDF summary — perfect for client updates and standups.",
  },
];

const GUIDE = [
  {
    icon: Rocket,
    title: "Overview",
    href: "/dashboard",
    body: "Your home base after signing in: greeting, summary cards, active projects, and today's tasks at a glance.",
    points: [
      "Check off today's tasks right from the list — changes save instantly.",
      "Use the header search to filter both projects and tasks at once.",
      "“View all” links jump to the full Projects page.",
    ],
  },
  {
    icon: FolderKanban,
    title: "Projects",
    href: "/projects",
    body: "Every campaign in one list with live status pills, progress bars, and quick actions.",
    points: [
      "Filter by status, priority, or archive state; sort by due date, name, or newest.",
      "The ⋯ menu on each card opens, archives, or deletes a project.",
      "Open a project to manage goals, tasks, milestones, metrics, files, and comments.",
    ],
  },
  {
    icon: ListTodo,
    title: "Tasks",
    href: "/personal",
    body: "Private to-dos and notes, dated like a work journal. Only you can see them.",
    points: [
      "Toggle between To-do and Note before adding.",
      "To-dos can carry an optional due date — overdue ones are flagged in red.",
      "Hover a row to edit or delete; entries group by day automatically.",
    ],
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    href: "/calendar",
    body: "One month view of every task deadline, project due date, milestone, and personal entry.",
    points: [
      "Click a day to see its events and log a note or to-do for it.",
      "Colored dots match the legend — deadlines, due dates, milestones, to-dos, notes.",
      "Project events link straight to the project they belong to.",
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics",
    href: "/analytics",
    body: "Detailed project analytics: status donut, task breakdown, channel mix, and an 8-week completion trend.",
    points: [
      "Expand any project row to see each goal's current vs. target progress.",
      "Switch scope between Active only and Include archived.",
      "Every number is derived from your real data — nothing is estimated.",
    ],
  },
  {
    icon: FileText,
    title: "Reports",
    href: "/reports",
    body: "Timely PDF reports for any period — weekly, monthly, quarterly, or a custom range.",
    points: [
      "Preview the key numbers and the project table before downloading.",
      "The PDF includes summary tiles, per-project progress bars, and the completed-task log.",
      "Files download straight to your device — no copy is stored on our servers.",
    ],
  },
  {
    icon: Users,
    title: "Team & workspaces",
    href: "/team",
    body: "Invite teammates, assign roles, and share projects inside workspaces.",
    points: [
      "Owners and admins see every project in the workspace.",
      "Members see projects they created or were granted access to.",
      "Pending invites show until accepted; roles can be changed anytime.",
    ],
  },
  {
    icon: Settings,
    title: "Settings",
    href: "/settings",
    body: "Profile, password, theme, app install, and account controls in one place.",
    points: [
      "Update your display name anytime; email changes are not supported yet.",
      "Choose Dark, Light, or Eye-comfort theme — it applies across the app.",
      "You can request full account deletion from the Danger zone.",
    ],
  },
  {
    icon: Smartphone,
    title: "Install the app",
    href: "/download",
    body: "Install DECK on desktop and mobile — Android also has a direct APK download.",
    points: [
      "Chrome/Edge desktop: install icon in the address bar.",
      "iOS Safari: Share → Add to Home Screen.",
      "Android: download DECK.apk from the Download page, or use Chrome → Install app.",
    ],
  },
];

const FAQ = [
  {
    group: "Basics",
    items: [
      {
        q: "What exactly is DECK?",
        a: "DECK is a project control center for marketing teams. It tracks marketing projects, channel goals (Social, Paid Ads, SEO, Content, Email), tasks, deadlines, and reporting — without the bloat of enterprise tools.",
      },
      {
        q: "How is a project's status decided?",
        a: "Status is derived from real activity: “Pending” when it has no tasks yet, “In progress” once any task moves past To do, and “Completed” when every task is done. You never set it manually, so it can't go stale.",
      },
      {
        q: "How is progress % calculated?",
        a: "If a project has goals, progress is the average of each goal's current/target value (capped at 100% per goal). If it has no goals but has tasks, it's the share of completed tasks.",
      },
      {
        q: "Does DECK work on mobile?",
        a: "Yes — the whole app is responsive, and you can install it as an app (PWA) from the browser on Android, iOS, and desktop. See the Download page for per-device steps.",
      },
    ],
  },
  {
    group: "Projects & goals",
    items: [
      {
        q: "What's the difference between archiving and deleting a project?",
        a: "Archiving removes a project from active views but keeps everything intact — unarchive anytime from Projects → Archived. Deleting permanently removes the project with all its goals, tasks, files, and history.",
      },
      {
        q: "Can I set numeric goals per channel?",
        a: "Yes. Each goal has a category, a target value, and a current value. Update the current value as results come in — progress, analytics, and reports all recalculate instantly.",
      },
      {
        q: "How do I log performance metrics?",
        a: "Open a project → Metrics. Add a metric from the catalog (Reach, CTR, Spend…) or create a custom one, then log dated entries. Entries build a running history per metric.",
      },
      {
        q: "Who can see my projects?",
        a: "In a workspace, owners and admins see all projects. Members see projects they created or were explicitly granted access to. Your Tasks page (personal notes & to-dos) is always private to you.",
      },
    ],
  },
  {
    group: "Tasks & calendar",
    items: [
      {
        q: "Where do “Today's tasks” on the Overview come from?",
        a: "They're project tasks that are due today or overdue, plus tasks completed today — pulled live from your projects, not a separate list.",
      },
      {
        q: "What shows up on the Calendar?",
        a: "Task deadlines, project due dates, milestones, and your personal notes & to-dos. Click any day to inspect and add entries for it.",
      },
      {
        q: "Can I set reminders?",
        a: "To-dos can carry a due date; overdue items are flagged in red on the Tasks page and counted on the Overview. In-app notifications cover mentions, invitations, and workspace activity via the bell in the header.",
      },
    ],
  },
  {
    group: "Analytics & reports",
    items: [
      {
        q: "What period options do reports support?",
        a: "This week, last week, this month, last month, last 30 days, this quarter, this year, all time — or any custom date range.",
      },
      {
        q: "What's inside the PDF?",
        a: "A branded cover with the period and recipient, key-number tiles (active/completed projects, tasks completed & created, overdue), a per-project performance table with progress bars, and the full completed-task log for the period.",
      },
      {
        q: "Are reports stored anywhere?",
        a: "No. The PDF is generated in your browser and downloaded directly. Nothing is uploaded or retained server-side.",
      },
      {
        q: "Why does Analytics show zero completions some weeks?",
        a: "The trend counts tasks by their completion date. Weeks where nothing was completed show as empty bars — a real signal, not a bug.",
      },
    ],
  },
  {
    group: "Account & data",
    items: [
      {
        q: "I forgot my password — how do I reset it?",
        a: "Use “Forgot password” on the login page. You'll receive a reset link by email; it expires after a limited time for security.",
      },
      {
        q: "Can I change my theme?",
        a: "Yes — from the account menu in the header or Settings. Dark, Light, and Eye-comfort (warm, low-blue) themes are available.",
      },
      {
        q: "How do I delete my account?",
        a: "Settings → Danger zone → Delete account. Deletion is subject to a short grace window; the exact behavior is confirmed on screen before you commit.",
      },
    ],
  },
];

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-paper"
      >
        <span className="text-[13.5px] font-semibold text-text">{item.q}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`shrink-0 text-text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="px-5 pb-4 text-[13px] leading-relaxed text-text-soft">{item.a}</p>
      )}
    </div>
  );
}

function HelpView() {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState("");

  const q = query.trim().toLowerCase();

  const filteredFaq = useMemo(() => {
    if (!q) return FAQ;
    return FAQ.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter((group) => group.items.length > 0);
  }, [q]);

  const filteredGuide = useMemo(() => {
    if (!q) return GUIDE;
    return GUIDE.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.body.toLowerCase().includes(q) ||
        g.points.some((p) => p.toLowerCase().includes(q))
    );
  }, [q]);

  const totalFaq = filteredFaq.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <AppShell>
      <PageHeading
        title="Help & Guidebook"
        subtitle="Everything you need to master DECK — a step-by-step guide to every screen, plus answers to common questions."
      />

      {/* Getting started */}
      <Card className="mt-5">
        <CardHeading title="Getting started" sub="From zero to your first report in six steps" />
        <ol className="grid grid-cols-1 gap-0 px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
          {GETTING_STARTED.map((step, i) => (
            <li key={step.title} className="flex gap-3.5 px-3 py-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#4F7BFF] font-display text-[13px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-text">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-faint">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Feature guide */}
      <div className="mt-6">
        <h2 className="mb-3 font-display text-base font-bold tracking-tight text-text">Feature guide</h2>
        {filteredGuide.length === 0 ? (
          <EmptyState icon={CircleHelp} title="No guide sections match your search" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGuide.map((g) => (
              <Card key={g.title} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-tint text-[#7C5CFF]">
                    <g.icon size={17} strokeWidth={1.8} />
                  </span>
                  <h3 className="font-display text-[15px] font-bold tracking-tight text-text">{g.title}</h3>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-text-soft">{g.body}</p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {g.points.map((p) => (
                    <li key={p} className="flex gap-2 text-xs leading-relaxed text-text-faint">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[#7C5CFF]" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={g.href}
                  className="mt-3.5 self-start text-[13px] font-semibold text-signal transition hover:text-signal"
                >
                  Open {g.title} →
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-base font-bold tracking-tight text-text">
            Questions &amp; answers
            {!q && <span className="ml-2 text-xs font-medium text-text-faint">{totalFaq} answers</span>}
          </h2>
        </div>

        {filteredFaq.length === 0 ? (
          <EmptyState icon={CircleHelp} title={`No answers match “${query.trim()}”`}>
            <p>Try a different word — or email us at the address below and we'll help directly.</p>
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {filteredFaq.map((group) => (
              <Card key={group.group} className="overflow-hidden">
                <CardHeading title={group.group} />
                <div>
                  {group.items.map((item) => {
                    const key = `${group.group}:${item.q}`;
                    return (
                      <FaqItem
                        key={key}
                        item={item}
                        open={openKey === key}
                        onToggle={() => setOpenKey(openKey === key ? "" : key)}
                      />
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Still stuck */}
      <Card className="mt-8">
        <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-tint text-[#7C5CFF]">
              <Mail size={18} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-text">Still stuck?</p>
              <p className="mt-0.5 text-[13px] text-text-faint">
                Write to <span className="font-semibold text-signal">support@planyourdeck.com</span> — we usually
                reply within a day.
              </p>
            </div>
          </div>
          <Link
            href="/download"
            className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-[13px] font-semibold text-text transition hover:border-line hover:bg-paper"
          >
            Install the app
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}

export default function HelpPage() {
  return (
    <AuthGuard>
      <HelpView />
    </AuthGuard>
  );
}
