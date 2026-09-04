// Report building blocks: period presets, report data derived from real
// project data, and client-side PDF renderers (jsPDF, loaded on demand).

import { computeAnalytics } from "./analytics.js";
import { getProjectStatus } from "./projectStatus.js";
import { projectProgress, todayISO } from "./dashboard.js";
import { CATEGORIES, PRIORITIES, formatMetricValue } from "./constants.js";

export const REPORT_PERIODS = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom range" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export function iso(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function addDays(d, days) {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

export function sanitizeFileName(str) {
  if (!str) return "Report";
  return String(str)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

export function formatReadableDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// { from, to } as YYYY-MM-DD strings (inclusive) + a human label.
export function resolvePeriod(value, custom = { from: "", to: "" }) {
  const now = new Date();
  const today = iso(now);
  const matched = REPORT_PERIODS.find((p) => p.value === value);
  const baseLabel = matched?.label || "Report";

  if (value === "custom") {
    let from = custom.from;
    let to = custom.to;

    // Fallbacks if one or both custom dates are empty
    if (!from && !to) {
      from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
      to = today;
    } else if (!from) {
      from = iso(addDays(new Date(to), -29));
    } else if (!to) {
      to = today;
    }

    // Ensure from <= to
    if (from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }

    const readableFrom = formatReadableDate(from);
    const readableTo = formatReadableDate(to);
    return {
      from,
      to,
      label: `${readableFrom} – ${readableTo}`,
      displayRange: `${from} → ${to}`,
      value,
    };
  }

  let from;
  let to = today;
  switch (value) {
    case "this_week": {
      from = iso(startOfWeek(now));
      break;
    }
    case "last_week": {
      const thisMonday = startOfWeek(now);
      from = iso(addDays(thisMonday, -7));
      to = iso(addDays(thisMonday, -1));
      break;
    }
    case "this_month": {
      from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
      break;
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      from = iso(first);
      to = iso(last);
      break;
    }
    case "last_30": {
      from = iso(addDays(now, -29));
      break;
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = iso(new Date(now.getFullYear(), q * 3, 1));
      break;
    }
    case "this_year": {
      from = iso(new Date(now.getFullYear(), 0, 1));
      break;
    }
    case "all_time":
    default: {
      from = "2000-01-01";
      to = today;
      break;
    }
  }
  return {
    from,
    to,
    label: baseLabel,
    displayRange: `${from} → ${to}`,
    value,
  };
}

export const inRange = (dayStr, from, to) => Boolean(dayStr) && dayStr >= from && dayStr <= to;

// Portfolio-wide report data across all projects
export function buildReportData(projects, period, user) {
  const list = projects || [];
  const active = list.filter((p) => !p.archived);
  const analytics = computeAnalytics(active);

  const completedTasks = [];
  let tasksCreated = 0;
  let projectsCreated = 0;
  const completionsByProject = {};
  const creationsByProject = {};

  for (const project of list) {
    if (inRange((project.createdAt || "").slice(0, 10), period.from, period.to)) {
      projectsCreated += 1;
    }
    for (const task of project.tasks || []) {
      const doneDay = (task.completedAt || "").slice(0, 10);
      if (inRange(doneDay, period.from, period.to)) {
        completedTasks.push({
          id: task.id,
          title: task.title,
          projectName: project.name,
          projectId: project.id,
          priority: task.priority || "medium",
          date: doneDay,
        });
        completionsByProject[project.id] = (completionsByProject[project.id] || 0) + 1;
      }
      const createdDay = (task.createdAt || "").slice(0, 10);
      if (inRange(createdDay, period.from, period.to)) {
        tasksCreated += 1;
        creationsByProject[project.id] = (creationsByProject[project.id] || 0) + 1;
      }
    }
  }
  completedTasks.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

  const projectRows = active
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      tags: p.tags || [],
      priority: p.priority || "medium",
      status: getProjectStatus(p),
      progress: projectProgress(p),
      tasksDone: (p.tasks || []).filter((t) => t.status === "done").length,
      tasksTotal: (p.tasks || []).length,
      goals: (p.goals || []).length,
      milestones: (p.milestones || []).length,
      overdue: (p.tasks || []).filter(
        (t) => t.status !== "done" && t.dueDate && t.dueDate < todayISO()
      ).length,
      dueDate: p.dueDate || null,
      completions: completionsByProject[p.id] || 0,
      tasksCreated: creationsByProject[p.id] || 0,
      rawProject: p,
    }))
    .sort((a, b) => b.progress - a.progress);

  return {
    period,
    generatedAt: new Date(),
    userName: user?.name || user?.email || "",
    summary: {
      activeProjects: active.length,
      totalProjects: list.length,
      projectsCreated,
      tasksCompleted: completedTasks.length,
      tasksCreated,
      overdueNow: analytics.tasksOverdue,
      avgCompletion: analytics.avgCompletion,
      completedProjects: analytics.byStatus.completed,
      inProgressProjects: analytics.byStatus.in_progress,
      pendingProjects: analytics.byStatus.pending,
    },
    projectRows,
    completedTasks,
  };
}

