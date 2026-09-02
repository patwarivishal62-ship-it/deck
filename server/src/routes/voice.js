const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const projectsDb = require("../db/projects");
const goalsDb = require("../db/goals");
const tasksDb = require("../db/tasks");
const usersDb = require("../db/users");
const voiceNotesDb = require("../db/voiceNotes");
const remindersDb = require("../db/reminders");
const notificationsDb = require("../db/notifications");
const membershipsDb = require("../db/memberships");
const entriesDb = require("../db/personalEntries");
const activityLogDb = require("../db/activityLog");
const { collaboratorsFor } = require("../lib/collaborators");
const {
  smartParse,
  normalizeActions,
  matchCollaborator,
  localISODate,
} = require("../lib/aiParser");
const { CATEGORY_KEYS, PRIORITY_KEYS, PERIODS, STATUSES } = require("../constants");
const { describeModelConfig } = require("../lib/aiConfig");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

const MAX_TRANSCRIPT = 5000;
// Reminders default to 9am in the *user's* zone, not 9am UTC.
const DEFAULT_REMINDER_HOUR = Number(process.env.VOICE_REMINDER_HOUR) || 9;

/**
 * Accept an IANA zone name from the browser and ignore anything bogus rather
 * than letting Intl throw mid-request.
 */
function sanitizeTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() });
    return value.trim();
  } catch {
    return null;
  }
}

/** Milliseconds between UTC and `timeZone` at a given instant. */
function zoneOffsetMs(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - instant.getTime();
}

/**
 * Wall-clock time on a calendar day, in the user's zone, as an ISO instant.
 * Two offset passes so a DST boundary inside the day still lands correctly.
 */
function localTimeToISO(isoDate, hour, timeZone) {
  if (!isoDate || !timeZone) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  // Fixed point on `guess`, not a running subtraction: t(n+1) = guess - offset(t(n)).
  // Two passes so a DST shift between the guess and the answer still converges.
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  const second = guess - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second).toISOString();
}

async function getContextForUser(req) {
  const projects = await projectsDb.listForCaller(
    {
      fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
      restrictedWorkspaceIds: req.restrictedWorkspaceIds,
      userId: req.userId,
    },
    { archived: false }
  );

  // Gather collaborators from all projects for assignee resolution
  const collabMap = new Map();
  for (const project of projects.slice(0, 10)) {
    try {
      const collabs = await collaboratorsFor(project);
      collabs.forEach((c) => {
        if (!collabMap.has(c.userId)) collabMap.set(c.userId, c);
      });
    } catch {}
  }
  const collaborators = Array.from(collabMap.values());

  return { projects, collaborators };
}

/**
 * Resolve a spoken name to a teammate. Delegates to the parser's matcher so
 * voice parsing and voice execution can never disagree about who "Sarah" is.
 * Returns null rather than guessing: a confidently wrong assignment notifies
 * the wrong person.
 */
function resolveAssigneeByHint(hint, collaborators) {
  return matchCollaborator(hint, collaborators);
}

function resolveProjectByHint(hint, projects, fallbackProjectId) {
  if (fallbackProjectId) {
    const found = projects.find((p) => p.id === fallbackProjectId);
    if (found) return found;
  }
  if (!hint) return projects[0] || null; // default to first project if no hint
  const lower = hint.toLowerCase();
  const byId = projects.find((p) => p.id === hint);
  if (byId) return byId;
  const byName = projects.find((p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()));
  // An unrecognized name is a *new* project, not "just use the first one".
  // Defaulting here is what put the user's "Deck" work into BowlVana.
  return byName || null;
}

