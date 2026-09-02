/**
 * Regression suite for the voice AI pipeline (parser + route + handlers).
 *
 *   node server/scripts/verify-voice.js
 *
 * Only the DB and auth layers are stubbed; aiParser, constants, express and the
 * route module are the real ones. There is no test runner in this repo, so this
 * is a plain Node script that executes the code paths and reports a pass/fail
 * tally. Exit code 1 on any failure.
 */
const path = require("node:path");
const BASE = path.join(__dirname, "..", "src");

let pass = 0;
const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; console.log(`  ok   ${name}  ->  ${JSON.stringify(actual)}`); }
  else { failures.push(name); console.log(`  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`); }
}
function checkTrue(name, cond, detail) {
  if (cond) { pass += 1; console.log(`  ok   ${name}  ->  ${detail}`); }
  else { failures.push(name); console.log(`  FAIL ${name}  ->  ${detail}`); }
}

const TODAY = "2026-09-02"; // a Wednesday
const parser = require(path.join(BASE, "lib", "aiParser"));

/* ------------------------------------------------------------------ *
 * Parser units
 * ------------------------------------------------------------------ */
console.log("\n[1] keyword + date helpers");
check("category whole-word (add...blog)", parser.detectCategory("add a task to write a blog post"), "content");
check("category 'run an ad'", parser.detectCategory("run an ad"), "ads");
check("priority negation", parser.detectPriority("this is not urgent"), "medium");
check("priority high", parser.detectPriority("urgent, drop everything"), "high");
check("localISODate IST", parser.localISODate(new Date("2026-09-02T20:00:00Z"), "Asia/Calcutta"), "2026-09-03");
check("due tomorrow", parser.extractDueDate("due tomorrow", TODAY), "2026-09-03");
check("due next monday == next week", parser.extractDueDate("next monday", TODAY), parser.extractDueDate("next week", TODAY));
check("due end of month", parser.extractDueDate("end of month", TODAY), "2026-09-30");
check("due 4th of september", parser.extractDueDate("the 4th of september", TODAY), "2026-09-04");
check("sanitize impossible", parser.sanitizeISODate("2026-02-30", TODAY), null);
check("extractJSON prose+fence", parser.extractJSON('x\n```json\n{"a":1}\n```'), { a: 1 });

console.log("\n[2] normalizeActions gate");
const gate = parser.normalizeActions([
  { type: "create_project", name: "Deck" },
  { type: "create_project", name: "x" },
  { type: "create_task", title: "Design landing page", priority: "DROP TABLE", dueDate: "1999-01-01", status: "hacked" },
  { type: "fly_to_moon" },
], { source: "llm", todayISO: TODAY, transcript: "t" });
check("two usable kept", gate.actions.length, 2);
check("two rejected", gate.rejected.length, 2);
check("hostile priority clamped", gate.actions[1].priority, "medium");
check("impossible date nulled", gate.actions[1].dueDate, null);
checkTrue("confidence derived, needsReview consistent",
  gate.actions.every((a) => a.needsReview === (a.confidence < 0.7)), JSON.stringify(gate.actions.map((a) => a.confidence)));

console.log("\n[3] create_project rule parsing + grouping");
check("project name", parser.parseTranscript("Create a project called Deck", { todayISO: TODAY }).actions.map((a) => [a.type, a.name]), [["create_project", "Deck"]]);
const grouped = parser.parseTranscript(
  "Create a project called Deck. Add a goal to grow instagram followers to 10k monthly. Create a task to write the blog post due 4th of september.",
  { todayISO: TODAY }
).actions;
check("3 actions", grouped.length, 3);
check("goal under new project", String(grouped.find((a) => a.type === "create_goal").projectHint).toLowerCase(), "deck");
check("goal category", grouped.find((a) => a.type === "create_goal").category, "social");
check("goal target", grouped.find((a) => a.type === "create_goal").targetValue, 10000);
check("task under new project", String(grouped.find((a) => a.type === "create_task").projectHint).toLowerCase(), "deck");
check("task dueDate", grouped.find((a) => a.type === "create_task").dueDate, "2026-09-04");
check("period weekly", parser.parseTranscript("Add a goal to post 3 times weekly", { todayISO: TODAY }).actions[0].period, "weekly");

console.log("\n[4] run-on splitter keeps modifiers attached");
const split = parser.parseTranscript(
  "Create a task to design landing page for tomorrow and assign to Sarah, high priority.",
  { todayISO: TODAY, collaborators: [{ userId: "u9", name: "Sarah Khan", email: "sarah@x.com" }] }
).actions;
check("one task", split.length, 1);
check("priority kept", split[0].priority, "high");
check("assignee canonical", split[0].assigneeHint, "Sarah Khan");

/* ------------------------------------------------------------------ *
 * Route module (real require, express resolves)
 * ------------------------------------------------------------------ */
console.log("\n[5] route helpers");
const voice = require(path.join(BASE, "routes", "voice"));
const routes = voice.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
check("mounted routes", routes, ["POST /parse", "POST /execute", "GET /notes", "DELETE /notes/:id", "GET /context"]);
check("sanitizeTimeZone bogus", voice.sanitizeTimeZone("Mars/Olympus"), null);
check("9am IST", voice.localTimeToISO("2026-09-03", 9, "Asia/Calcutta"), "2026-09-03T03:30:00.000Z");

