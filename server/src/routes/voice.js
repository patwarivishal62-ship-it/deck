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
const { smartParse } = require("../lib/aiParser");
const { CATEGORY_KEYS, PERIODS, PRIORITY_KEYS } = require("../constants");

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

// Strict lookup: a hint only resolves to a project it actually names (id,
// exact name, or a name contained in / containing the hint). Returns null
// otherwise — the caller decides what "no project" means. It must NOT fall
// back to projects[0]: that is how every voice task used to land in
// whichever project happened to be listed first.
function resolveProjectByHint(hint, projects) {
  if (!hint || !Array.isArray(projects) || projects.length === 0) return null;
  const raw = String(hint).trim();
  if (!raw) return null;
  const byId = projects.find((p) => p.id === raw);
  if (byId) return byId;

  const lower = raw.toLowerCase();
  const exact = projects.find((p) => (p.name || "").toLowerCase() === lower);
  if (exact) return exact;

  // Only consider reasonably specific names for fuzzy containment — a
  // two-letter project name would otherwise match almost any hint.
  const fuzzy = projects.filter((p) => {
    const name = (p.name || "").toLowerCase();
    if (name.length < 3) return false;
    return name.includes(lower) || lower.includes(name);
  });
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) {
    // Prefer the longest (most specific) matching name.
    return fuzzy.sort((a, b) => (b.name || "").length - (a.name || "").length)[0];
  }
  return null;
}

// Which project an action should land in. Order of precedence:
//   1. an explicit projectId that the caller can see
//   2. a projectHint that names a real project (or the project we just created)
//   3. the project the user is currently looking at (projectId from the UI)
//   4. a project created earlier in this same voice command
//   5. nothing — never "the first project in the list"
function resolveTargetProject(action, projects, { currentProjectId, createdProject } = {}) {
  if (action.projectId) {
    const found = projects.find((p) => p.id === action.projectId);
    if (found) return found;
    if (createdProject && createdProject.id === action.projectId) return createdProject;
  }
  // The UI marks actions that were pointed at the project being created in
  // this same command — honour that even if the name was edited afterwards.
  if (action.project?.isNew && createdProject) return createdProject;
  if (action.projectHint) {
    const pool = createdProject ? [createdProject, ...projects] : projects;
    const found = resolveProjectByHint(action.projectHint, pool);
    if (found) return found;
  }
  if (currentProjectId) {
    const found = projects.find((p) => p.id === currentProjectId);
    if (found) return found;
  }
  if (createdProject) return createdProject;
  return null;
}

function roleFor(req, workspaceId) {
  return req.workspaces.find((w) => w.id === workspaceId)?.role;
}

