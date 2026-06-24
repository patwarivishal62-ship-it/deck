require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const goalRoutes = require("./routes/goals");
const taskRoutes = require("./routes/tasks");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
// Goals and tasks are nested under /api/projects/:projectId/... inside their own routers.
app.use("/api/projects", goalRoutes);
app.use("/api/projects", taskRoutes);

// Centralized fallback error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Deck API listening on http://localhost:${PORT}`);
});
