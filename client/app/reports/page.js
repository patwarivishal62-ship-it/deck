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
  PlusCircle,
  Calendar,
  Layers,
  Target,
  Flag,
  Clock,
  ArrowRight,
  TrendingUp,
  X,
  Sparkles,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card, { CardHeading } from "@/components/app/Card";
import { SegmentedControl, Chip, LightSelect } from "@/components/app/Pills";
import StatusPill, {
  EmptyState,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  ProgressBar,
  StatusPillForStatus,
} from "@/components/app/UI";
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
import { formatDueDate, projectProgress, todayISO } from "@/lib/dashboard";
import { CATEGORIES, PRIORITIES, formatMetricValue } from "@/lib/constants";
import { getProjectStatus } from "@/lib/projectStatus";

function ReportsView() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get("projectId") || searchParams.get("project");
  const paramFrom = searchParams.get("from");
  const paramTo = searchParams.get("to");
  const paramPeriod = searchParams.get("period");

  const [projects, setProjects] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(paramProjectId || "all");
  const [periodValue, setPeriodValue] = useState(paramPeriod || "this_month");

  // Initial custom date values: start of current month to today (or URL params)
  const [customFrom, setCustomFrom] = useState(() => {
    if (paramFrom) return paramFrom;
    const now = new Date();
    return iso(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [customTo, setCustomTo] = useState(() => paramTo || iso(new Date()));

  const [generating, setGenerating] = useState(false);
  const [rowGeneratingId, setRowGeneratingId] = useState(null);
  const [generated, setGenerated] = useState(""); // success note

  useEffect(() => {
    if (paramProjectId) {
      setSelectedProjectId(paramProjectId);
    }
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

  // Resolved period object with start, end, human-friendly label
  const period = useMemo(
    () => resolvePeriod(periodValue, { from: customFrom, to: customTo }),
    [periodValue, customFrom, customTo]
  );

  // Selected project (or null if "all")
  const selectedProject = useMemo(() => {
    if (selectedProjectId === "all" || !projects) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  // Derived portfolio report data
  const portfolioReport = useMemo(
    () => buildReportData(loading ? [] : projects, period, user),
    [projects, period, user, loading]
  );

  // Derived single-project report data (when a project is selected)
  const projectReport = useMemo(() => {
    if (!selectedProject) return null;
    return buildProjectReportData(selectedProject, period, user);
  }, [selectedProject, period, user]);

  // Download handler for primary action button
  async function handleMainDownload() {
    setError("");
    setGenerated("");
    setGenerating(true);
    try {
      if (selectedProject && projectReport) {
        await generateProjectReportPDF(projectReport);
        setGenerated(`Report for "${selectedProject.name}" downloaded — check your downloads folder.`);
      } else {
        await generateReportPDF(portfolioReport);
        setGenerated("Portfolio performance report downloaded — check your downloads folder.");
      }
    } catch (err) {
      setError(err?.message || "Could not generate the PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Download handler for specific project row in the table
  async function handleRowDownload(projectObj, e) {
    if (e) e.stopPropagation();
    setError("");
    setGenerated("");
    setRowGeneratingId(projectObj.id);
    try {
      const singleProjectData = buildProjectReportData(projectObj, period, user);
      await generateProjectReportPDF(singleProjectData);
      setGenerated(`Report for "${projectObj.name}" downloaded — check your downloads folder.`);
    } catch (err) {
      setError(err?.message || `Could not generate report for ${projectObj.name}.`);
    } finally {
      setRowGeneratingId(null);
    }
  }

  // Quick preset shortcuts for custom date range
  const setQuickRange = (daysAgo) => {
    const now = new Date();
    const to = iso(now);
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - (daysAgo - 1));
    const from = iso(fromDate);
    setCustomFrom(from);
    setCustomTo(to);
    setPeriodValue("custom");
  };

  const setMonthRange = (monthOffset = 0) => {
    const now = new Date();
    const targetMonth = now.getMonth() + monthOffset;
    const year = now.getFullYear();
    const first = new Date(year, targetMonth, 1);
    const last = monthOffset === 0 ? now : new Date(year, targetMonth + 1, 0);
    setCustomFrom(iso(first));
    setCustomTo(iso(last));
    setPeriodValue("custom");
  };

  // Calculate day difference for custom date range feedback
  const dateRangeDays = useMemo(() => {
    try {
      const d1 = new Date(period.from);
      const d2 = new Date(period.to);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 1;
    } catch {
      return null;
    }
  }, [period.from, period.to]);

  // Metric stats for the preview row
  const previewStats = selectedProject && projectReport
    ? [
        {
          label: "Project progress",
          value: `${projectReport.progress}%`,
          icon: TrendingUp,
          iconBg: "#F1EDFF",
          iconColor: "#7C5CFF",
        },
        {
          label: "Tasks completed",
          value: projectReport.summary.tasksCompletedInPeriod,
          icon: CheckCircle2,
          iconBg: "#E7F6EF",
          iconColor: "#12B76A",
        },
        {
          label: "Tasks created",
          value: projectReport.summary.tasksCreatedInPeriod,
          icon: PlusCircle,
          iconBg: "#FEF4E4",
          iconColor: "#E8A23D",
        },
        {
          label: "Overdue tasks",
          value: projectReport.summary.overdueNow,
          icon: AlertTriangle,
          iconBg: projectReport.summary.overdueNow > 0 ? "#FDEEEF" : "#E7F6EF",
          iconColor: projectReport.summary.overdueNow > 0 ? "#DC3D43" : "#12B76A",
        },
      ]
    : [
        {
          label: "Active projects",
          value: portfolioReport.summary.activeProjects,
          icon: FolderKanban,
          iconBg: "#F1EDFF",
          iconColor: "#7C5CFF",
        },
        {
          label: "Tasks completed",
          value: portfolioReport.summary.tasksCompleted,
          icon: CheckCircle2,
          iconBg: "#E7F6EF",
          iconColor: "#12B76A",
        },
        {
          label: "Tasks created",
          value: portfolioReport.summary.tasksCreated,
          icon: PlusCircle,
          iconBg: "#FEF4E4",
          iconColor: "#E8A23D",
        },
        {
          label: "Overdue now",
          value: portfolioReport.summary.overdueNow,
          icon: AlertTriangle,
          iconBg: portfolioReport.summary.overdueNow > 0 ? "#FDEEEF" : "#E7F6EF",
          iconColor: portfolioReport.summary.overdueNow > 0 ? "#DC3D43" : "#12B76A",
        },
      ];

  const hasNoData =
    !loading &&
    projects &&
    projects.length === 0;

  return (
    <AppShell>
      <PageHeading
        title="Reports"
        subtitle="Generate and download project-wise or portfolio performance reports as PDFs — customize date ranges, inspect numbers, and export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedProject && (
              <SecondaryButton
                onClick={() => setSelectedProjectId("all")}
                className="text-xs"
              >
                <Layers size={14} strokeWidth={2} />
                View portfolio
              </SecondaryButton>
            )}
            <PrimaryButton onClick={handleMainDownload} disabled={generating || loading || hasNoData}>
              {generating ? (
                <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
              ) : (
                <Download size={15} strokeWidth={2.2} />
              )}
              {generating
                ? "Generating PDF…"
                : selectedProject
                ? `Download ${selectedProject.name} PDF`
                : "Download portfolio PDF"}
            </PrimaryButton>
          </div>
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {generated && (
        <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-good-line bg-good-tint px-4 py-3 text-sm text-good-text animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={16} strokeWidth={2} className="shrink-0 text-[#12B76A]" />
            <span className="truncate">{generated}</span>
          </div>
          <button
            type="button"
            onClick={() => setGenerated("")}
            className="text-good-text/70 hover:text-good-text p-1"
            aria-label="Dismiss message"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* Control Panel: Project Filter & Reporting Period */}
      <Card className="mt-1 overflow-hidden">
        <CardHeading
          title="Report configuration"
          sub="Filter by individual project and customize the date range"
          right={
            <div className="flex items-center gap-2">
              {selectedProjectId !== "all" ? (
                <Chip tone="accent">Single project report</Chip>
              ) : (
                <Chip tone="muted">Portfolio report ({portfolioReport.summary.activeProjects} active)</Chip>
              )}
            </div>
          }
        />

        <div className="divide-y divide-line">
          {/* Project selector row */}
          <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between bg-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <FolderKanban size={16} strokeWidth={2} className="text-[#7C5CFF]" />
              <span>Project scope:</span>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 max-w-xl">
              <LightSelect
                ariaLabel="Select project for report"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full sm:w-80 font-medium"
              >
                <option value="all">🏢 All projects (Portfolio summary)</option>
                {projects && projects.length > 0 && (
                  <optgroup label="Active Projects">
                    {projects
                      .filter((p) => !p.archived)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          📁 {p.name} ({projectProgress(p)}% · {(p.tasks || []).length} tasks)
                        </option>
                      ))}
                  </optgroup>
                )}
                {projects && projects.some((p) => p.archived) && (
                  <optgroup label="Archived Projects">
                    {projects
                      .filter((p) => p.archived)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          📦 [Archived] {p.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </LightSelect>

              {selectedProjectId !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedProjectId("all")}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#7C5CFF] hover:bg-[#F1EDFF] transition"
                  title="Reset to all projects"
                >
                  <X size={13} strokeWidth={2.4} />
                  Reset to all
                </button>
              )}
            </div>
          </div>

          {/* Period selector row */}
          <div className="flex flex-col gap-3 px-5 py-4 bg-paper/30">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <Calendar size={16} strokeWidth={2} className="text-[#4F7BFF]" />
                <span>Reporting period:</span>
              </div>
              <SegmentedControl
                ariaLabel="Report period"
                value={periodValue}
                onChange={setPeriodValue}
                options={REPORT_PERIODS}
              />
            </div>

            {/* Custom Date Range Picker */}
            {periodValue === "custom" && (
              <div className="mt-2 rounded-xl border border-line bg-card p-4 shadow-sm animate-in fade-in">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label htmlFor="report-from-date" className="text-xs font-bold text-text-soft uppercase tracking-wider">
                        From:
                      </label>
                      <input
                        id="report-from-date"
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        aria-label="From date"
                        className="h-9 rounded-xl border border-line bg-paper px-3 text-[13px] font-medium text-text outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20"
                      />
                    </div>
                    <span className="text-xs font-bold text-text-faint">to</span>
                    <div className="flex items-center gap-2">
                      <label htmlFor="report-to-date" className="text-xs font-bold text-text-soft uppercase tracking-wider">
                        To:
                      </label>
                      <input
                        id="report-to-date"
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        aria-label="To date"
                        className="h-9 rounded-xl border border-line bg-paper px-3 text-[13px] font-medium text-text outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-medium text-text-faint mr-1">Quick:</span>
                    <button
                      type="button"
                      onClick={() => setQuickRange(7)}
                      className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-text hover:bg-paper-2 hover:border-[#7C5CFF]/40 transition"
                    >
                      7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickRange(14)}
                      className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-text hover:bg-paper-2 hover:border-[#7C5CFF]/40 transition"
                    >
                      14 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickRange(30)}
                      className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-text hover:bg-paper-2 hover:border-[#7C5CFF]/40 transition"
                    >
                      30 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthRange(0)}
                      className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-text hover:bg-paper-2 hover:border-[#7C5CFF]/40 transition"
                    >
                      This month
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthRange(-1)}
                      className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-text hover:bg-paper-2 hover:border-[#7C5CFF]/40 transition"
                    >
                      Last month
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2.5 text-xs text-text-soft">
                  <span className="font-semibold text-text">Active date range:</span>
                  <span className="font-mono text-xs bg-paper px-2 py-0.5 rounded border border-line text-text">
                    {period.from} → {period.to}
                  </span>
                  {dateRangeDays && (
                    <span className="text-text-faint">({dateRangeDays} day{dateRangeDays !== 1 ? "s" : ""})</span>
                  )}
                </div>
              </div>
            )}

            {/* Subtitle with date span info if not custom */}
            {periodValue !== "custom" && (
              <div className="flex items-center justify-between text-xs text-text-faint">
                <span className="font-medium">
                  Date range covered: <span className="text-text font-semibold">{period.from}</span> to{" "}
                  <span className="text-text font-semibold">{period.to}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPeriodValue("custom")}
                  className="font-medium text-[#7C5CFF] hover:underline"
                >
                  Custom date range →
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Selected Project Overview Header (When a single project is selected) */}
      {selectedProject && projectReport && (
        <Card className="mt-4 border-[#7C5CFF]/20 bg-gradient-to-r from-card to-signal-tint/10">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#7C5CFF]">Project Report</span>
                  <StatusPillForStatus status={projectReport.status} />
                  {selectedProject.priority && (
                    <Chip
                      tone={
                        selectedProject.priority === "high"
                          ? "danger"
                          : selectedProject.priority === "medium"
                          ? "warning"
                          : "muted"
                      }
                    >
                      {PRIORITIES[selectedProject.priority]?.label || selectedProject.priority} priority
                    </Chip>
                  )}
                  {selectedProject.dueDate && (
                    <span className="inline-flex items-center gap-1 text-xs text-text-soft font-medium">
                      <Clock size={12} strokeWidth={2} />
                      Due {formatDueDate(selectedProject.dueDate)}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text">
                  {selectedProject.name}
                </h2>
                {selectedProject.description && (
                  <p className="max-w-2xl text-xs sm:text-sm text-text-soft leading-relaxed">
                    {selectedProject.description}
                  </p>
                )}
                {selectedProject.tags && selectedProject.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {selectedProject.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-paper px-2 py-0.5 text-[11px] font-medium text-text-soft border border-line"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress & Quick Download Box */}
              <div className="flex shrink-0 flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm min-w-[220px]">
                <div className="w-full">
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <span className="text-xs font-semibold text-text-soft">Overall Progress</span>
                    <span className="font-display text-lg font-bold text-text">{projectReport.progress}%</span>
                  </div>
                  <ProgressBar value={projectReport.progress} label={`${selectedProject.name} progress`} />
                  <p className="mt-1.5 text-[11px] text-text-faint text-right">
                    {projectReport.summary.tasksDone} of {projectReport.summary.tasksTotal} tasks done
                  </p>
                </div>
                <PrimaryButton
                  onClick={handleMainDownload}
                  disabled={generating}
                  className="w-full text-xs py-2 mt-1"
                >
                  {generating ? (
                    <Loader2 size={14} strokeWidth={2.2} className="animate-spin" />
                  ) : (
                    <Download size={14} strokeWidth={2.2} />
                  )}
                  {generating ? "Exporting…" : "Download this report"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Stats Cards */}
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
      ) : hasNoData ? (
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
      ) : selectedProject && projectReport ? (
        /* SINGLE PROJECT DETAILED REPORT VIEW */
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* Goals & Key Targets */}
            <Card>
              <CardHeading
                title="Goals & key targets"
                sub={`Channel goals and targets for ${selectedProject.name}`}
                right={
                  <Chip tone={projectReport.summary.goalsCompleted > 0 ? "positive" : "muted"}>
                    {projectReport.summary.goalsCompleted}/{projectReport.summary.goalsTotal} completed
                  </Chip>
                }
              />
              <div className="p-5">
                {projectReport.goals.length === 0 ? (
                  <p className="text-sm text-text-faint">No channel goals created for this project yet.</p>
                ) : (
                  <div className="space-y-3.5">
                    {projectReport.goals.map((g, i) => {
                      const cat = CATEGORIES[g.category] || CATEGORIES.other;
                      return (
                        <div
                          key={`${g.label}-${i}`}
                          className="rounded-xl border border-line bg-paper/40 p-3.5 transition hover:border-[#7C5CFF]/30"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="font-semibold text-[13.5px] text-text">{g.label}</span>
                              <span className="text-xs font-medium text-text-faint">
                                · {g.platform ? `${cat.label} (${g.platform})` : cat.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-display text-xs font-bold text-text">
                              <span>
                                {formatMetricValue(g.current, g.unit)} / {formatMetricValue(g.target, g.unit)}
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  g.isCompleted ? "bg-good-tint text-good-text" : "bg-paper-2 text-text-soft"
                                }`}
                              >
                                {g.progressPct}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-2.5">
                            <ProgressBar value={g.progressPct} label={g.label} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Milestones if any */}
            {projectReport.milestones.length > 0 && (
              <Card>
                <CardHeading
                  title="Milestones"
                  sub="Key delivery dates and check-ins"
                  right={<Chip tone="muted">{projectReport.milestones.length} milestones</Chip>}
                />
                <div className="divide-y divide-line">
                  {projectReport.milestones.map((m, i) => (
                    <div key={`${m.title}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Flag
                          size={15}
                          strokeWidth={2}
                          className={m.isPast ? "text-good-text" : "text-[#7C5CFF]"}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-text">{m.title}</p>
                          {m.notes && <p className="truncate text-xs text-text-faint">{m.notes}</p>}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-text-soft">
                        {m.date ? formatReadableDate(m.date) : "No date"}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Open / Remaining Tasks */}
            <Card>
              <CardHeading
                title="Active & upcoming tasks"
                sub="Tasks remaining to complete this project"
                right={<Chip tone="muted">{projectReport.openTasks.length} open</Chip>}
              />
              <div className="divide-y divide-line max-h-[360px] overflow-y-auto">
                {projectReport.openTasks.length === 0 ? (
                  <div className="p-5 text-center text-sm text-text-faint">
                    🎉 All tasks in this project are completed!
                  </div>
                ) : (
                  projectReport.openTasks.map((task, i) => {
                    const isOverdue = task.dueDate && task.dueDate < todayISO();
                    return (
                      <div
                        key={`${task.title}-${i}`}
                        className="flex items-center justify-between gap-3 px-5 py-3.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              task.status === "in_progress"
                                ? "bg-[#7C5CFF]"
                                : "bg-[#8A94A8]"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-text">{task.title}</p>
                            <span className="text-[11px] text-text-faint">
                              Status: {task.status === "in_progress" ? "In progress" : "To do"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.priority && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                task.priority === "high"
                                  ? "bg-error-tint text-error-text"
                                  : "bg-paper-2 text-text-soft"
                              }`}
                            >
                              {task.priority}
                            </span>
                          )}
                          <span
                            className={`text-xs font-medium ${
                              isOverdue ? "text-error-text font-semibold" : "text-text-soft"
                            }`}
                          >
                            {task.dueDate ? formatDueDate(task.dueDate) : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Completed Tasks & Download Card */}
          <div className="space-y-4">
            {/* Completed in selected period */}
            <Card>
              <CardHeading
                title="Completed in period"
                sub={`${period.from} → ${period.to}`}
                right={<Chip tone="positive">{projectReport.completedTasks.length}</Chip>}
              />
              <div className="max-h-[380px] overflow-y-auto px-5 py-4">
                {projectReport.completedTasks.length === 0 ? (
                  <p className="text-sm text-text-faint">
                    No tasks were completed in {selectedProject.name} during this period.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {projectReport.completedTasks.map((t, i) => (
                      <li key={`${t.title}-${i}`} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#12B76A]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-text">{t.title}</p>
                          <p className="text-[11px] text-text-faint">
                            Completed on {formatReadableDate(t.date)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            {/* Download Project PDF action box */}
            <Card className="bg-gradient-to-b from-card to-paper/50">
              <div className="p-5">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-text">
                  <Sparkles size={16} strokeWidth={2} className="text-[#7C5CFF]" />
                  <span>Ready to share or archive?</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-soft">
                  The PDF includes project metadata, status, progress breakdown, channel goals, milestones,
                  completed tasks, and remaining items formatted for client presentations and team reviews.
                </p>

                <PrimaryButton
                  onClick={handleMainDownload}
                  disabled={generating}
                  className="mt-4 w-full"
                >
                  {generating ? (
                    <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
                  ) : (
                    <Download size={15} strokeWidth={2.2} />
                  )}
                  {generating ? "Generating PDF…" : `Download ${selectedProject.name} report`}
                </PrimaryButton>

                <SecondaryButton
                  onClick={() => setSelectedProjectId("all")}
                  className="mt-2.5 w-full text-xs"
                >
                  <Layers size={13} strokeWidth={2} />
                  Switch to full portfolio report
                </SecondaryButton>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* PORTFOLIO ALL PROJECTS VIEW */
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          {/* Projects Table */}
          <Card className="overflow-hidden">
            <CardHeading
              title="Projects in this report"
              sub="Active projects — click any row to inspect, or download individual project reports"
              right={
                <Chip tone="accent">
                  {portfolioReport.projectRows.length} project{portfolioReport.projectRows.length !== 1 ? "s" : ""}
                </Chip>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-text-faint bg-paper/30">
                    <th scope="col" className="px-5 py-3 font-semibold">Project</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Progress</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">Tasks</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">In period</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Due</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioReport.projectRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-line last:border-b-0 hover:bg-paper/40 transition group"
                    >
                      <td className="max-w-[200px] truncate px-5 py-3 font-semibold text-text">
                        <button
                          type="button"
                          onClick={() => setSelectedProjectId(row.id)}
                          className="hover:text-[#7C5CFF] text-left font-semibold truncate max-w-full inline-flex items-center gap-1.5"
                          title={`View ${row.name} report`}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPillForStatus status={row.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex w-28 items-center gap-2">
                          <ProgressBar value={row.progress} label={`${row.name} progress`} />
                          <span className="w-8 shrink-0 text-xs font-bold text-text">{row.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-[13px] font-medium text-text">
                        {row.tasksDone}/{row.tasksTotal}
                      </td>
                      <td className="px-3 py-3 text-center text-[13px] font-semibold text-[#12B76A]">
                        {row.completions > 0 ? `+${row.completions}` : "0"}
                      </td>
                      <td className="px-3 py-3 text-[13px] font-medium text-text-soft">
                        {row.dueDate ? formatDueDate(row.dueDate) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleRowDownload(row.rawProject, e)}
                            disabled={rowGeneratingId === row.id}
                            title={`Download PDF report for ${row.name}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-semibold text-text hover:bg-paper hover:border-[#7C5CFF]/40 transition disabled:opacity-50"
                          >
                            {rowGeneratingId === row.id ? (
                              <Loader2 size={12} strokeWidth={2.4} className="animate-spin text-[#7C5CFF]" />
                            ) : (
                              <Download size={12} strokeWidth={2.2} className="text-[#7C5CFF]" />
                            )}
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedProjectId(row.id)}
                            title={`View ${row.name} details`}
                            className="inline-flex items-center rounded-lg p-1 text-text-faint hover:text-[#7C5CFF] hover:bg-paper transition"
                          >
                            <ArrowRight size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {portfolioReport.projectRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-sm text-text-faint">
                        No active projects right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Right Column: Completed Tasks & Download Card */}
          <div className="space-y-4">
            {/* Completed Tasks in Period */}
            <Card>
              <CardHeading
                title="Completed in period"
                right={<Chip tone="positive">{portfolioReport.completedTasks.length}</Chip>}
              />
              <div className="max-h-[380px] overflow-y-auto px-5 py-4">
                {portfolioReport.completedTasks.length === 0 ? (
                  <p className="text-sm text-text-faint">No tasks were completed in this period.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {portfolioReport.completedTasks.map((t, i) => (
                      <li key={`${t.title}-${i}`} className="flex items-start gap-2.5">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#12B76A]" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-text">{t.title}</p>
                          <p className="text-[11px] text-text-faint">
                            <span className="font-semibold text-text-soft">{t.projectName}</span> · {formatReadableDate(t.date)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            {/* Portfolio Download Card */}
            <Card className="bg-gradient-to-b from-card to-paper/50">
              <div className="p-5">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-text">
                  <Sparkles size={16} strokeWidth={2} className="text-[#7C5CFF]" />
                  <span>Download full summary</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-soft">
                  The portfolio PDF includes key-number tiles, project status breakdowns, per-project progress
                  bars, and the complete task log for {period.label.toLowerCase()}.
                </p>
                <PrimaryButton
                  onClick={handleMainDownload}
                  disabled={generating || hasNoData}
                  className="mt-4 w-full"
                >
                  {generating ? (
                    <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
                  ) : (
                    <Download size={15} strokeWidth={2.2} />
                  )}
                  {generating ? "Generating…" : `Download portfolio report`}
                </PrimaryButton>
              </div>
            </Card>
          </div>
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
