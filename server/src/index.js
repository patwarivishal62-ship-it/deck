require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./db/mongodb");

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

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
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