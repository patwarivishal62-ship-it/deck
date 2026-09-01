const express = require("express");
const projectsDb = require("../db/projects");
const entriesDb = require("../db/personalEntries");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

// Returns every calendar-relevant event across every project the caller can
// see — task deadlines, project launch dates, and milestones — with no
// month filtering server-side. The dataset per user is small at this app's
// scale, so it's simpler (and lets the client flip between months with no
// extra requests) to return everything once and let the calendar view
// organize it by month for display.
router.get("/", async (req, res) => {
  const projects = await projectsDb.listForCaller(
    {
      fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
      restrictedWorkspaceIds: req.restrictedWorkspaceIds,
      userId: req.userId,
    },
    { archived: false }
  );

  const events = [];

  for (const project of projects) {
    if (project.dueDate) {
      events.push({
        id: `launch-${project.id}`,
        type: "launch",
        date: project.dueDate,
        title: project.name,
        projectId: project.id,
        projectName: project.name,
      });
    }

    for (const task of project.tasks) {
      if (task.dueDate && task.status !== "done") {
        events.push({
          id: `deadline-${task.id}`,
          type: "deadline",
          date: task.dueDate,
          title: task.title,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }

    for (const milestone of project.milestones || []) {
      events.push({
        id: `milestone-${milestone.id}`,
        type: "milestone",
        date: milestone.date,
        title: milestone.title,
        notes: milestone.notes,
        projectId: project.id,
        projectName: project.name,
      });
    }
  }

  // Personal notes & to-dos — private to the caller, attached to the day they
  // were logged. Surfacing them here turns the calendar into a record of what
  // the user noted down and completed on each day.
  const entries = await entriesDb.listForUser(req.userId);
  for (const entry of entries) {
    events.push({
      id: `personal-${entry.id}`,
      type: entry.kind, // "note" | "todo"
      date: entry.date,
      title: entry.text,
      done: entry.done,
      personal: true,
      entryId: entry.id,
    });
  }

  res.json({ events });
});

module.exports = router;
