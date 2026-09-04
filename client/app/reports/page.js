"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Download,
  Loader2,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  X,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card, { CardHeading } from "@/components/app/Card";
import { SegmentedControl, LightSelect } from "@/components/app/Pills";
import {
  EmptyState,
  ErrorBanner,
  PrimaryButton,
  ProgressBar,
  StatusPillForStatus,
} from "@/components/app/UI";
import SummaryCard from "@/components/dashboard/SummaryCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import {
  REPORT_PERIODS,
  resolvePeriod,
  buildReportData,
  buildProjectReportData,
  generateReportPDF,
  generateProjectReportPDF,
  iso,
  formatReadableDate,
} from "@/lib/reports";
import { formatDueDate } from "@/lib/dashboard";

function ReportsView() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get("projectId") || searchParams.get("project");
  const paramFrom = searchParams.get("from");
  const paramTo = searchParams.get("to");
  const paramPeriod = searchParams.get("period");

  const knownPeriod = REPORT_PERIODS.some((p) => p.value === paramPeriod);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(paramProjectId || "all");
  const [periodValue, setPeriodValue] = useState(knownPeriod ? paramPeriod : paramFrom || paramTo ? "custom" : "this_month");
  const [customFrom, setCustomFrom] = useState(() => {
    if (paramFrom) return paramFrom;
    const now = new Date();
    return iso(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [customTo, setCustomTo] = useState(() => paramTo || iso(new Date()));
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState("");

  useEffect(() => {
    if (paramProjectId) setSelectedProjectId(paramProjectId);
  }, [paramProjectId]);

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

  const selectedProject = useMemo(() => {
    if (selectedProjectId === "all" || !projects) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  const portfolioReport = useMemo(
    () => buildReportData(loading ? [] : projects, period, user),
    [projects, period, user, loading]
  );

  const projectReport = useMemo(() => {
    if (!selectedProject) return null;
    return buildProjectReportData(selectedProject, period, user);
  }, [selectedProject, period, user]);

  async function handleDownload() {
    setError("");
    setGenerated("");
    setGenerating(true);
    try {
      if (selectedProject && projectReport) {
        await generateProjectReportPDF(projectReport);
        setGenerated(`Report for “${selectedProject.name}” downloaded.`);
      } else {
        await generateReportPDF(portfolioReport);
        setGenerated("Portfolio report downloaded.");
      }
    } catch (err) {
      setError(err?.message || "Could not generate the PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const hasNoData = !loading && projects && projects.length === 0;
  const completedTasks = selectedProject && projectReport
    ? projectReport.completedTasks
    : portfolioReport.completedTasks;

  return (
    <AppShell>
      <PageHeading
        title="Reports"
        subtitle="Preview the numbers, then download a PDF."
        actions={
          <PrimaryButton onClick={handleDownload} disabled={generating || loading || hasNoData}>
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
        <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-good-line bg-good-tint px-4 py-3 text-sm text-good-text">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 size={16} strokeWidth={2} className="shrink-0 text-[#12B76A]" />
            <span className="truncate">{generated}</span>
          </div>
          <button
            type="button"
            onClick={() => setGenerated("")}
            className="p-1 text-good-text/70 hover:text-good-text"
            aria-label="Dismiss message"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}

      <Card className="mt-1">
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <LightSelect
            ariaLabel="Select project for report"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full lg:w-72"
          >
            <option value="all">All projects</option>
            {(projects || [])
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            {(projects || []).some((p) => p.archived) && (
              <optgroup label="Archived">
                {(projects || [])
                  .filter((p) => p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </LightSelect>

          <SegmentedControl
            ariaLabel="Report period"
            value={periodValue}
            onChange={setPeriodValue}
            options={REPORT_PERIODS}
          />
        </div>

        {periodValue === "custom" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
            <label htmlFor="report-from-date" className="text-xs font-semibold text-text-soft">
              From
            </label>
            <input
              id="report-from-date"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-xl border border-line bg-paper px-3 text-[13px] font-medium text-text outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20"
            />
            <label htmlFor="report-to-date" className="text-xs font-semibold text-text-soft">
              To
            </label>
            <input
              id="report-to-date"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-xl border border-line bg-paper px-3 text-[13px] font-medium text-text outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20"
            />
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {selectedProject && projectReport ? (
          <>
            <SummaryCard
              label="Progress"
              value={loading ? "—" : `${projectReport.progress}%`}
              info={`${projectReport.summary.tasksDone} of ${projectReport.summary.tasksTotal} tasks done`}
              icon={TrendingUp}
              iconBg="#F1EDFF"
              iconColor="#7C5CFF"
            />
            <SummaryCard
              label="Completed in period"
              value={loading ? "—" : projectReport.summary.tasksCompletedInPeriod}
              info={period.label}
              infoTone="positive"
              icon={CheckCircle2}
              iconBg="#E7F6EF"
              iconColor="#12B76A"
            />
            <SummaryCard
              label="Open tasks"
              value={loading ? "—" : projectReport.summary.openTasksCount}
              info={selectedProject.name}
              icon={FolderKanban}
              iconBg="#FEF4E4"
              iconColor="#E8A23D"
            />
            <SummaryCard
              label="Overdue"
              value={loading ? "—" : projectReport.summary.overdueNow}
              info={projectReport.summary.overdueNow > 0 ? "needs attention" : "all clear"}
              infoTone={projectReport.summary.overdueNow > 0 ? "danger" : "positive"}
              icon={AlertTriangle}
              iconBg={projectReport.summary.overdueNow > 0 ? "#FDEEEF" : "#E7F6EF"}
              iconColor={projectReport.summary.overdueNow > 0 ? "#DC3D43" : "#12B76A"}
            />
          </>
        ) : (
          <>
            <SummaryCard
              label="Active projects"
              value={loading ? "—" : portfolioReport.summary.activeProjects}
              info={`${portfolioReport.summary.inProgressProjects} in progress`}
              icon={FolderKanban}
              iconBg="#F1EDFF"
              iconColor="#7C5CFF"
            />
            <SummaryCard
              label="Completed in period"
              value={loading ? "—" : portfolioReport.summary.tasksCompleted}
              info={period.label}
              infoTone="positive"
              icon={CheckCircle2}
              iconBg="#E7F6EF"
              iconColor="#12B76A"
            />
            <SummaryCard
              label="Avg. completion"
              value={loading ? "—" : `${portfolioReport.summary.avgCompletion}%`}
              info="across active projects"
              icon={TrendingUp}
              iconBg="#FEF4E4"
              iconColor="#E8A23D"
            />
            <SummaryCard
              label="Overdue"
              value={loading ? "—" : portfolioReport.summary.overdueNow}
              info={portfolioReport.summary.overdueNow > 0 ? "needs attention" : "all clear"}
              infoTone={portfolioReport.summary.overdueNow > 0 ? "danger" : "positive"}
              icon={AlertTriangle}
              iconBg={portfolioReport.summary.overdueNow > 0 ? "#FDEEEF" : "#E7F6EF"}
              iconColor={portfolioReport.summary.overdueNow > 0 ? "#DC3D43" : "#12B76A"}
            />
          </>
        )}
      </div>

      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-2xl border border-line bg-card" />
      ) : hasNoData ? (
        <div className="mt-4">
          <EmptyState icon={FileText} title="Nothing to report yet">
            <p>
              Reports are generated from your project data.{" "}
              <Link href="/projects" className="font-semibold text-signal underline underline-offset-2">
                Create a project
              </Link>{" "}
              first.
            </p>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            {selectedProject && projectReport ? (
              <>
                <CardHeading
                  title={selectedProject.name}
                  sub={selectedProject.dueDate ? `Due ${formatDueDate(selectedProject.dueDate)}` : period.label}
                  right={<StatusPillForStatus status={projectReport.status} />}
                />
                <div className="px-5 py-4">
                  <div className="mb-4 flex items-center gap-3">
                    <ProgressBar value={projectReport.progress} label={`${selectedProject.name} progress`} />
                    <span className="w-10 shrink-0 text-right text-sm font-bold text-text">
                      {projectReport.progress}%
                    </span>
                  </div>
                  <p className="text-xs text-text-faint">
                    {projectReport.summary.tasksDone} of {projectReport.summary.tasksTotal} tasks done
                    {projectReport.summary.goalsTotal > 0
                      ? ` · ${projectReport.summary.goalsCompleted}/${projectReport.summary.goalsTotal} goals`
                      : ""}
                    .{" "}
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId("all")}
                      className="font-semibold text-signal hover:underline"
                    >
                      View all projects
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <CardHeading
                  title="Projects"
                  sub="Click a project to focus the report"
                  right={
                    <span className="text-xs font-medium text-text-faint">
                      {portfolioReport.projectRows.length}
                    </span>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper/30 text-[11px] uppercase tracking-wide text-text-faint">
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Project
                        </th>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Status
                        </th>
                        <th scope="col" className="px-3 py-3 font-semibold">
                          Progress
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                          Done
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioReport.projectRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedProjectId(row.id)}
                          className="cursor-pointer border-b border-line last:border-b-0 transition hover:bg-paper/40"
                        >
                          <td className="max-w-[240px] truncate px-5 py-3 font-semibold text-text">{row.name}</td>
                          <td className="px-3 py-3">
                            <StatusPillForStatus status={row.status} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex w-28 items-center gap-2">
                              <ProgressBar value={row.progress} label={`${row.name} progress`} />
                              <span className="w-8 shrink-0 text-xs font-bold text-text">{row.progress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-[13px] font-medium text-text">
                            {row.tasksDone}/{row.tasksTotal}
                          </td>
                        </tr>
                      ))}
                      {portfolioReport.projectRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-center text-sm text-text-faint">
                            No active projects right now.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeading
              title="Completed in period"
              sub={period.label}
              right={
                <span className="text-xs font-semibold text-good-text">{completedTasks.length}</span>
              }
            />
            <div className="max-h-[380px] overflow-y-auto px-5 py-4">
              {completedTasks.length === 0 ? (
                <p className="text-sm text-text-faint">No tasks were completed in this period.</p>
              ) : (
                <ul className="space-y-2.5">
                  {completedTasks.map((t, i) => (
                    <li key={`${t.title}-${i}`} className="flex items-start gap-2.5">
                      <CheckCircle2 size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#12B76A]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-text">{t.title}</p>
                        <p className="text-[11px] text-text-faint">
                          {t.projectName ? `${t.projectName} · ` : ""}
                          {formatReadableDate(t.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
      <Suspense fallback={<div className="p-8 text-center text-sm text-text-faint">Loading reports…</div>}>
        <ReportsView />
      </Suspense>
    </AuthGuard>
  );
}