// POST /api/voice/parse — parse transcript without executing
router.post("/parse", async (req, res) => {
  const { transcript, projectId, timeZone } = req.body || {};
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Transcript is required." });
  }
  if (transcript.length > MAX_TRANSCRIPT) {
    return res.status(400).json({ error: `Transcript too long (max ${MAX_TRANSCRIPT} chars).` });
  }

  try {
    const context = await getContextForUser(req);
    if (projectId) context.currentProjectId = projectId;
    context.timeZone = sanitizeTimeZone(timeZone);
    context.todayISO = localISODate(new Date(), context.timeZone);

    const result = await smartParse(transcript, context);

    // Enrich actions with resolved entities
    const enriched = result.actions.map((action) => {
      const enrichedAction = { ...action };

      if (action.assigneeHint) {
        const resolved = resolveAssigneeByHint(action.assigneeHint, context.collaborators);
        if (resolved) {
          enrichedAction.assignee = resolved;
          enrichedAction.assigneeId = resolved.userId;
        }
        // Explicitly false beats absent: the UI must be able to say "not found"
        // instead of quietly showing the hint as if it had resolved.
        enrichedAction.assigneeResolved = Boolean(resolved);
      }
      if (action.projectHint || action.projectId || projectId) {
        const proj = resolveProjectByHint(action.projectHint || action.projectId || projectId, context.projects, projectId);
        if (proj) {
          enrichedAction.project = { id: proj.id, name: proj.name };
          enrichedAction.projectId = proj.id;
          enrichedAction.workspaceId = proj.workspaceId;
        } else if (action.projectHint) {
          // Spoken project that doesn't exist yet — will be created on execute.
          enrichedAction.project = { id: null, name: action.projectHint, isNew: true };
          enrichedAction.projectHint = action.projectHint;
        }
      }
      // For tasks/goals without project, assign first available
      if ((action.type === "create_task" || action.type === "create_goal") && !enrichedAction.projectId) {
        if (context.projects.length > 0) {
          enrichedAction.projectId = context.projects[0].id;
          enrichedAction.project = { id: context.projects[0].id, name: context.projects[0].name };
          enrichedAction.workspaceId = context.projects[0].workspaceId;
        }
      }

      return enrichedAction;
    });

    res.json({
      transcript,
      summary: result.summary,
      actions: enriched,
      source: result.source || "rule-based",
      degraded: Boolean(result.degraded),
      diagnostics: result.diagnostics || null,
      todayISO: context.todayISO,
      projects: context.projects.slice(0, 10).map((p) => ({ id: p.id, name: p.name, workspaceId: p.workspaceId })),
      collaborators: context.collaborators.slice(0, 20),
    });
  } catch (err) {
    console.error("Voice parse error:", err);
    res.status(500).json({ error: "Failed to parse voice transcript." });
  }
});

