const express = require("express");
const projectsDb = require("../db/projects");
const tasksDb = require("../db/tasks");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseAddTask(message) {
  const lower = message.toLowerCase().trim();
  const isAdd = /^(add|create)\s+task\s+/i.test(message);
  if (!isAdd) return null;
  let rest = message.replace(/^(add|create)\s+task\s+/i, "").trim();
  if (!rest) return null;

  let dueDate = null;
  // due today/tomorrow/next week / on YYYY-MM-DD
  const dueRegex = /\s+due\s+(today|tomorrow|next week|on\s+(\d{4}-\d{2}-\d{2})|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4}))/i;
  const dueMatch = rest.match(dueRegex);
  if (dueMatch) {
    const phrase = dueMatch[1].toLowerCase().trim();
    if (phrase === "today") dueDate = todayISO();
    else if (phrase === "tomorrow") dueDate = addDaysISO(todayISO(), 1);
    else if (phrase === "next week") dueDate = addDaysISO(todayISO(), 7);
    else if (dueMatch[2]) dueDate = dueMatch[2];
    else if (dueMatch[3]) dueDate = dueMatch[3];
    else if (dueMatch[4]) {
      const parts = dueMatch[4].split("/");
      const mm = parts[0].padStart(2, "0");
      const dd = parts[1].padStart(2, "0");
      const yyyy = parts[2];
      dueDate = `${yyyy}-${mm}-${dd}`;
    }
    rest = rest.replace(dueMatch[0], " ").trim();
  }

  let projectName = null;
  const projMatch = rest.match(/\s+in\s+(.+)$/i);
  if (projMatch) {
    projectName = projMatch[1].trim();
    rest = rest.replace(projMatch[0], " ").trim();
  }

  // Clean up extra spaces and remove trailing punctuation
  let title = rest.replace(/\s+/g, " ").trim();
  title = title.replace(/[.]+$/, "").trim();
  if (!title) return null;
  // Capitalize first letter for nice display
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, dueDate, projectName };
}

function isListIntent(msg) {
  const l = msg.toLowerCase();
  return (
    l.includes("what") && (l.includes("task") || l.includes("doing today")) ||
    l.includes("show") && l.includes("task") ||
    l.includes("list") && l.includes("task") ||
    l.includes("pending") ||
    l.includes("due today")
  );
}

function isOrganizeIntent(msg) {
  const l = msg.toLowerCase();
  return l.includes("organize") || l.includes("push pending") || l.includes("plan for tomorrow") || l.includes("prioritize");
}

function isMorningPlanIntent(msg) {
  const l = msg.toLowerCase();
  return l.includes("morning") || l.includes("what are we doing today") || l.includes("today's plan");
}