// Dedicated single-project report data
export function buildProjectReportData(project, period, user) {
  if (!project) return null;

  const tasks = project.tasks || [];
  const goals = (project.goals || []).map((g) => {
    const target = Number(g.targetValue) || 0;
    const current = Number(g.currentValue) || 0;
    const progressPct = target > 0 ? Math.min(100, Math.max(0, Math.round((current / target) * 100))) : 0;
    const isCompleted = current >= target && target > 0;
    return {
      ...g,
      target,
      current,
      progressPct,
      isCompleted,
    };
  });

  const milestones = (project.milestones || []).map((m) => {
    const isPast = Boolean(m.date && m.date < todayISO());
    return {
      ...m,
      isPast,
    };
  });

  const completedTasks = [];
  let tasksCreatedCount = 0;
  const overdueTasks = [];
  const openTasks = [];

  for (const task of tasks) {
    const doneDay = (task.completedAt || "").slice(0, 10);
    const isDoneInRange = inRange(doneDay, period.from, period.to);
    if (isDoneInRange) {
      completedTasks.push({
        id: task.id,
        title: task.title,
        priority: task.priority || "medium",
        date: doneDay,
        completedAt: task.completedAt,
      });
    }

    const createdDay = (task.createdAt || "").slice(0, 10);
    if (inRange(createdDay, period.from, period.to)) {
      tasksCreatedCount += 1;
    }

    if (task.status !== "done") {
      openTasks.push(task);
      if (task.dueDate && task.dueDate < todayISO()) {
        overdueTasks.push(task);
      }
    }
  }

  completedTasks.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
  openTasks.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const status = getProjectStatus(project);
  const progress = projectProgress(project);
  const tasksDone = tasks.filter((t) => t.status === "done").length;

  const goalsCompletedCount = goals.filter((g) => g.isCompleted).length;
  const avgGoalProgress =
    goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progressPct, 0) / goals.length) : 0;

  return {
    project,
    period,
    generatedAt: new Date(),
    userName: user?.name || user?.email || "",
    status,
    progress,
    summary: {
      progress,
      tasksTotal: tasks.length,
      tasksDone,
      tasksCompletedInPeriod: completedTasks.length,
      tasksCreatedInPeriod: tasksCreatedCount,
      overdueNow: overdueTasks.length,
      openTasksCount: openTasks.length,
      goalsTotal: goals.length,
      goalsCompleted: goalsCompletedCount,
      avgGoalProgress,
      milestonesTotal: milestones.length,
    },
    goals,
    milestones,
    completedTasks,
    openTasks,
    overdueTasks,
    allTasks: tasks,
  };
}

export function reportFileName(period, project = null) {
  const periodSlug = period.value === "custom" ? `${period.from}_to_${period.to}` : period.value;
  if (project) {
    const slug = sanitizeFileName(project.name || "Project");
    return `DECK-Report-${slug}-${periodSlug}-${todayISO()}.pdf`;
  }
  return `DECK-Report-Portfolio-${periodSlug}-${todayISO()}.pdf`;
}

