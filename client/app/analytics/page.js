"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  ChevronDown,
  TrendingUp,
  Target,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card, { CardHeading } from "@/components/app/Card";
import { SegmentedControl, LightSelect, Chip } from "@/components/app/Pills";
import StatusPill, { EmptyState, ErrorBanner, ProgressBar } from "@/components/app/UI";
import SummaryCard from "@/components/dashboard/SummaryCard";
import { api } from "@/lib/api";
import { computeAnalytics, weeklyCompletions, statusSegments } from "@/lib/analytics";
import { CATEGORIES } from "@/lib/constants";
import { formatDueDate } from "@/lib/dashboard";

const STATUS_PILL_TONES = {
  completed: "positive",
  in_progress: "accent",
  pending: "muted",
};

// Pure-CSS donut built from a conic gradient — no chart library needed.
function Donut({ segments, size = 148, thickness = 16, centerLabel, centerValue }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let acc = 0;
  const stops = segments.flatMap((s, i) => {
    const from = (acc / (total || 1)) * 360;
    acc += s.value;
    const to = (acc / (total || 1)) * 360;
    const parts = [`${s.color} ${from}deg ${to}deg`];
    if (i === 0 && from > 0) parts.unshift(`transparent 0deg ${from}deg`);
    return parts;
  });
  const gradient =
    total > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#EEF1F6 0deg 360deg)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={centerLabel}>
      <div
        className="rounded-full"
        style={{ width: size, height: size, background: gradient }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white"
        style={{ width: size - thickness * 2, height: size - thickness * 2 }}
      >
        <span className="font-display text-2xl font-bold tracking-tight text-[#0F172A]">{centerValue}</span>
        <span className="text-[11px] font-medium text-[#8A94A6]">{centerLabel}</span>
      </div>
    </div>
  );
}