router.post("/chat", async (req, res) => {
  try {
  const { message } = req.body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  const text = message.trim();

  // Fetch user's projects for context
  let projects = [];
  try {
    projects = await projectsDb.listForCaller(
      {
        fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
        restrictedWorkspaceIds: req.restrictedWorkspaceIds,
        userId: req.userId,
      },
      { archived: false }
    );
  } catch (e) {
    // fallback empty
  }

  // Intent: Add task
  const add = parseAddTask(text);
  if (add) {
    if (projects.length === 0) {
      return res.json({
        reply: "You don't have a project yet. Create a project first, then I can add tasks for you.",
        action: "need_project",
      });
    }
    let targetProject = null;
    if (add.projectName) {
      const lower = add.projectName.toLowerCase();
      targetProject = projects.find((p) => p.name.toLowerCase() === lower) ||
        projects.find((p) => p.name.toLowerCase().includes(lower));
    }
    if (!targetProject) targetProject = projects[0];

    try {
      const task = await tasksDb.create({
        projectId: targetProject.id,
        title: add.title,
        notes: "",
        goalId: null,
        status: "todo",
        dueDate: add.dueDate,
        completedAt: null,
        assigneeId: null,
      });
      // Build friendly reply
      let reply = `✅ Added **"${add.title}"** to *${targetProject.name}*`;
      if (add.dueDate) reply += ` — due ${add.dueDate}`;
      reply += `. I’ll remind you as the due date approaches and check in at midday.`;
      return res.json({ reply, action: "task_created", task, project: targetProject });
    } catch (err) {
      return res.status(500).json({ error: "Could not create task" });
    }
  }

  // Intent: Organize / push pending — pushes overdue to today
  if (isOrganizeIntent(text)) {
    const pending = [];
    for (const p of projects) {
      for (const t of (p.tasks || [])) {
        if (t.status !== "done") pending.push({ ...t, projectName: p.name, projectId: p.id });
      }
    }
    if (pending.length === 0) {
      return res.json({ reply: "🎉 No pending tasks — you’re all clear! Want me to help plan something new for tomorrow?", action: "organize_empty" });
    }
    const today = todayISO();
    // Push overdue to today (next-day behavior) — update DB
    const overdueTasks = pending.filter((t) => t.dueDate && t.dueDate < today);
    let pushed = 0;
    for (const t of overdueTasks) {
      try { await tasksDb.update(t.id, { dueDate: today }); pushed++; t.dueDate = today; } catch {}
    }
    pending.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      if (a.dueDate < today && b.dueDate >= today) return -1;
      if (b.dueDate < today && a.dueDate >= today) return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    const dueToday = pending.filter((t) => t.dueDate === today).length;
    let reply = `📋 **Organized ${pending.length} pending tasks**\n\n`;
    if (pushed) reply += `⚠️ Pushed ${pushed} overdue to today so nothing slips.\n`;
    if (dueToday) reply += `📌 ${dueToday} due today.\n`;
    reply += `\n**Top 5 to focus on:**\n`;
    pending.slice(0, 5).forEach((t, i) => {
      reply += `${i + 1}. ${t.title} · *${t.projectName}*${t.dueDate ? ` (due ${t.dueDate})` : ""}\n`;
    });
    reply += `\nI’ll check in at midday and evening. Want to add more?`;
    return res.json({ reply, action: "organized", tasks: pending.slice(0, 10), pushed });
  }

  // Intent: List / what's due
  if (isListIntent(text) || isMorningPlanIntent(text)) {
    const today = todayISO();
    const dueToday = [];
    const overdue = [];
    const upcoming = [];
    for (const p of projects) {
      for (const t of (p.tasks || [])) {
        if (t.status === "done") continue;
        if (t.dueDate === today) dueToday.push({ ...t, projectName: p.name });
        else if (t.dueDate && t.dueDate < today) overdue.push({ ...t, projectName: p.name });
        else if (t.dueDate && t.dueDate > today) upcoming.push({ ...t, projectName: p.name });
      }
    }
    if (dueToday.length === 0 && overdue.length === 0) {
      const totalPending = projects.reduce((s, p) => s + (p.tasks || []).filter((t) => t.status !== "done").length, 0);
      if (totalPending === 0) return res.json({ reply: "Good morning! ☀️ No tasks pending. Tell me what you want to achieve today and I’ll add them for you — e.g. `Add task Design review due today in My Project`.", action: "morning_empty" });
      let reply = `Good morning! ☀️ You have **${totalPending} pending tasks**, but none due today.\n\n`;
      if (overdue.length) reply += `⚠️ ${overdue.length} overdue:\n` + overdue.slice(0, 3).map((t) => `• ${t.title} · ${t.projectName}`).join("\n") + "\n\n";
      reply += `What are we doing today? List them and I’ll track them.`;
      return res.json({ reply, action: "morning_list" });
    }
    let reply = "";
    if (isMorningPlanIntent(text) || text.toLowerCase().includes("morning")) reply += "Good morning! ☀️ Here's today:\n\n";
    if (overdue.length) {
      reply += `⚠️ **Overdue (${overdue.length}):**\n` + overdue.slice(0, 5).map((t) => `• ${t.title} · ${t.projectName} (due ${t.dueDate})`).join("\n") + "\n\n";
    }
    if (dueToday.length) {
      reply += `📌 **Due today (${dueToday.length}):**\n` + dueToday.slice(0, 5).map((t) => `• ${t.title} · ${t.projectName}`).join("\n") + "\n\n";
    }
    reply += `Want me to organize the rest or add more? Just say “Add task …”`;
    return res.json({ reply, action: "list_today", dueToday, overdue });
  }

  // Fallback: helpful guide
  return res.json({
    reply: `I’m your Deck PA — I keep it simple:\n\n• **Add task:** \`Add task Shoot reel #2 due tomorrow in Acme Launch\`\n• **Today:** \`What’s due today?\`\n• **Organize:** \`Organize my pending tasks\`\n\nTry one, or tell me what you’re working on today and I’ll add them.`,
    action: "help",
  });
  } catch (err) { console.error("PA chat error", err); return res.status(500).json({ error: "PA temporarily unavailable" }); }
});

// Daily briefing - for notifications / morning check
router.get("/briefing", async (req, res) => {
  try {
  let projects = [];
  try {
    projects = await projectsDb.listForCaller(
      {
        fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
        restrictedWorkspaceIds: req.restrictedWorkspaceIds,
        userId: req.userId,
      },
      { archived: false }
    );
  } catch {}
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const pending = [];
  const dueToday = [];
  const overdue = [];
  const dueTomorrow = [];
  for (const p of projects) {
    for (const t of (p.tasks || [])) {
      if (t.status === "done") continue;
      pending.push(t);
      if (t.dueDate === today) dueToday.push(t);
      else if (t.dueDate && t.dueDate < today) overdue.push(t);
      else if (t.dueDate === tomorrow) dueTomorrow.push(t);
    }
  }
  // Generate message based on time of day
  const hour = new Date().getHours();
  let greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  let message = `${greeting}! `;
  if (hour < 12) {
    if (dueToday.length || overdue.length) {
      message += `You have ${dueToday.length} due today${overdue.length ? ` and ${overdue.length} overdue` : ""}. What are we tackling first?`;
    } else if (pending.length === 0) {
      message += `No tasks yet — what are we doing today?`;
    } else {
      message += `No tasks due today, but ${pending.length} pending. Want to plan the day?`;
    }
  } else if (hour < 17) {
    message += `Midday check — ${pending.length} pending, ${dueToday.length} due today. Need to add or update anything?`;
  } else {
    message += `Evening wrap — ${dueToday.length} were due today, ${overdue.length} overdue. Update your progress and I’ll push pending to tomorrow.`;
  }
  res.json({ message, stats: { pending: pending.length, dueToday: dueToday.length, overdue: overdue.length, dueTomorrow: dueTomorrow.length } });
  } catch (err) { console.error("briefing error", err); res.status(500).json({ error: "Briefing unavailable" }); }
});

module.exports = router;
