// Report building blocks: period presets, report data derived from real
// project data, and a client-side PDF renderer (jsPDF, loaded on demand).

import { computeAnalytics } from "./analytics";
import { getProjectStatus } from "./projectStatus";
import { projectProgress, todayISO } from "./dashboard";

export const REPORT_PERIODS = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "all_time", label: "All time" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

// { from, to } as YYYY-MM-DD strings (inclusive) + a human label.
export function resolvePeriod(value, custom = { from: "", to: "" }) {
  const now = new Date();
  const today = iso(now);
  const label = REPORT_PERIODS.find((p) => p.value === value)?.label || "Report";

  if (value === "custom") {
    const from = custom.from || today;
    const to = custom.to || today;
    return { from, to, label: `${from} → ${to}`, value };
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
  return { from, to, label, value };
}

const inRange = (dayStr, from, to) => Boolean(dayStr) && dayStr >= from && dayStr <= to;

// Everything the on-screen preview and the PDF share — all derived from real
// projects data.
export function buildReportData(projects, period, user) {
  const list = projects || [];
  const active = list.filter((p) => !p.archived);
  const analytics = computeAnalytics(active);

  const completedTasks = [];
  let tasksCreated = 0;
  let projectsCreated = 0;
  const completionsByProject = {};

  for (const project of list) {
    if (inRange((project.createdAt || "").slice(0, 10), period.from, period.to)) projectsCreated += 1;
    for (const task of project.tasks || []) {
      const doneDay = (task.completedAt || "").slice(0, 10);
      if (inRange(doneDay, period.from, period.to)) {
        completedTasks.push({
          title: task.title,
          projectName: project.name,
          date: doneDay,
        });
        completionsByProject[project.name] = (completionsByProject[project.name] || 0) + 1;
      }
      if (inRange((task.createdAt || "").slice(0, 10), period.from, period.to)) tasksCreated += 1;
    }
  }
  completedTasks.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

  const projectRows = active
    .map((p) => ({
      name: p.name,
      status: getProjectStatus(p),
      progress: projectProgress(p),
      tasksDone: (p.tasks || []).filter((t) => t.status === "done").length,
      tasksTotal: (p.tasks || []).length,
      goals: (p.goals || []).length,
      overdue: (p.tasks || []).filter(
        (t) => t.status !== "done" && t.dueDate && t.dueDate < todayISO()
      ).length,
      dueDate: p.dueDate || null,
      completions: completionsByProject[p.name] || 0,
    }))
    .sort((a, b) => b.progress - a.progress);

  return {
    period,
    generatedAt: new Date(),
    userName: user?.name || user?.email || "",
    summary: {
      activeProjects: active.length,
      projectsCreated,
      tasksCompleted: completedTasks.length,
      tasksCreated,
      overdueNow: analytics.tasksOverdue,
      avgCompletion: analytics.avgCompletion,
      completedProjects: analytics.byStatus.completed,
      inProgressProjects: analytics.byStatus.in_progress,
    },
    projectRows,
    completedTasks,
  };
}

export function reportFileName(period) {
  return `DECK-Report-${period.value === "custom" ? `${period.from}_to_${period.to}` : period.value}-${todayISO()}.pdf`;
}

const PURPLE = [124, 92, 255];
const BLUE = [79, 123, 255];
const INK = [15, 23, 42];
const SOFT = [91, 107, 127];
const FAINT = [138, 148, 166];
const LINE = [233, 237, 243];
const GOOD = [14, 159, 110];
const DANGER = [220, 61, 67];

const nf = new Intl.NumberFormat("en-IN");

// Renders the report to PDF with jsPDF (vector text/shapes, paginates
// automatically). Loaded via dynamic import so jspdf stays out of the main
// bundle. The optional `save` hook is used by tests/Node; in the browser the
// default triggers a normal file download.
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
    doc.setFillColor(248, 250, 253);
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
    doc.setFillColor(248, 250, 253);
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