// POST /api/voice/execute — parse and execute actions
router.post("/execute", async (req, res) => {
  const { transcript, actions, projectId, workspaceId, timeZone } = req.body || {};
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Transcript is required." });
  }
  if (transcript.length > MAX_TRANSCRIPT) {
    return res.status(400).json({ error: `Transcript too long (max ${MAX_TRANSCRIPT} chars).` });
  }

  try {
    const context = await getContextForUser(req);
    context.timeZone = sanitizeTimeZone(timeZone);
    context.todayISO = localISODate(new Date(), context.timeZone);

    let actionsToExecute = actions;
    let parseSummary = null;
    let diagnostics = null;

    // If no actions provided, parse transcript now
    if (!actionsToExecute || actionsToExecute.length === 0) {
      const parsed = await smartParse(transcript, { ...context, currentProjectId: projectId });
      actionsToExecute = parsed.actions;
      parseSummary = parsed.summary;
      diagnostics = parsed.diagnostics;
    }

    // Client-supplied actions are user-editable, so they get the same gate as
    // freshly parsed ones: enums clamped, dates validated, junk dropped.
    const gate = normalizeActions(actionsToExecute, {
      source: diagnostics?.source || "rule-based",
      todayISO: context.todayISO,
      transcript,
    });
    // Carry the ids the client resolved during /parse back through the gate.
    const originalById = new Map((Array.isArray(actions) ? actions : []).map((a, i) => [i, a]));
    const validated = gate.actions.map((action, i) => {
      const src = originalById.get(i) || {};
      return {
        ...action,
        assigneeId: action.assigneeId || src.assigneeId || null,
        projectId: action.projectId || src.projectId || null,
        taskId: action.taskId || src.taskId || null,
      };
    });

    const results = {
      projects: [],
      notes: [],
      tasks: [],
      goals: [],
      reminders: [],
      assignments: [],
      errors: [],
      rejected: gate.rejected,
    };

    for (const dropped of gate.rejected) {
      results.errors.push({ action: dropped, error: `Action dropped: ${dropped.reason}` });
    }

    // Resolve default workspace
    const defaultWorkspaceId = workspaceId || req.workspaces.find((w) => w.personal)?.id || req.workspaceIds[0];
    const defaultProject = context.projects.find((p) => p.id === projectId) || context.projects[0] || null;
    // Projects minted earlier in this same request, keyed by lowercase name, so
    // "create a project called Deck ... add goals in it" attaches goals to Deck.
    const createdByName = new Map();

    for (const action of validated) {
      try {
        // Resolve project for this action
        let targetProject = null;
        if (action.projectId) {
          targetProject = context.projects.find((p) => p.id === action.projectId);
        }
        if (!targetProject && action.projectHint) {
          targetProject =
            createdByName.get(action.projectHint.toLowerCase()) ||
            resolveProjectByHint(action.projectHint, context.projects);
        }
        if (!targetProject && projectId) {
          targetProject = context.projects.find((p) => p.id === projectId);
        }
        // Only fall back to the default when nothing was spoken at all.
        if (!targetProject && !action.projectHint && !action.projectId) targetProject = defaultProject;

        // A create_project carries no project of its own.
        if (action.type === "create_project") {
          if (createdByName.has((action.name || "").toLowerCase())) {
            results.errors.push({ action, error: `Project "${action.name}" already requested in this note.` });
            continue;
          }
          const actor = await usersDb.findById(req.userId);
          const project = await projectsDb.create({
            workspaceId: defaultWorkspaceId,
            userId: req.userId,
            name: (action.name || "Voice project").slice(0, 60).trim(),
            description: (action.description || "").trim(),
          });
          createdByName.set(project.name.toLowerCase(), project);
          context.projects.push(project);

          await activityLogDb.log({
            workspaceId: project.workspaceId,
            projectId: project.id,
            actorUserId: req.userId,
            type: "project_created",
            message: `${actor?.name || actor?.email} created project via voice: "${project.name}"`,
          });

          results.projects.push(project);
          // Handled here, outside the switch — move on to the next action.
          continue;
        }

        // Resolve assignee
        let assigneeId = action.assigneeId || null;
        if (!assigneeId && action.assigneeHint) {
          const resolved = resolveAssigneeByHint(action.assigneeHint, context.collaborators);
          if (resolved) assigneeId = resolved.userId;
        }

        switch (action.type) {
          case "create_note": {
            const text = action.text || transcript.slice(0, 500);
            // Save as personal entry + voice note
            const entry = await entriesDb.create({
              userId: req.userId,
              kind: "note",
              text,
              date: context.todayISO,
            });
            results.notes.push(entry);
            break;
          }

          case "create_task": {
            if (!targetProject) {
              results.errors.push({ action, error: "No project available to create task in. Create a project first." });
              break;
            }
            const actor = await usersDb.findById(req.userId);
            // Past due dates are allowed on purpose — people dictate backlog.
            const task = await tasksDb.create({
              projectId: targetProject.id,
              title: (action.title || "Voice task").slice(0, 200).trim(),
              notes: (action.notes || "").trim(),
              goalId: action.goalId || null,
              status: STATUSES.includes(action.status) ? action.status : "todo",
              dueDate: action.dueDate || null,
              completedAt: null,
              assigneeId,
              // Previously the parser extracted priority and this call dropped
              // it on the floor — "high priority" never reached the database.
              priority: PRIORITY_KEYS.includes(action.priority) ? action.priority : "medium",
            });

            // Activity log
            await activityLogDb.log({
              workspaceId: targetProject.workspaceId,
              projectId: targetProject.id,
              actorUserId: req.userId,
              type: "task_created",
              message: `${actor?.name || actor?.email} added task via voice: "${task.title}"`,
            });

            // Notify assignee if assigned
            if (assigneeId && assigneeId !== req.userId) {
              await notificationsDb.create({
                userId: assigneeId,
                workspaceId: targetProject.workspaceId,
                projectId: targetProject.id,
                type: "task_assigned",
                message: `${actor?.name || actor?.email} assigned you "${task.title}" via voice in ${targetProject.name}`,
                link: `/projects/${targetProject.id}`,
              });
            }

            results.tasks.push({ ...task, projectName: targetProject.name });
            break;
          }

          case "create_goal": {
            if (!targetProject) {
              results.errors.push({ action, error: "No project available to create goal in." });
              break;
            }
            const role = req.workspaces.find((w) => w.id === targetProject.workspaceId)?.role;
            if (role === "member") {
              results.errors.push({ action, error: `Only admins can create goals in ${targetProject.name}` });
              break;
            }
            const actor = await usersDb.findById(req.userId);
            const goal = await goalsDb.create({
              projectId: targetProject.id,
              category: CATEGORY_KEYS.includes(action.category) ? action.category : "other",
              platform: (action.platform || "").trim(),
              label: (action.label || "Voice goal").slice(0, 120).trim(),
              targetValue: Number(action.targetValue) || 0,
              currentValue: Number(action.currentValue) || 0,
              unit: (action.unit || "").trim(),
              period: PERIODS.includes(action.period) ? action.period : "monthly",
              step: Number(action.step) || 1,
            });

            await activityLogDb.log({
              workspaceId: targetProject.workspaceId,
              projectId: targetProject.id,
              actorUserId: req.userId,
              type: "goal_created",
              message: `${actor?.name || actor?.email} added goal via voice: "${goal.label}"`,
            });

            results.goals.push({ ...goal, projectName: targetProject.name });
            break;
          }

          case "assign_task": {
            // Find task by hint
            let taskToAssign = null;
            if (action.taskId) {
              for (const proj of context.projects) {
                const t = proj.tasks?.find((x) => x.id === action.taskId);
                if (t) {
                  taskToAssign = { ...t, project: proj };
                  break;
                }
              }
            } else if (action.taskHint) {
              const hintLower = action.taskHint.toLowerCase();
              for (const proj of context.projects) {
                const t = proj.tasks?.find((x) => x.title.toLowerCase().includes(hintLower));
                if (t) {
                  taskToAssign = { ...t, project: proj };
                  break;
                }
              }
            }
            if (!taskToAssign) {
              results.errors.push({ action, error: "Could not find task to assign." });
              break;
            }
            if (!assigneeId) {
              results.errors.push({ action, error: `Could not resolve assignee "${action.assigneeHint || ""}".` });
              break;
            }
            const updated = await tasksDb.update(taskToAssign.id, { assigneeId });
            const actor = await usersDb.findById(req.userId);
            await notificationsDb.create({
              userId: assigneeId,
              workspaceId: taskToAssign.project.workspaceId,
              projectId: taskToAssign.project.id,
              type: "task_assigned",
              message: `${actor?.name || actor?.email} assigned you "${taskToAssign.title}" via voice in ${taskToAssign.project.name}`,
              link: `/projects/${taskToAssign.project.id}`,
            });
            results.assignments.push(updated);
            break;
          }

          case "create_reminder": {
            // 9am in the user's own zone; a fixed T09:00:00Z fired at 2:30pm IST.
            const scheduledAt = action.dueDate
              ? localTimeToISO(action.dueDate, DEFAULT_REMINDER_HOUR, context.timeZone) ||
                new Date(`${action.dueDate}T09:00:00Z`).toISOString()
              : new Date(Date.now() + 60 * 60 * 1000).toISOString(); // default 1 hour
            const reminder = await remindersDb.create({
              userId: req.userId,
              workspaceId: targetProject?.workspaceId || defaultWorkspaceId,
              projectId: targetProject?.id || null,
              type: action.frequency === "once" ? "custom" : "task_progress",
              message: (action.message || "Voice reminder").slice(0, 200),
              link: targetProject ? `/projects/${targetProject.id}` : "/dashboard",
              scheduledAt,
              frequency: action.frequency || "once",
            });
            results.reminders.push(reminder);
            break;
          }

          default:
            results.errors.push({ action, error: `Unknown action type ${action.type}` });
        }
      } catch (innerErr) {
        console.error("Action execute error:", innerErr);
        results.errors.push({ action, error: innerErr.message });
      }
    }

    const created = [
      `${results.projects.length} project${results.projects.length === 1 ? "" : "s"}`,
      `${results.tasks.length} task${results.tasks.length === 1 ? "" : "s"}`,
      `${results.goals.length} goal${results.goals.length === 1 ? "" : "s"}`,
      `${results.notes.length} note${results.notes.length === 1 ? "" : "s"}`,
      `${results.reminders.length} reminder${results.reminders.length === 1 ? "" : "s"}`,
      `${results.assignments.length} assignment${results.assignments.length === 1 ? "" : "s"}`,
    ].join(", ");
    const failedCount = results.errors.length;

    // Save voice note history
    const voiceNote = await voiceNotesDb.create({
      userId: req.userId,
      workspaceId: defaultWorkspaceId,
      projectId: projectId || defaultProject?.id || null,
      transcript,
      // Keep what the AI actually understood, not just a tally of rows written.
      summary: parseSummary ? `${parseSummary} — created ${created}` : `Created ${created}`,
      actions: results,
      rawActions: validated,
    });

    // Also create a general notification that voice processing completed
    if (results.tasks.length > 0 || results.goals.length > 0) {
      await notificationsDb.create({
        userId: req.userId,
        workspaceId: defaultWorkspaceId,
        projectId: defaultProject?.id || null,
        type: "voice_processed",
        message: `Voice note processed: ${results.tasks.length} tasks, ${results.goals.length} goals created`,
        link: defaultProject ? `/projects/${defaultProject.id}` : "/dashboard",
      });
    }

    res.json({
      voiceNote,
      results,
      // A partial failure must not read as success in the UI.
      summary: failedCount > 0 ? `Created ${created} — ${failedCount} item${failedCount === 1 ? "" : "s"} failed` : `Created ${created}`,
      failedCount,
      diagnostics,
    });
  } catch (err) {
    console.error("Voice execute error:", err);
    res.status(500).json({ error: "Failed to execute voice actions." });
  }
});

// GET /api/voice/notes — list user's voice notes
router.get("/notes", async (req, res) => {
  try {
    const notes = await voiceNotesDb.listForUser(req.userId, 50);
    res.json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch voice notes." });
  }
});

// DELETE /api/voice/notes/:id
router.delete("/notes/:id", async (req, res) => {
  try {
    await voiceNotesDb.remove(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not delete voice note." });
  }
});

// GET /api/voice/context — get projects & collaborators for voice UI
router.get("/context", async (req, res) => {
  try {
    const context = await getContextForUser(req);
    res.json({
      projects: context.projects.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        workspaceId: p.workspaceId,
        tags: p.tags,
      })),
      collaborators: context.collaborators.slice(0, 30),
      workspaces: req.workspaces.map((w) => ({ id: w.id, name: w.name, role: w.role })),
      aiEnabled: describeModelConfig().enabled,
      ai: describeModelConfig(),
      assistantName: "Echo",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch context." });
  }
});

module.exports = router;
module.exports.localTimeToISO = localTimeToISO;
module.exports.zoneOffsetMs = zoneOffsetMs;
module.exports.sanitizeTimeZone = sanitizeTimeZone;