function AnalyticsView() {
  const [projects, setProjects] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [scope, setScope] = useState("active"); // active | all
  const [sort, setSort] = useState("progress"); // progress | name | dueDate | tasks
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.listProjects({ archived: "all" });
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
      setProjects((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = projects === null;
  const scoped = useMemo(
    () => (projects || []).filter((p) => (scope === "active" ? !p.archived : true)),
    [projects, scope]
  );

  const analytics = useMemo(() => computeAnalytics(scoped), [scoped]);
  const weeks = useMemo(() => weeklyCompletions(scoped, 8), [scoped]);
  const segments = useMemo(() => statusSegments(analytics), [analytics]);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  const sortedRows = useMemo(() => {
    const rows = [...analytics.rows];
    switch (sort) {
      case "name":
        return rows.sort((a, b) => (a.project.name || "").localeCompare(b.project.name || ""));
      case "dueDate":
        return rows.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });
      case "tasks":
        return rows.sort((a, b) => b.tasksDone - a.tasksDone);
      case "progress":
      default:
        return rows.sort((a, b) => b.progress - a.progress);
    }
  }, [analytics.rows, sort]);

  const taskSegments = [
    { label: "Done", value: analytics.tasksByStatus.done, color: "#12B76A" },
    { label: "In progress", value: analytics.tasksByStatus.in_progress, color: "#7C5CFF" },
    { label: "To do", value: analytics.tasksByStatus.todo, color: "#C9D3E0" },
  ];
  const taskTotal = taskSegments.reduce((sum, s) => sum + s.value, 0);

  const categoriesWithWork = Object.values(analytics.byCategory).filter((c) => c.projects > 0 || c.goals > 0);
  const maxCategory = Math.max(1, ...categoriesWithWork.map((c) => c.projects + c.goals));

  return (
    <AppShell>
      <PageHeading
        title="Analytics"
        subtitle="Detailed performance analytics across every project — status, progress, tasks, channels, and completion trends."
        actions={
          <SegmentedControl
            ariaLabel="Analytics scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "active", label: "Active" },
              { value: "all", label: "Include archived" },
            ]}
          />
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {/* Key numbers */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Projects tracked"
          value={loading ? "—" : analytics.total}
          info={
            analytics.total > 0
              ? `${analytics.byStatus.in_progress} in progress · ${analytics.byStatus.completed} completed`
              : "No projects in scope"
          }
          icon={FolderKanban}
          iconBg="#F1EDFF"
          iconColor="#7C5CFF"
        />
        <SummaryCard
          label="Avg. completion"
          value={loading ? "—" : `${analytics.avgCompletion}%`}
          info={analytics.avgTaskCompletion > 0 ? `${analytics.avgTaskCompletion}% of all tasks done` : "no tasks logged yet"}
          infoTone={analytics.avgCompletion >= 50 ? "positive" : "muted"}
          icon={Gauge}
          iconBg="#E7F6EF"
          iconColor="#12B76A"
        />
        <SummaryCard
          label="Tasks done"
          value={loading ? "—" : analytics.tasksDone}
          info={analytics.tasksTotal > 0 ? `of ${analytics.tasksTotal} total tasks` : "no tasks yet"}
          infoTone="accent"
          icon={CheckCircle2}
          iconBg="#F1EDFF"
          iconColor="#7C5CFF"
        />
        <SummaryCard
          label="Overdue work"
          value={loading ? "—" : analytics.tasksOverdue}
          info={
            analytics.tasksOverdue > 0
              ? `${analytics.overdueProjects} project${analytics.overdueProjects !== 1 ? "s" : ""} past due`
              : "everything on schedule"
          }
          infoTone={analytics.tasksOverdue > 0 ? "danger" : "positive"}
          icon={AlertTriangle}
          iconBg={analytics.tasksOverdue > 0 ? "#FDEEEF" : "#E7F6EF"}
          iconColor={analytics.tasksOverdue > 0 ? "#DC3D43" : "#12B76A"}
        />
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-64 animate-pulse rounded-2xl border border-[#E9EDF3] bg-white" />
          <div className="h-64 animate-pulse rounded-2xl border border-[#E9EDF3] bg-white" />
        </div>
      ) : analytics.total === 0 ? (
        <div className="mt-6">
          <EmptyState icon={TrendingUp} title="No data to analyze yet">
            <p>
              Analytics fill in automatically as you create projects and complete tasks.{" "}
              <Link href="/projects" className="font-semibold text-[#6D4FE0] underline underline-offset-2">
                Create your first project
              </Link>{" "}
              to get started.
            </p>
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Distribution row */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeading title="Project status" sub="Every project, grouped by derived status" />
              <div className="flex items-center gap-6 px-5 py-5">
                <Donut segments={segments} centerValue={analytics.total} centerLabel="projects" />
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {segments.length === 0 && <li className="text-sm text-[#8A94A6]">No projects yet.</li>}
                  {segments.map((s) => (
                    <li key={s.key} className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-[#31405A]">{s.label}</span>
                      <span className="text-[13px] font-bold text-[#0F172A]">{s.value}</span>
                      <span className="w-10 text-right text-[11px] font-medium text-[#9AA5B5]">
                        {Math.round((s.value / analytics.total) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card>
              <CardHeading title="Task breakdown" sub={`${taskTotal} tasks across all projects in scope`} />
              <div className="px-5 py-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#EEF1F6]">
                  {taskSegments.map(
                    (s) =>
                      s.value > 0 && (
                        <div
                          key={s.label}
                          className="h-full transition-all duration-500"
                          style={{ width: `${(s.value / Math.max(1, taskTotal)) * 100}%`, backgroundColor: s.color }}
                          title={`${s.label}: ${s.value}`}
                        />
                      )
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {taskSegments.map((s) => (
                    <div key={s.label} className="rounded-xl bg-[#F8FAFD] px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#8A94A6]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </p>
                      <p className="mt-0.5 font-display text-lg font-bold text-[#0F172A]">{s.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[#8A94A6]">
                  Completion rate:{" "}
                  <span className="font-bold text-[#0F172A]">{analytics.avgTaskCompletion}%</span> of all tasks are done.
                </p>
              </div>
            </Card>
          </div>

          {/* Trend + channels */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeading
                title="Completions per week"
                sub="Tasks completed over the last 8 weeks"
                right={<Chip tone="accent">{weeks.reduce((s, w) => s + w.count, 0)} in 8 weeks</Chip>}
              />
              <div className="px-5 py-5">
                <div className="flex h-36 items-end gap-2">
                  {weeks.map((w, i) => (
                    <div key={i} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#0F172A] opacity-0 transition group-hover:opacity-100">
                        {w.count}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          w.count > 0
                            ? "bg-gradient-to-t from-[#7C5CFF] to-[#4F7BFF]"
                            : "bg-[#EEF1F6]"
                        }`}
                        style={{ height: `${Math.max(6, (w.count / maxWeek) * 100)}%` }}
                        title={`${w.label}: ${w.count} completed`}
                      />
                      <span className="w-full truncate text-center text-[10px] font-medium text-[#9AA5B5]">
                        {w.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeading title="Channel mix" sub="Projects and goals by marketing category" />
              <div className="px-5 py-5">
                {categoriesWithWork.length === 0 ? (
                  <p className="text-sm text-[#8A94A6]">
                    No categorized goals yet — add a goal with a category (Social, Paid Ads, SEO…) to see the channel mix.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {categoriesWithWork.map((c) => {
                      const weight = (c.projects + c.goals) / maxCategory;
                      return (
                        <li key={c.key}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                            <span className="flex min-w-0 items-center gap-2 font-medium text-[#31405A]">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.label}
                            </span>
                            <span className="shrink-0 text-[11px] font-medium text-[#8A94A6]">
                              {c.projects} project{c.projects !== 1 ? "s" : ""} · {c.goals} goal{c.goals !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF1F6]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(3, weight * 100)}%`, backgroundColor: c.color }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Per-project detail table */}
          <Card className="mt-4 overflow-hidden">
            <CardHeading
              title="Project performance"
              sub="Click a row to expand its goals and metrics detail"
              right={
                <LightSelect ariaLabel="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="progress">Sort: Progress</option>
                  <option value="tasks">Sort: Tasks done</option>
                  <option value="name">Sort: Name</option>
                  <option value="dueDate">Sort: Due date</option>
                </LightSelect>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#F1F4F9] text-[11px] uppercase tracking-wide text-[#8A94A6]">
                    <th scope="col" className="px-5 py-3 font-semibold">Project</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Progress</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">Tasks</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">Goals</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">Overdue</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Due</th>
                    <th scope="col" className="w-10 px-2 py-3" aria-label="Expand" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const isOpen = expanded === row.project.id;
                    return (
                      <Fragment key={row.project.id}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : row.project.id)}
                          className={`cursor-pointer border-b border-[#F1F4F9] transition hover:bg-[#F8FAFD] ${
                            isOpen ? "bg-[#F8FAFD]" : ""
                          }`}
                        >
                          <td className="max-w-[260px] px-5 py-3.5">
                            <Link
                              href={`/projects/${row.project.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate font-semibold text-[#0F172A] transition hover:text-[#6D4FE0]"
                            >
                              {row.project.name}
                            </Link>
                            {row.categoryKey && (
                              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8A94A6]">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: CATEGORIES[row.categoryKey].color }}
                                />
                                {CATEGORIES[row.categoryKey].label}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusPill project={row.project} />
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex w-36 items-center gap-2.5">
                              <ProgressBar value={row.progress} label={`${row.project.name} progress`} />
                              <span className="w-9 shrink-0 text-xs font-bold text-[#0F172A]">{row.progress}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-center text-[13px] font-medium text-[#31405A]">
                            {row.tasksDone}/{row.tasksTotal}
                          </td>
                          <td className="px-3 py-3.5 text-center text-[13px] font-medium text-[#31405A]">{row.goalsTotal}</td>
                          <td className="px-3 py-3.5 text-center">
                            {row.overdueTasks > 0 ? (
                              <Chip tone="danger">{row.overdueTasks}</Chip>
                            ) : (
                              <span className="text-[13px] text-[#C9D3E0]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-medium">
                            {row.dueDate ? (
                              <span className={row.overdueProject ? "text-[#DC3D43]" : "text-[#5B6B7F]"}>
                                {row.overdueProject ? "Overdue · " : ""}
                                {formatDueDate(row.dueDate)}
                              </span>
                            ) : (
                              <span className="text-[#C9D3E0]">—</span>
                            )}
                          </td>
                          <td className="px-2 py-3.5">
                            <ChevronDown
                              size={15}
                              strokeWidth={2}
                              className={`text-[#9AA5B5] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-[#F1F4F9] bg-[#FAFBFD]">
                            <td colSpan={8} className="px-5 py-4">
                              {row.project.goals.length === 0 && row.tasksTotal === 0 ? (
                                <p className="text-[13px] text-[#8A94A6]">
                                  No goals or tasks logged for this project yet — open it to add some.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                                  {row.project.goals.map((g) => {
                                    const pct =
                                      g.targetValue > 0
                                        ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
                                        : 0;
                                    const cat = CATEGORIES[g.category];
                                    return (
                                      <div key={g.id} className="rounded-xl border border-[#E9EDF3] bg-white px-3.5 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#0F172A]">
                                            <Target size={13} strokeWidth={2} className="shrink-0 text-[#7C5CFF]" />
                                            <span className="truncate">{g.title}</span>
                                          </span>
                                          <span className="shrink-0 text-[11px] font-medium text-[#8A94A6]">
                                            {g.currentValue}/{g.targetValue}
                                          </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                          <ProgressBar value={pct} label={`${g.title} progress`} />
                                          <span className="w-9 shrink-0 text-right text-[11px] font-bold text-[#0F172A]">{pct}%</span>
                                        </div>
                                        {cat && (
                                          <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#8A94A6]">
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                            {cat.label}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {row.project.goals.length === 0 && row.tasksTotal > 0 && (
                                    <p className="text-[13px] text-[#8A94A6]">
                                      No goals yet — this project&apos;s progress comes from its {row.tasksTotal} task
                                      {row.tasksTotal !== 1 ? "s" : ""}.
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthGuard>
      <AnalyticsView />
    </AuthGuard>
  );
}
