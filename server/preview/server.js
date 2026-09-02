// Local preview server: runs the REAL Express API (server/src/index.js)
// against the in-memory Mongo shim, then seeds realistic demo data so every
// screen can be exercised with zero external services.
//
//   node preview/server.js
//
// Env: PORT (default 4000), JWT_SECRET (default: local-dev-secret)

"use strict";

const path = require("path");
const bcrypt = require("bcryptjs");

// --- Stub the Mongo driver module BEFORE the app loads it ---
const mongoModuleId = require.resolve("../src/db/mongodb");
const shim = require("./in-memory-mongo");
const store = shim.__store;

require.cache[mongoModuleId] = {
  id: mongoModuleId,
  filename: mongoModuleId,
  loaded: true,
  exports: shim,
};

process.env.JWT_SECRET = process.env.JWT_SECRET || "local-preview-secret";
process.env.PORT = process.env.PORT || "4000";

// Bring in the db layer (now backed by the shim).
const usersDb = require("../src/db/users");
const workspacesDb = require("../src/db/workspaces");
const membershipsDb = require("../src/db/memberships");
const projectsDb = require("../src/db/projects");
const goalsDb = require("../src/db/goals");
const tasksDb = require("../src/db/tasks");
const milestonesDb = require("../src/db/milestones");
const metricsDb = require("../src/db/metrics");
const personalDb = require("../src/db/personalEntries");
const notificationsDb = require("../src/db/notifications");
const activityDb = require("../src/db/activityLog");
const remindersDb = require("../src/db/reminders");
const voiceNotesDb = require("../src/db/voiceNotes");

const nanoid = () => Math.random().toString(36).slice(2, 12);

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoDaysAgo(n, hOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hOffset);
  return d.toISOString();
}

