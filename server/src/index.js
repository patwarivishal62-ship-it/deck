require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./db/mongodb");

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");
const projectRoutes = require("./routes/projects");
const goalRoutes = require("./routes/goals");
const taskRoutes = require("./routes/tasks");
const commentRoutes = require("./routes/comments");
const fileRoutes = require("./routes/files");
const milestoneRoutes = require("./routes/milestones");
const metricRoutes = require("./routes/metrics");
const calendarRoutes = require("./routes/calendar");
const notificationRoutes = require("./routes/notifications");
const workspaceRoutes = require("./routes/workspaces");
const brandingRoutes = require("./routes/branding");
const personalRoutes = require("./routes/personal");
const voiceRoutes = require("./routes/voice");
const reminderRoutes = require("./routes/reminders");

const app = express();

// Render sits behind a reverse proxy — without this, rate limiting (and
// anything else relying on req.ip) would see Render's proxy IP for every
// request instead of the real client IP.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", goalRoutes);
app.use("/api/projects", taskRoutes);
app.use("/api/projects", commentRoutes);
app.use("/api/projects", fileRoutes);
app.use("/api/projects", milestoneRoutes);
app.use("/api/projects", metricRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/branding", brandingRoutes);
app.use("/api/personal", personalRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/reminders", reminderRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Something went wrong on the server.",
  });
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectDB();

    // Background job: process due reminders every 60 seconds
    // Works even on free tier because it's an interval inside the server process,
    // not a separate cron. When the server restarts, it resumes.
    try {
      const remindersDb = require("./db/reminders");
      const notificationsDb = require("./db/notifications");
      setInterval(async () => {
        try {
          const due = await remindersDb.listDue(new Date().toISOString());
          for (const reminder of due) {
            await notificationsDb.create({
              userId: reminder.userId,
              workspaceId: reminder.workspaceId,
              projectId: reminder.projectId,
              type: reminder.type,
              message: reminder.message,
              link: reminder.link,
            });
            await remindersDb.markSent(reminder.id);
          }
          if (due.length > 0) {
            console.log(`⏰ Processed ${due.length} due reminders`);
          }
        } catch (e) {
          console.error("Reminder background job failed:", e);
        }
      }, 60 * 1000);
      console.log("⏰ Reminder background job scheduled (every 60s)");
    } catch (e) {
      console.warn("Could not start reminder job:", e.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Deck API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB");
    console.error(err);
    process.exit(1);
  }
}

startServer();
