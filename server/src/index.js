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
const workspaceRoutes = require("./routes/workspaces");

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