"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Download, Loader2, FolderKanban, CheckCircle2, AlertTriangle, PlusCircle } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card, { CardHeading } from "@/components/app/Card";
import { SegmentedControl, Chip } from "@/components/app/Pills";
import { EmptyState, ErrorBanner, PrimaryButton, ProgressBar, StatusPillForStatus } from "@/components/app/UI";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { REPORT_PERIODS, resolvePeriod, buildReportData, generateReportPDF } from "@/lib/reports";
import { formatDueDate } from "@/lib/dashboard";

function ReportsView() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [periodValue, setPeriodValue] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(""); // success note

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
  const period = useMemo(
    () => resolvePeriod(periodValue, { from: customFrom, to: customTo }),
    [periodValue, customFrom, customTo]
  );
  const report = useMemo(
    () => buildReportData(loading ? [] : projects, period, user),
    [projects, period, user, loading]
  );

  async function handleDownload() {
    setError("");
    setGenerated("");
    setGenerating(true);
    try {
      await generateReportPDF(report);
      setGenerated("Report downloaded — check your downloads folder.");
    } catch (err) {
      setError(err?.message || "Could not generate the PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const previewStats = [
    {
      label: "Active projects",
      value: report.summary.activeProjects,
      icon: FolderKanban,
      iconBg: "#F1EDFF",
      iconColor: "#7C5CFF",
    },
    {
      label: "Tasks completed",
      value: report.summary.tasksCompleted,
      icon: CheckCircle2,
      iconBg: "#E7F6EF",
      iconColor: "#12B76A",
    },
    {
      label: "Tasks created",
      value: report.summary.tasksCreated,
      icon: PlusCircle,
      iconBg: "#FEF4E4",
      iconColor: "#E8A23D",
    },
    {
      label: "Overdue now",
      value: report.summary.overdueNow,
      icon: AlertTriangle,
      iconBg: report.summary.overdueNow > 0 ? "#FDEEEF" : "#E7F6EF",
      iconColor: report.summary.overdueNow > 0 ? "#DC3D43" : "#12B76A",
    },
  ];

  return (
    <AppShell>
      <PageHeading
        title="Reports"
        subtitle="Timely performance reports as PDFs — pick a period, preview the numbers, and download."
        actions={
          <PrimaryButton onClick={handleDownload} disabled={generating || loading}>
            {generating ? (
              <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
            ) : (
              <Download size={15} strokeWidth={2.2} />
            )}
            {generating ? "Generating…" : "Download PDF"}
          </PrimaryButton>
        }
      />

      <ErrorBanner message={error} onRetry={load} />
      {generated && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-good-line bg-good-tint px-4 py-3 text-sm text-good-text">
          <CheckCircle2 size={16} strokeWidth={2} />
          {generated}
        </div>
      )}

      {/* Period picker */}
      <Card className="mt-1">
        <CardHeading title="Reporting period" sub="Choose what the report covers" />
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedControl
            ariaLabel="Report period"
            value={periodValue}
            onChange={setPeriodValue}
            options={REPORT_PERIODS}
          />
          {periodValue === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
                className="h-9 rounded-xl border border-line bg-card px-3 text-[13px] font-medium text-text outline-none focus:border-[#7C5CFF]/50"
              />
              <span className="text-xs font-medium text-text-faint">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
                className="h-9 rounded-xl border border-line bg-card px-3 text-[13px] font-medium text-text outline-none focus:border-[#7C5CFF]/50"
              />
            </div>
          ) : (
            <p className="text-xs font-medium text-text-faint">
              {period.from} → {period.to}
            </p>
          )}
        </div>
      </Card>

      {/* Preview stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {previewStats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-16px_rgba(16,24,40,0.10)]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: s.iconBg, color: s.iconColor }}
              aria-hidden="true"
            >
              <s.icon size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-text-soft">{s.label}</p>
              <p className="font-display text-[22px] font-bold leading-tight tracking-tight text-text">
                {loading ? "—" : s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 space-y-4">
          <div className="h-72 animate-pulse rounded-2xl border border-line bg-card" />
        </div>
      ) : report.summary.activeProjects === 0 && report.summary.tasksCompleted === 0 ? (
        <div className="mt-4">
          <EmptyState icon={FileText} title="Nothing to report yet">
            <p>
              Reports are generated from your real project data.{" "}
              <Link href="/projects" className="font-semibold text-signal underline underline-offset-2">
                Create a project
              </Link>{" "}
              or complete a few tasks first.
            </p>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          {/* Project snapshot */}
          <Card className="overflow-hidden">
            <CardHeading
              title="Projects in this report"
              sub="Active projects, sorted by progress — same table the PDF includes"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-text-faint">
                    <th scope="col" className="px-5 py-3 font-semibold">Project</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Progress</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">Tasks</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {report.projectRows.map((row, i) => (
                    <tr key={`${row.name}-${i}`} className="border-b border-line last:border-b-0">
                      <td className="max-w-[220px] truncate px-5 py-3 font-semibold text-text">{row.name}</td>
                      <td className="px-3 py-3">
                        <StatusPillForStatus status={row.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex w-32 items-center gap-2">
                          <ProgressBar value={row.progress} label={`${row.name} progress`} />
                          <span className="w-9 shrink-0 text-xs font-bold text-text">{row.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-[13px] font-medium text-text">
                        {row.tasksDone}/{row.tasksTotal}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] font-medium text-text-soft">
                        {row.dueDate ? formatDueDate(row.dueDate) : "—"}
                      </td>
                    </tr>
                  ))}
                  {report.projectRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-sm text-text-faint">
                        No active projects right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Completed tasks */}
          <Card>
            <CardHeading
              title="Completed in period"
              right={<Chip tone="positive">{report.completedTasks.length}</Chip>}
            />
            <div className="max-h-[420px] overflow-y-auto px-5 py-4">
              {report.completedTasks.length === 0 ? (
                <p className="text-sm text-text-faint">No tasks were completed in this period.</p>
              ) : (
                <ul className="space-y-2.5">
                  {report.completedTasks.map((t, i) => (
                    <li key={`${t.title}-${i}`} className="flex items-start gap-2.5">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#12B76A]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-text">{t.title}</p>
                        <p className="text-[11px] text-text-faint">
                          {t.projectName} · {t.date}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-line px-5 py-4">
              <p className="text-xs leading-relaxed text-text-faint">
                The PDF also includes key-number tiles, new-project counts, and per-project progress bars —
                everything you see here, formatted for print and sharing.
              </p>
              <PrimaryButton onClick={handleDownload} disabled={generating} className="mt-3 w-full">
                {generating ? (
                  <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
                ) : (
                  <Download size={15} strokeWidth={2.2} />
                )}
                {generating ? "Generating…" : `Download ${period.label.toLowerCase()} report`}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsView />
    </AuthGuard>
  );
}