const PURPLE = [124, 92, 255];
const BLUE = [79, 123, 255];
const INK = [15, 23, 42];
const SOFT = [91, 107, 127];
const FAINT = [138, 148, 166];
const LINE = [233, 237, 243];
const GOOD = [14, 159, 110];
const WARN = [232, 162, 61];
const DANGER = [220, 61, 67];
const CARD_BG = [248, 250, 253];

const nf = new Intl.NumberFormat("en-IN");

// Renders the Portfolio report to PDF with jsPDF
export async function generateReportPDF(data, { save } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44; // page margin

  let y = 0;
  let page = 1;

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...FAINT);
    doc.text("DECK — planyourdeck.com", M, H - 24);
    doc.text(`Page ${page}`, W - M, H - 24, { align: "right" });
  };

  const addPage = () => {
    footer();
    doc.addPage();
    page += 1;
    y = M + 8;
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 4, "F");
  };

  const ensure = (needed) => {
    if (y + needed > H - 48) addPage();
  };

  const sectionTitle = (title, sub) => {
    ensure(56);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(title, M, y);
    y += 15;
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...FAINT);
      doc.text(sub, M, y);
      y += 14;
    } else {
      y += 6;
    }
  };

  // ---- Cover header ----
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 108, "F");
  doc.setFillColor(...PURPLE);
  doc.rect(0, 108, W, 5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("DECK", M, 52);
  doc.setFontSize(12.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(184, 192, 204);
  doc.text("Marketing Performance Report", M, 72);
  doc.setFontSize(10);
  doc.setTextColor(148, 158, 178);
  doc.text(data.period.label, W - M, 52, { align: "right" });
  doc.text(
    `Generated ${data.generatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
    W - M,
    70,
    { align: "right" }
  );
  if (data.userName) {
    doc.text(`Prepared for ${data.userName}`, W - M, 86, { align: "right" });
  }
  y = 140;

  // ---- Key numbers ----
  sectionTitle("Key numbers", `${data.period.from} to ${data.period.to}`);

  const stats = [
    { label: "Active projects", value: nf.format(data.summary.activeProjects) },
    { label: "Projects completed", value: nf.format(data.summary.completedProjects) },
    { label: "Avg. completion", value: `${data.summary.avgCompletion}%` },
    { label: "Overdue tasks (now)", value: nf.format(data.summary.overdueNow) },
    { label: "Tasks completed", value: nf.format(data.summary.tasksCompleted) },
    { label: "Tasks created", value: nf.format(data.summary.tasksCreated) },
    { label: "New projects", value: nf.format(data.summary.projectsCreated) },
    { label: "In progress", value: nf.format(data.summary.inProgressProjects) },
  ];

  const boxW = (W - M * 2 - 3 * 10) / 4;
  const boxH = 58;
  stats.forEach((s, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = M + col * (boxW + 10);
    const by = y + row * (boxH + 10);
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, by, boxW, boxH, 8, 8, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text(s.label.toUpperCase(), x + 12, by + 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(s.value, x + 12, by + 43);
  });
  y += 2 * (boxH + 10) + 10;

  // ---- Project table ----
  sectionTitle("Project performance", "Sorted by progress (active projects)");

  const colX = { name: M + 8, status: M + 240, progress: M + 318, tasks: M + 400, goals: M + 442, due: M + 486 };
  const drawTableHeader = () => {
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...LINE);
    doc.roundedRect(M, y, W - M * 2, 24, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...FAINT);
    doc.text("PROJECT", colX.name, y + 15.5);
    doc.text("STATUS", colX.status, y + 15.5);
    doc.text("PROGRESS", colX.progress, y + 15.5);
    doc.text("TASKS", colX.tasks, y + 15.5, { align: "center" });
    doc.text("GOALS", colX.goals, y + 15.5, { align: "center" });
    doc.text("DUE", colX.due, y + 15.5, { align: "right" });
    y += 24;
  };
  drawTableHeader();

  if (data.projectRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...FAINT);
    doc.text("No active projects.", M + 8, y + 16);
    y += 28;
  }

  data.projectRows.forEach((row) => {
    ensure(34);
    const statusLabel =
      row.status === "completed" ? "Completed" : row.status === "in_progress" ? "In progress" : "Pending";
    const statusColor = row.status === "completed" ? GOOD : row.status === "in_progress" ? PURPLE : FAINT;

    doc.setDrawColor(...LINE);
    doc.line(M, y, W - M, y);
    y += 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const nameLines = doc.splitTextToSize(row.name, 215);
    doc.text(nameLines[0] || "—", colX.name, y);
    if (nameLines.length > 1) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...SOFT);
      doc.setFontSize(8.5);
      doc.text(nameLines.slice(1).join(" "), colX.name, y + 10);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...statusColor);
    doc.text(statusLabel, colX.status, y);

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(`${row.progress}%`, colX.progress, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SOFT);
    doc.text(`${row.tasksDone}/${row.tasksTotal}`, colX.tasks, y, { align: "center" });
    doc.text(String(row.goals), colX.goals, y, { align: "center" });
    doc.setTextColor(...(row.overdue > 0 ? DANGER : SOFT));
    doc.text(row.dueDate ? row.dueDate : "—", colX.due, y, { align: "right" });

    // progress bar
    const barY = y + 5;
    const barW = 62;
    doc.setFillColor(238, 241, 246);
    doc.roundedRect(colX.progress, barY, barW, 3.5, 2, 2, "F");
    doc.setFillColor(...PURPLE);
    doc.roundedRect(colX.progress, barY, Math.max(2, (barW * row.progress) / 100), 3.5, 2, 2, "F");

    y += nameLines.length > 1 ? 24 : 12;
  });
  y += 12;

  // ---- Completed tasks ----
  sectionTitle(
    "Tasks completed in period",
    `${data.completedTasks.length} task${data.completedTasks.length !== 1 ? "s" : ""} · newest first`
  );

  if (data.completedTasks.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...FAINT);
    doc.text("No tasks were completed in this period.", M, y + 4);
    y += 20;
  }

  data.completedTasks.forEach((task) => {
    ensure(20);
    doc.setFillColor(...GOOD);
    doc.circle(M + 5, y - 3, 2.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(task.title, 320)[0], M + 14, y);
    doc.setTextColor(...FAINT);
    doc.text(doc.splitTextToSize(task.projectName, 150)[0], M + 344, y);
    doc.text(task.date, W - M, y, { align: "right" });
    y += 15;
  });

  footer();

  const fileName = reportFileName(data.period);
  if (save) {
    await save(new Uint8Array(doc.output("arraybuffer")), fileName);
    return;
  }

  // Browser: object-URL anchor download.
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Renders a dedicated single-project report to PDF with jsPDF
export async function generateProjectReportPDF(data, { save } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44; // page margin

  let y = 0;
  let page = 1;

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...FAINT);
    doc.text("DECK — planyourdeck.com", M, H - 24);
    doc.text(`Page ${page}`, W - M, H - 24, { align: "right" });
  };

  const addPage = () => {
    footer();
    doc.addPage();
    page += 1;
    y = M + 8;
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 4, "F");
  };

  const ensure = (needed) => {
    if (y + needed > H - 48) addPage();
  };

  const sectionTitle = (title, sub) => {
    ensure(52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(title, M, y);
    y += 14;
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...FAINT);
      doc.text(sub, M, y);
      y += 13;
    } else {
      y += 5;
    }
  };

  // ---- Cover header ----
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 114, "F");
  doc.setFillColor(...PURPLE);
  doc.rect(0, 114, W, 5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("DECK", M, 48);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(184, 192, 204);
  doc.text("Project Performance Report", M, 66);

  // Project title in header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  const truncatedProjectName = doc.splitTextToSize(data.project.name || "Project", 300)[0];
  doc.text(truncatedProjectName, M, 94);

  // Right side header metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(184, 192, 204);
  doc.text(data.period.label, W - M, 48, { align: "right" });
  doc.text(
    `Generated ${data.generatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
    W - M,
    66,
    { align: "right" }
  );
  if (data.userName) {
    doc.text(`Prepared for ${data.userName}`, W - M, 82, { align: "right" });
  }
  y = 142;

  // ---- Project Overview Banner Box ----
  const overviewBoxH = data.project.description ? 70 : 54;
  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...LINE);
  doc.roundedRect(M, y, W - M * 2, overviewBoxH, 8, 8, "FD");

  // Status & Priority
  const statusLabel =
    data.status === "completed" ? "Completed" : data.status === "in_progress" ? "In progress" : "Pending";
  const statusColor = data.status === "completed" ? GOOD : data.status === "in_progress" ? PURPLE : FAINT;
  const priority = PRIORITIES[data.project.priority] || PRIORITIES.medium;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...statusColor);
  doc.text(`● ${statusLabel.toUpperCase()}`, M + 14, y + 18);

  doc.setTextColor(...SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Priority: ${priority.label}`, M + 110, y + 18);

  if (data.project.dueDate) {
    doc.text(`Due: ${formatReadableDate(data.project.dueDate)}`, M + 210, y + 18);
  }

  // Progress on right side of overview
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(`${data.progress}%`, W - M - 14, y + 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text("PROGRESS", W - M - 52, y + 19, { align: "right" });

  // Mini progress bar in overview
  const barW = 100;
  const barX = W - M - 14 - barW;
  const barY = y + 26;
  doc.setFillColor(230, 235, 242);
  doc.roundedRect(barX, barY, barW, 4, 2, 2, "F");
  doc.setFillColor(...PURPLE);
  doc.roundedRect(barX, barY, Math.max(2, (barW * data.progress) / 100), 4, 2, 2, "F");

  // Description / Tags if present
  if (data.project.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    const descLines = doc.splitTextToSize(data.project.description, W - M * 2 - 28);
    doc.text(descLines[0], M + 14, y + 42);
  }

  if (data.project.tags && data.project.tags.length > 0) {
    const tagText = `Tags: ${data.project.tags.join(", ")}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text(tagText, M + 14, y + (data.project.description ? 58 : 38));
  }

  y += overviewBoxH + 16;

  // ---- Key Numbers Tiles ----
  sectionTitle("Key metrics in reporting period", `${data.period.from} to ${data.period.to}`);

  const pStats = [
    { label: "Overall progress", value: `${data.progress}%` },
    { label: "Tasks completed in period", value: String(data.summary.tasksCompletedInPeriod) },
    { label: "Tasks created in period", value: String(data.summary.tasksCreatedInPeriod) },
    {
      label: "Total tasks done",
      value: `${data.summary.tasksDone} / ${data.summary.tasksTotal}`,
    },
  ];

  const boxW = (W - M * 2 - 3 * 10) / 4;
  const boxH = 56;
  pStats.forEach((s, i) => {
    const col = i % 4;
    const x = M + col * (boxW + 10);
    const by = y;
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, by, boxW, boxH, 8, 8, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT);
    doc.text(s.label.toUpperCase(), x + 10, by + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK);
    doc.text(s.value, x + 10, by + 41);
  });
  y += boxH + 18;

  // ---- Goals & Targets (if any) ----
  if (data.goals && data.goals.length > 0) {
    sectionTitle(
      "Goals & key targets",
      `${data.summary.goalsCompleted} of ${data.summary.goalsTotal} completed · Avg. progress ${data.summary.avgGoalProgress}%`
    );

    const goalColX = { label: M + 8, cat: M + 240, progress: M + 340, target: M + 430 };
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...LINE);
    doc.roundedRect(M, y, W - M * 2, 22, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text("GOAL / TARGET", goalColX.label, y + 14.5);
    doc.text("CATEGORY / CHANNEL", goalColX.cat, y + 14.5);
    doc.text("PROGRESS", goalColX.progress, y + 14.5);
    doc.text("CURRENT / TARGET", W - M - 8, y + 14.5, { align: "right" });
    y += 22;

    data.goals.forEach((g) => {
      ensure(30);
      doc.setDrawColor(...LINE);
      doc.line(M, y, W - M, y);
      y += 14;

      // Goal label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(g.label, 220)[0], goalColX.label, y);

      // Category
      const catObj = CATEGORIES[g.category] || CATEGORIES.other;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...SOFT);
      const catLabel = g.platform ? `${catObj.label} (${g.platform})` : catObj.label;
      doc.text(catLabel, goalColX.cat, y);

      // Progress % + mini bar
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...(g.isCompleted ? GOOD : INK));
      doc.text(`${g.progressPct}%`, goalColX.progress, y);

      const gBarW = 48;
      const gBarX = goalColX.progress + 34;
      const gBarY = y - 6;
      doc.setFillColor(235, 239, 245);
      doc.roundedRect(gBarX, gBarY, gBarW, 3.5, 2, 2, "F");
      doc.setFillColor(...(g.isCompleted ? GOOD : PURPLE));
      doc.roundedRect(gBarX, gBarY, Math.max(2, (gBarW * Math.min(100, g.progressPct)) / 100), 3.5, 2, 2, "F");

      // Target vs Current
      const formattedCur = formatMetricValue(g.current, g.unit);
      const formattedTar = formatMetricValue(g.target, g.unit);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...SOFT);
      doc.text(`${formattedCur} / ${formattedTar}`, W - M - 8, y, { align: "right" });

      y += 10;
    });
    y += 14;
  }

  // ---- Milestones (if any) ----
  if (data.milestones && data.milestones.length > 0) {
    sectionTitle("Project milestones", `${data.milestones.length} milestone${data.milestones.length !== 1 ? "s" : ""}`);

    data.milestones.forEach((m) => {
      ensure(24);
      doc.setFillColor(...(m.isPast ? GOOD : PURPLE));
      doc.circle(M + 6, y - 3, 2.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(m.title, 280)[0], M + 16, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...FAINT);
      if (m.notes) {
        doc.text(doc.splitTextToSize(m.notes, 160)[0], M + 300, y);
      }
      doc.text(m.date ? formatReadableDate(m.date) : "No date", W - M, y, { align: "right" });
      y += 16;
    });
    y += 10;
  }

  // ---- Tasks completed in period ----
  sectionTitle(
    "Tasks completed in reporting period",
    `${data.completedTasks.length} task${data.completedTasks.length !== 1 ? "s" : ""} completed between ${data.period.from} and ${data.period.to}`
  );

  if (data.completedTasks.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...FAINT);
    doc.text("No tasks were completed in this reporting period.", M, y + 4);
    y += 18;
  } else {
    data.completedTasks.forEach((task) => {
      ensure(20);
      doc.setFillColor(...GOOD);
      doc.circle(M + 5, y - 3, 2.2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(task.title, 360)[0], M + 14, y);

      const pObj = PRIORITIES[task.priority] || PRIORITIES.medium;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SOFT);
      doc.text(`[${pObj.label}]`, M + 380, y);

      doc.setTextColor(...FAINT);
      doc.text(task.date, W - M, y, { align: "right" });
      y += 15;
    });
  }
  y += 10;

  // ---- Open / Remaining Tasks (if any) ----
  if (data.openTasks && data.openTasks.length > 0) {
    sectionTitle(
      "Remaining active tasks",
      `${data.openTasks.length} open task${data.openTasks.length !== 1 ? "s" : ""}`
    );

    data.openTasks.forEach((task) => {
      ensure(20);
      const isOverdue = task.dueDate && task.dueDate < todayISO();
      doc.setFillColor(...(isOverdue ? DANGER : task.status === "in_progress" ? PURPLE : FAINT));
      doc.circle(M + 5, y - 3, 2.2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(task.title, 340)[0], M + 14, y);

      const statusTag = task.status === "in_progress" ? "In progress" : "To do";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...(task.status === "in_progress" ? PURPLE : SOFT));
      doc.text(statusTag, M + 360, y);

      doc.setTextColor(...(isOverdue ? DANGER : FAINT));
      doc.text(task.dueDate ? `Due ${formatReadableDate(task.dueDate)}` : "No due date", W - M, y, {
        align: "right",
      });
      y += 15;
    });
  }

  footer();

  const fileName = reportFileName(data.period, data.project);
  if (save) {
    await save(new Uint8Array(doc.output("arraybuffer")), fileName);
    return;
  }

  // Browser: object-URL anchor download.
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
