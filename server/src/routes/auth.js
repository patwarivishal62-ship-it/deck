const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usersDb = require("../db/users");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await usersDb.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await usersDb.create({
      email: normalizedEmail,
      passwordHash,
      name: name?.trim() || null,
    });

    const token = signToken(user.id);
    res.cookie("deck_token", token, COOKIE_OPTS);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await usersDb.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = signToken(user.id);
    res.cookie("deck_token", token, COOKIE_OPTS);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not sign in." });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("deck_token", { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await usersDb.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(user) });
});

module.exports = router;
