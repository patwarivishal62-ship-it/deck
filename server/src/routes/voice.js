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
const { smartParse, parseTranscript } = require("../lib/aiParser");
const { CATEGORY_KEYS, PERIODS } = require("../constants");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
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

function resolveAssigneeByHint(hint, collaborators) {
  if (!hint) return null;
  const lowerHint = hint.toLowerCase().trim();
  // Exact email match
  const byEmail = collaborators.find((c) => c.email && c.email.toLowerCase() === lowerHint);
  if (byEmail) return byEmail;
  // Exact name match
  const byName = collaborators.find((c) => c.name && c.name.toLowerCase() === lowerHint);
  if (byName) return byName;
  // First name match
  const firstName = lowerHint.split(" ")[0];
  const byFirst = collaborators.find((c) => {
    const name = (c.name || "").toLowerCase();
    return name.startsWith(firstName) || name.split(" ")[0] === firstName;
  });
  if (byFirst) return byFirst;
  // Partial
  const partial = collaborators.find((c) => {
    const name = (c.name || "").toLowerCase();
    const email = (c.email || "").toLowerCase();
    return name.includes(lowerHint) || email.includes(lowerHint);
  });
  return partial || null;
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
  return byName || projects[0] || null;
}

// POST /api/voice/parse — parse transcript without executing
router.post("/parse", async (req, res) => {
  const { transcript, projectId, workspaceId } = req.body || {};
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Transcript is required." });
  }
  if (transcript.length > 5000) {
    return res.status(400).json({ error: "Transcript too long (max 5000 chars)." });
  }

  try {
    const context = await getContextForUser(req);
    if (projectId) context.currentProjectId = projectId;

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
      }
      if (action.projectHint || action.projectId || projectId) {
        const proj = resolveProjectByHint(action.projectHint || action.projectId || projectId, context.projects, projectId);
        if (proj) {
          enrichedAction.project = { id: proj.id, name: proj.name };
          enrichedAction.projectId = proj.id;
          enrichedAction.workspaceId = proj.workspaceId;
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
  const { transcript, actions, projectId, workspaceId } = req.body || {};
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Transcript is required." });
  }

  try {
    const context = await getContextForUser(req);
    let actionsToExecute = actions;

    // If no actions provided, parse transcript now
    if (!actionsToExecute || actionsToExecute.length === 0) {
      const parsed = await smartParse(transcript, { ...context, currentProjectId: projectId });
      actionsToExecute = parsed.actions;
    }

    const results = {
      notes: [],
      tasks: [],
      goals: [],
      reminders: [],
      assignments: [],
      errors: [],
    };

    // Resolve default workspace
    const defaultWorkspaceId = workspaceId || req.workspaces.find((w) => w.personal)?.id || req.workspaceIds[0];
    const defaultProject = context.projects.find((p) => p.id === projectId) || context.projects[0] || null;

    for (const action of actionsToExecute) {
      try {
        // Resolve project for this action
        let targetProject = null;
        if (action.projectId) {
          targetProject = context.projects.find((p) => p.id === action.projectId);
        } else if (action.projectHint) {
          targetProject = resolveProjectByHint(action.projectHint, context.projects);
        } else if (projectId) {
          targetProject = context.projects.find((p) => p.id === projectId);
        }
        if (!targetProject) targetProject = defaultProject;

        // Resolve assignee
        let assigneeId = action.assigneeId || null;
        if (!assigneeId && action.assigneeHint) {
          const resolved = resolveAssigneeByHint(action.assigneeHint, context.collaborators);
          if (resolved) assigneeId = resolved.userId;
        }

        switch (action.type) {
          case "create_note": {
            const text = action.text || action.title || transcript.slice(0, 500);
            // Save as personal entry + voice note
            const entry = await entriesDb.create({
              userId: req.userId,
              kind: "note",
              text,
              date: todayISODate(),
            });
            results.notes.push(entry);
            break;
          }

          case "create_task": {
            if (!targetProject) {
              results.errors.push({ action, error: "No project available to create task in. Create a project first." });
              break;
            }
            // Check due date not in past unless it's today
            let dueDate = action.dueDate || null;
            if (dueDate && dueDate < todayISODate()) {
              // If it's a past date but user said it, keep it but don't block — voice should be forgiving
              // For MVP, allow past dates from voice (user might be dictating old tasks)
            }
            const task = await tasksDb.create({
              projectId: targetProject.id,
              title: (action.title || "Voice task").slice(0, 200).trim(),
              notes: (action.notes || "").trim(),
              goalId: action.goalId || null,
              status: action.status || "todo",
              dueDate,
              completedAt: null,
              assigneeId,
            });

            // Activity log
            const actor = await usersDb.findById(req.userId);
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
            const goal = await goalsDb.create({
              projectId: targetProject.id,
              category: CATEGORY_KEYS.includes(action.category) ? action.category : "other",
              platform: (action.platform || "").trim(),
              label: (action.label || action.title || "Voice goal").slice(0, 120).trim(),
              targetValue: Number(action.targetValue) || 0,
              currentValue: Number(action.currentValue) || 0,
              unit: (action.unit || "").trim(),
              period: PERIODS.includes(action.period) ? action.period : "monthly",
              step: Number(action.step) || 1,
            });

            const actor = await usersDb.findById(req.userId);
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
              results.errors.push({ action, error: "Could not resolve assignee." });
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
            const scheduledAt = action.dueDate
              ? new Date(`${action.dueDate}T09:00:00Z`).toISOString()
              : new Date(Date.now() + 60 * 60 * 1000).toISOString(); // default 1 hour
            const reminder = await remindersDb.create({
              userId: req.userId,
              workspaceId: targetProject?.workspaceId || defaultWorkspaceId,
              projectId: targetProject?.id || null,
              type: action.frequency === "once" ? "custom" : "task_progress",
              message: (action.message || action.text || "Voice reminder").slice(0, 200),
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

    // Save voice note history
    const voiceNote = await voiceNotesDb.create({
      userId: req.userId,
      workspaceId: defaultWorkspaceId,
      projectId: projectId || defaultProject?.id || null,
      transcript,
      summary: `${results.tasks.length} tasks, ${results.goals.length} goals, ${results.notes.length} notes from voice`,
      actions: results,
      rawActions: actionsToExecute,
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
      summary: `Created ${results.tasks.length} tasks, ${results.goals.length} goals, ${results.notes.length} notes`,
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch context." });
  }
});

module.exports = router;