/* ------------------------------------------------------------------ *
 * End-to-end handlers with stubbed DB/auth
 * ------------------------------------------------------------------ */
const captured = { tasks: [], goals: [], reminders: [], notes: [], voiceNotes: [], notifications: [], projects: [] };
function stub(rel, exports) {
  const abs = require.resolve(path.join(BASE, rel));
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports, children: [], paths: [] };
}
// Stub BEFORE requiring the router fresh. Clear any cached router first.
delete require.cache[require.resolve(path.join(BASE, "routes", "voice"))];
stub("middleware/auth", { requireAuth: (req, _res, next) => { req.userId = "u1"; next(); } });
stub("middleware/workspace", {
  attachWorkspaces: (req, _res, next) => {
    req.workspaces = [{ id: "ws1", name: "Personal", personal: true, role: "admin" }];
    req.workspaceIds = ["ws1"]; req.fullAccessWorkspaceIds = ["ws1"]; req.restrictedWorkspaceIds = [];
    next();
  },
});
stub("db/projects", {
  listForCaller: async () => [{ id: "p1", name: "Website Relaunch", workspaceId: "ws1", tags: ["web"], tasks: [{ id: "t1", title: "Ship homepage hero" }] }],
  create: async (o) => { const proj = { id: "p-new", priority: "medium", ...o }; captured.projects.push(proj); return proj; },
});
stub("db/goals", { create: async (o) => { captured.goals.push(o); return { id: "g1", ...o }; } });
stub("db/tasks", { create: async (o) => { captured.tasks.push(o); return { id: "tk1", ...o }; }, update: async (id, f) => ({ id, ...f }) });
stub("db/users", { findById: async () => ({ id: "u1", name: "Vishal", email: "v@x.com" }) });
stub("db/voiceNotes", { create: async (o) => { captured.voiceNotes.push(o); return { id: "vn1", ...o }; }, listForUser: async () => [], remove: async () => {} });
stub("db/reminders", { create: async (o) => { captured.reminders.push(o); return { id: "r1", ...o }; } });
stub("db/notifications", { create: async (o) => { captured.notifications.push(o); return { id: "n1", ...o }; } });
stub("db/memberships", {});
stub("db/personalEntries", { create: async (o) => { captured.notes.push(o); return { id: "e1", ...o }; } });
stub("db/activityLog", { log: async () => {} });
stub("lib/collaborators", { collaboratorsFor: async () => [{ userId: "u2", name: "Sarah Khan", email: "sarah@x.com" }, { userId: "u3", name: "Ravi Teja", email: "ravi@x.com" }] });

const express = require(path.join(BASE, "..", "node_modules", "express"));
const router = require(path.join(BASE, "routes", "voice"));

(async () => {
  // deterministic rule-based: strip every key Echo could pick up
  for (const k of ["ECHO_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "TOGETHER_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
    delete process.env[k];
  }
  const app = express();
  app.use(express.json());
  app.use("/api/voice", router);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (p, body) => {
    const res = await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  console.log("\n[6] /parse — honest degradation + IST dates");
  const parsed = await post("/api/voice/parse", { transcript: "Create a task to design the landing page for tomorrow and assign to Sarah, high priority.", projectId: "p1", timeZone: "Asia/Calcutta" });
  check("200", parsed.status, 200);
  const t = parsed.body.actions.find((a) => a.type === "create_task");
  check("priority", t.priority, "high");
  check("assignee resolved", t.assignee?.name, "Sarah Khan");
  check("degraded flag", parsed.body.degraded, true);
  check("diagnostics reason", /Echo model not configured/.test(parsed.body.diagnostics.reason), true);

  console.log("\n[7] /execute — re-gate, priority persists, reminder in IST");
  captured.tasks.length = 0; captured.reminders.length = 0;
  const exec = await post("/api/voice/execute", {
    transcript: "design landing page", projectId: "p1", timeZone: "Asia/Calcutta",
    actions: [
      { type: "create_task", title: "Design landing page", dueDate: "2026-09-03", priority: "high", assigneeHint: "Sarah Khan", projectId: "p1" },
      { type: "create_reminder", message: "Email client", dueDate: "2026-09-04", frequency: "once" },
    ],
  });
  check("200", exec.status, 200);
  check("task priority persisted", captured.tasks[0].priority, "high");
  check("reminder at 09:00 IST", captured.reminders[0].scheduledAt, "2026-09-04T03:30:00.000Z");

  console.log("\n[8] /execute — create_project groups goals into the new project");
  captured.goals.length = 0; captured.projects.length = 0;
  const projExec = await post("/api/voice/execute", {
    transcript: "create a project called Deck and add a goal to grow followers to 15 monthly",
    timeZone: "Asia/Calcutta",
    actions: [
      { type: "create_project", name: "Deck" },
      { type: "create_goal", label: "Grow followers", category: "social", targetValue: 15, period: "monthly", projectHint: "Deck" },
    ],
  });
  check("200", projExec.status, 200);
  check("one project created", captured.projects.length, 1);
  check("named Deck", captured.projects[0].name, "Deck");
  check("one goal", captured.goals.length, 1);
  check("goal in NEW project (not first)", captured.goals[0].projectId, "p-new");
  checkTrue("summary counts project", /1 project/.test(projExec.body.summary), projExec.body.summary);

  server.close();
  console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log(failures.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