async function createProjectFromAction(req, action, { workspaceId }) {
  const name = String(action.name || action.title || "").trim().slice(0, 80);
  if (!name) throw new Error("Project name is required.");
  const role = roleFor(req, workspaceId);
  if (!role) throw new Error("You don't have access to that workspace.");

  const project = await projectsDb.create({
    workspaceId,
    userId: req.userId,
    name,
    description: String(action.description || "").trim(),
    tags: Array.isArray(action.tags) ? action.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    priority: PRIORITY_KEYS.includes(action.priority) ? action.priority : "medium",
    dueDate: action.dueDate || null,
    memberAccess: role === "member" ? [req.userId] : [],
  });

  const creator = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "project_created",
    message: `${creator?.name || creator?.email} created this project via voice`,
  });

  const workspaceMembers = await membershipsDb.listByWorkspace(workspaceId);
  const notifyRecipients = workspaceMembers
    .filter((m) => m.status === "active" && m.userId && m.userId !== req.userId)
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map((m) => ({
      userId: m.userId,
      workspaceId,
      projectId: project.id,
      type: "project_created",
      message: `${creator?.name || creator?.email} created "${project.name}" via voice`,
      link: `/projects/${project.id}`,
    }));
  await notificationsDb.createMany(notifyRecipients);

  return project;
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

    // A project created in this transcript becomes the default home for the
    // goals/tasks spoken alongside it. It doesn't exist yet, so those actions
    // keep the *name* as projectHint and the execute step resolves it after
    // the project row is inserted.
    const newProjectAction = result.actions.find((a) => a.type === "create_project");
    const newProjectName = newProjectAction && !newProjectAction.needsName ? String(newProjectAction.name || "").trim() : null;
    const isNewProjectHint = (hint) => Boolean(newProjectName && hint && String(hint).trim().toLowerCase() === newProjectName.toLowerCase());

    const enriched = result.actions.map((action) => {
      const enrichedAction = { ...action };

      if (action.assigneeHint) {
        const resolved = resolveAssigneeByHint(action.assigneeHint, context.collaborators);
        if (resolved) {
          enrichedAction.assignee = resolved;
          enrichedAction.assigneeId = resolved.userId;
        }
      }

      if (action.type === "create_project") {
        enrichedAction.workspaceId = workspaceId || req.workspaces.find((w) => w.personal)?.id || req.workspaceIds[0];
        return enrichedAction;
      }

      if (action.type === "create_task" || action.type === "create_goal" || action.type === "create_reminder") {
        if (isNewProjectHint(action.projectHint)) {
          // Keep the hint as the (not yet existing) project's name.
          enrichedAction.projectHint = newProjectName;
          enrichedAction.project = { id: null, name: newProjectName, isNew: true };
          delete enrichedAction.projectId;
          delete enrichedAction.workspaceId;
          return enrichedAction;
        }

        const proj = resolveTargetProject(action, context.projects, { currentProjectId: projectId });
        if (proj) {
          enrichedAction.project = { id: proj.id, name: proj.name };
          enrichedAction.projectId = proj.id;
          enrichedAction.workspaceId = proj.workspaceId;
        } else if (newProjectName) {
          enrichedAction.projectHint = newProjectName;
          enrichedAction.project = { id: null, name: newProjectName, isNew: true };
          delete enrichedAction.projectId;
        } else {
          // No project named, none open, none being created: leave it
          // unassigned so the UI can ask instead of silently guessing.
          delete enrichedAction.projectId;
          enrichedAction.project = null;
        }
      }

      return enrichedAction;
    });

    res.json({
      transcript,
      cleaned: result.cleaned || transcript,
      summary: result.summary,
      actions: enriched,
      newProjectName,
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
      projects: [],
      notes: [],
      tasks: [],
      goals: [],
      reminders: [],
      assignments: [],
      errors: [],
    };

    // Resolve default workspace
    const defaultWorkspaceId = workspaceId || req.workspaces.find((w) => w.personal)?.id || req.workspaceIds[0];
    // The project the user is currently viewing (if any). This is the ONLY
    // implicit default — we never fall back to "first project in the list".
    const currentProject = projectId ? context.projects.find((p) => p.id === projectId) || null : null;

    // First pass: create any new project(s) so the goals/tasks that follow
    // can be attached to them by name.
    let createdProject = null;
    const projectActions = actionsToExecute.filter((a) => a && a.type === "create_project");
    const otherActions = actionsToExecute.filter((a) => a && a.type !== "create_project");
    const createdProjects = [];
    for (const action of projectActions) {
      try {
        const project = await createProjectFromAction(req, action, {
          workspaceId: action.workspaceId || defaultWorkspaceId,
        });
        createdProjects.push(project);
        context.projects.unshift(project);
        if (!createdProject) createdProject = project;
      } catch (innerErr) {
        console.error("Project create error:", innerErr);
        results.errors.push({ action, error: innerErr.message });
      }
    }
    results.projects = createdProjects.map((p) => ({ id: p.id, name: p.name, workspaceId: p.workspaceId }));

    for (const action of otherActions) {
      try {
        // Resolve project for this action
        const targetProject = resolveTargetProject(action, context.projects, {
          currentProjectId: currentProject?.id || null,
          createdProject,
        });

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
              results.errors.push({
                action,
                error: action.projectHint
                  ? `Couldn't find a project matching "${action.projectHint}" for task "${action.title}".`
                  : `No project chosen for task "${action.title}". Say the project name or open a project first.`,
              });
              break;
            }
            // Voice is forgiving about dates: a past date is kept as spoken
            // (the user may be dictating something already overdue).
            const dueDate = action.dueDate || null;
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
              results.errors.push({
                action,
                error: action.projectHint
                  ? `Couldn't find a project matching "${action.projectHint}" for goal "${action.label}".`
                  : `No project chosen for goal "${action.label}". Say the project name or open a project first.`,
              });
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
            const assignPatch = { assigneeId };
            if (action.dueDate) assignPatch.dueDate = action.dueDate;
            const updated = await tasksDb.update(taskToAssign.id, assignPatch);
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

    const homeProject = createdProject || currentProject || null;
    const summaryParts = [];
    if (results.projects.length) summaryParts.push(`${results.projects.length} project${results.projects.length > 1 ? "s" : ""}`);
    if (results.goals.length) summaryParts.push(`${results.goals.length} goal${results.goals.length > 1 ? "s" : ""}`);
    if (results.tasks.length) summaryParts.push(`${results.tasks.length} task${results.tasks.length > 1 ? "s" : ""}`);
    if (results.notes.length) summaryParts.push(`${results.notes.length} note${results.notes.length > 1 ? "s" : ""}`);
    if (results.reminders.length) summaryParts.push(`${results.reminders.length} reminder${results.reminders.length > 1 ? "s" : ""}`);
    if (results.assignments.length) summaryParts.push(`${results.assignments.length} assignment${results.assignments.length > 1 ? "s" : ""}`);
    const summary = summaryParts.length ? `Created ${summaryParts.join(", ")}` : "Nothing was created";

    // Save voice note history
    const voiceNote = await voiceNotesDb.create({
      userId: req.userId,
      workspaceId: homeProject?.workspaceId || defaultWorkspaceId,
      projectId: homeProject?.id || null,
      transcript,
      summary: `${summary} from voice`,
      actions: results,
      rawActions: actionsToExecute,
    });

    // Also create a general notification that voice processing completed
    if (results.tasks.length > 0 || results.goals.length > 0 || results.projects.length > 0) {
      await notificationsDb.create({
        userId: req.userId,
        workspaceId: homeProject?.workspaceId || defaultWorkspaceId,
        projectId: homeProject?.id || null,
        type: "voice_processed",
        message: `Voice note processed: ${summary.replace(/^Created /, "")}`,
        link: homeProject ? `/projects/${homeProject.id}` : "/dashboard",
      });
    }

    res.json({
      voiceNote,
      results,
      summary: results.errors.length ? `${summary} (${results.errors.length} skipped)` : summary,
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