async function seed() {
  const existing = await usersDb.findByEmail("demo@planyourdeck.com");
  if (existing) {
    console.log("Seed: demo data already present — skipping.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await usersDb.create({
    email: "demo@planyourdeck.com",
    passwordHash,
    name: "Vishal Kumar",
  });

  const workspace = await workspacesDb.create({
    name: "Growth Team",
    ownerId: user.id,
    personal: true,
  });
  await membershipsDb.createActive({ workspaceId: workspace.id, userId: user.id, role: "owner" });

  async function createProject({ name, description, tags, priority, dueInDays, createdAgo, archived = false }) {
    const project = await projectsDb.create({
      workspaceId: workspace.id,
      userId: user.id,
      name,
      description,
      tags,
      priority,
      dueDate: dueInDays === null ? null : daysFromNow(dueInDays),
      memberAccess: [],
    });
    const col = shim.getDb().collection("projects");
    const set = { createdAt: isoDaysAgo(createdAgo) };
    if (archived) set.archived = true;
    await col.updateOne({ id: project.id }, { $set: set });
    return projectsDb.findById(project.id);
  }

  async function goal(projectId, fields) {
    return goalsDb.create({ projectId, ...fields });
  }

  async function task(projectId, fields) {
    const t = await tasksDb.create({ projectId, ...fields });
    if (fields.status === "done" || fields.completedDaysAgo !== undefined) {
      const col = shim.getDb().collection("tasks");
      await col.updateOne(
        { id: t.id },
        { $set: { completedAt: isoDaysAgo(fields.completedDaysAgo ?? 0) } }
      );
    }
    if (fields.createdDaysAgo !== undefined) {
      const col = shim.getDb().collection("tasks");
      await col.updateOne({ id: t.id }, { $set: { createdAt: isoDaysAgo(fields.createdDaysAgo) } });
    }
    return t;
  }

  // ---- Project 1: nearly complete social launch ----
  const p1 = await createProject({
    name: "Summer Collection Launch",
    description: "Multi-channel launch for the summer line — social, email, and paid.",
    tags: ["launch", "q3", "priority"],
    priority: "high",
    dueInDays: 9,
    createdAgo: 34,
  });
  await goal(p1.id, { category: "social", platform: "Instagram", label: "Reach 250k accounts", targetValue: 250000, currentValue: 212400, unit: "count", period: "onetime", step: 1000 });
  await goal(p1.id, { category: "email", platform: "Mailchimp", label: "Open rate 42%", targetValue: 42, currentValue: 38, unit: "percent", period: "weekly", step: 1 });
  await task(p1.id, { title: "Finalize hero creative set", status: "done", completedDaysAgo: 3, createdDaysAgo: 20 });
  await task(p1.id, { title: "Schedule 12 teaser posts", status: "done", completedDaysAgo: 2, createdDaysAgo: 15 });
  await task(p1.id, { title: "Write launch-day email copy", status: "in_progress", dueDate: daysFromNow(1), createdDaysAgo: 10 });
  await task(p1.id, { title: "QA email render across clients", status: "todo", dueDate: daysFromNow(2), createdDaysAgo: 8 });
  await task(p1.id, { title: "Brief influencers (8 confirmed)", status: "todo", dueDate: daysFromNow(4), createdDaysAgo: 6 });
  await milestonesDb.create({ projectId: p1.id, createdBy: user.id, title: "Teaser phase live", date: daysFromNow(-6), notes: "All channels posting on cadence." });
  await milestonesDb.create({ projectId: p1.id, createdBy: user.id, title: "Launch day", date: daysFromNow(9), notes: "Full blast across social + email + ads." });

  // ---- Project 2: ads scaling, in progress ----
  const p2 = await createProject({
    name: "Meta Ads Scale-Up",
    description: "Take the winning creative combos from 2x to 5x spend at stable ROAS.",
    tags: ["ads", "scaling"],
    priority: "high",
    dueInDays: 21,
    createdAgo: 26,
  });
  await goal(p2.id, { category: "ads", platform: "Meta", label: "ROAS 4.0x", targetValue: 4, currentValue: 3.2, unit: "ratio", period: "weekly", step: 0.1 });
  await goal(p2.id, { category: "ads", platform: "Meta", label: "CPL under ₹85", targetValue: 85, currentValue: 92, unit: "currency", period: "weekly", step: 1 });
  await task(p2.id, { title: "Ship 3 new UGC video variants", status: "done", completedDaysAgo: 5, createdDaysAgo: 14 });
  await task(p2.id, { title: "Rebalance budget to top 2 ad sets", status: "done", completedDaysAgo: 1, createdDaysAgo: 9 });
  await task(p2.id, { title: "Set up lead-quality feedback loop", status: "in_progress", dueDate: daysFromNow(0), createdDaysAgo: 7 });
  await task(p2.id, { title: "Kill fatigued creatives (CTR < 1%)", status: "todo", dueDate: daysFromNow(-2), createdDaysAgo: 12 });

  // ---- Project 3: SEO foundation, early ----
  const p3 = await createProject({
    name: "Organic SEO Sprint",
    description: "Technical cleanup plus 8 pillar articles targeting bottom-funnel terms.",
    tags: ["seo", "content"],
    priority: "medium",
    dueInDays: 40,
    createdAgo: 18,
  });
  await goal(p3.id, { category: "seo", platform: "Blog", label: "8 pillar articles live", targetValue: 8, currentValue: 3, unit: "count", period: "weekly", step: 1 });
  await goal(p3.id, { category: "seo", platform: "Blog", label: "40 keywords in top 10", targetValue: 40, currentValue: 11, unit: "count", period: "monthly", step: 1 });
  await task(p3.id, { title: "Fix Core Web Vitals on template pages", status: "done", completedDaysAgo: 8, createdDaysAgo: 16 });
  await task(p3.id, { title: "Outline remaining 5 pillar articles", status: "in_progress", dueDate: daysFromNow(3), createdDaysAgo: 11 });
  await task(p3.id, { title: "Draft 'Choosing a marketing tracker' pillar", status: "todo", dueDate: daysFromNow(6), createdDaysAgo: 5 });
  await task(p3.id, { title: "Internal-linking pass on cluster 1", status: "todo", createdDaysAgo: 4 });

  // ---- Project 4: content calendar, pending ----
  const p4 = await createProject({
    name: "Q4 Content Calendar",
    description: "Plan October–December content across blog, social, and newsletter.",
    tags: ["content", "planning"],
    priority: "medium",
    dueInDays: 14,
    createdAgo: 7,
  });
  await goal(p4.id, { category: "content", platform: "Blog", label: "36 pieces mapped", targetValue: 36, currentValue: 9, unit: "count", period: "onetime", step: 3 });
  await task(p4.id, { title: "Lock quarterly themes with founders", status: "todo", dueDate: daysFromNow(2), createdDaysAgo: 6 });
  await task(p4.id, { title: "Map newsletter cadence (Nov–Dec)", status: "todo", dueDate: daysFromNow(5), createdDaysAgo: 6 });

  // ---- Project 5: completed rebrand ----
  const p5 = await createProject({
    name: "Brand Refresh Rollout",
    description: "New identity across site, decks, and social profiles.",
    tags: ["branding"],
    priority: "low",
    dueInDays: -3,
    createdAgo: 60,
  });
  await goal(p5.id, { category: "other", platform: null, label: "All 14 brand touchpoints updated", targetValue: 14, currentValue: 14, unit: "count", period: "onetime", step: 1 });
  await task(p5.id, { title: "Ship new website header/footer", status: "done", completedDaysAgo: 12, createdDaysAgo: 45 });
  await task(p5.id, { title: "Update sales deck template", status: "done", completedDaysAgo: 10, createdDaysAgo: 40 });
  await task(p5.id, { title: "Refresh social avatars + banners", status: "done", completedDaysAgo: 8, createdDaysAgo: 35 });

  // ---- Project 6: archived ----
  await createProject({
    name: "Black Friday Blitz (2025)",
    description: "Last year's holiday push — archived for reference.",
    tags: ["ads", "seasonal"],
    priority: "low",
    dueInDays: null,
    createdAgo: 210,
    archived: true,
  });

  // ---- Metrics on project 2 ----
  const m1 = await metricsDb.create({ projectId: p2.id, createdBy: user.id, category: "ads", key: "spend", label: "Spend", unit: "currency" });
  for (let i = 5; i >= 0; i--) {
    await metricsDb.addEntry(m1.id, { date: daysFromNow(-i * 7), value: 42000 + (5 - i) * 3100, note: "", loggedBy: user.id });
  }
  const m2 = await metricsDb.create({ projectId: p2.id, createdBy: user.id, category: "ads", key: "roas", label: "ROAS", unit: "ratio" });
  for (let i = 5; i >= 0; i--) {
    await metricsDb.addEntry(m2.id, { date: daysFromNow(-i * 7), value: Number((2.4 + (5 - i) * 0.16).toFixed(2)), note: "", loggedBy: user.id });
  }

  // ---- Personal entries ----
  await personalDb.create({ userId: user.id, kind: "todo", text: "Send launch checklist to design", date: daysFromNow(0), dueDate: daysFromNow(1) });
  await personalDb.create({ userId: user.id, kind: "note", text: "Client loved the amber palette — reuse for Q4 deck", date: daysFromNow(0), dueDate: null });
  await personalDb.create({ userId: user.id, kind: "todo", text: "Review influencer contract v2", date: daysFromNow(-1), dueDate: daysFromNow(-1) });
  await personalDb.create({ userId: user.id, kind: "todo", text: "Prep weekly numbers for standup", date: daysFromNow(-2), dueDate: daysFromNow(-2) });

  // Mark the standup prep entry done for a nicer mix.
  const entriesCol = shim.getDb().collection("personalEntries");
  const allEntries = await entriesCol.find({}).toArray();
  const standup = allEntries.find((e) => e.text === "Prep weekly numbers for standup");
  if (standup) {
    await entriesCol.updateOne(
      { id: standup.id },
      { $set: { done: true, completedAt: isoDaysAgo(2) } }
    );
  }

  // ---- Notifications + activity ----
  await notificationsDb.create({ userId: user.id, workspaceId: workspace.id, projectId: p1.id, type: "task_assigned", message: "Launch-day email copy is due tomorrow", link: `/projects/${p1.id}` });
  await notificationsDb.create({ userId: user.id, workspaceId: workspace.id, projectId: p2.id, type: "metric_updated", message: "ROAS crossed 3.2x on Meta", link: `/projects/${p2.id}` });
  await activityDb.log({ workspaceId: workspace.id, projectId: p1.id, actorUserId: user.id, type: "project_created", message: "Vishal Kumar created this project" });
  await activityDb.log({ workspaceId: workspace.id, projectId: p1.id, actorUserId: user.id, type: "task_completed", message: "Vishal Kumar completed “Schedule 12 teaser posts”" });
  await activityDb.log({ workspaceId: workspace.id, projectId: p2.id, actorUserId: user.id, type: "metric_entry", message: "Vishal Kumar logged ₹57,500 spend" });

  // ---- Voice notes & reminders (new) ----
  await voiceNotesDb.create({
    userId: user.id,
    workspaceId: workspace.id,
    projectId: p1.id,
    transcript: "Create a task to design landing page for tomorrow and assign to Sarah high priority",
    summary: "1 task from voice input",
    actions: { tasks: [{ title: "design landing page" }], goals: [], notes: [] },
    rawActions: [],
  });
  await voiceNotesDb.create({
    userId: user.id,
    workspaceId: workspace.id,
    projectId: p2.id,
    transcript: "Add a goal to increase Instagram followers to 10k and remind me daily to update task progress",
    summary: "1 goal, 1 reminder from voice",
    actions: { tasks: [], goals: [{ label: "Increase Instagram followers to 10k" }], notes: [] },
    rawActions: [],
  });
  await remindersDb.create({
    userId: user.id,
    workspaceId: workspace.id,
    projectId: p1.id,
    type: "task_progress",
    message: "📋 Update your task progress to keep team aligned",
    link: `/projects/${p1.id}`,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    frequency: "daily",
  });
  await remindersDb.create({
    userId: user.id,
    workspaceId: workspace.id,
    type: "general_nudge",
    message: "💡 Quick tip: Use voice notes to capture tasks 3x faster. Try the mic button!",
    link: "/voice",
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    frequency: "once",
  });
  await remindersDb.create({
    userId: user.id,
    workspaceId: workspace.id,
    type: "goal_checkin",
    message: "🚀 Stay organized — review your goals and keep momentum going!",
    link: "/dashboard",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    frequency: "weekdays",
  });

  console.log("Seed complete — demo@planyourdeck.com / demo1234 (with voice & reminders)");
}

// Start the real app, then seed.
require("../src/index.js");

setTimeout(() => {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}, 800);
