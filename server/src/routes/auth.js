const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usersDb = require("../db/users");
const { requireAuth } = require("../middleware/auth");
const { authLimiter, passwordResetLimiter } = require("../middleware/rateLimit");
const { sendPasswordResetEmail } = require("../lib/email");

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

router.post("/signup", authLimiter, async (req, res) => {
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

router.post("/login", authLimiter, async (req, res) => {
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

// Always responds the same way whether or not the email exists, so this
// endpoint can't be used to check which emails have accounts.
router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await usersDb.findByEmail(email.toLowerCase().trim());
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      await usersDb.setResetToken(user.id, tokenHash, expiresAt);

      const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
      const resetUrl = `${clientOrigin}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail({ to: user.email, resetUrl });
      } catch (emailErr) {
        console.error("Failed to send password reset email:", emailErr);
      }
    }

    res.json({ ok: true, message: "If that email has an account, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process request." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await usersDb.findByResetTokenHash(tokenHash);

    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await usersDb.updatePasswordHash(user.id, passwordHash);
    await usersDb.clearResetToken(user.id);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset password." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await usersDb.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(user) });
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (name !== undefined && typeof name !== "string") {
      return res.status(400).json({ error: "Name must be text." });
    }
    const updated = await usersDb.updateName(req.userId, name?.trim() || null);
    if (!updated) return res.status(401).json({ error: "Not signed in." });
    res.json({ user: publicUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update profile." });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const user = await usersDb.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Not signed in." });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await usersDb.updatePasswordHash(user.id, passwordHash);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not change password." });
  }
});

module.exports = router;
