const rateLimit = require("express-rate-limit");

// Applied per-IP (req.ip), which requires app.set("trust proxy", 1) in
// index.js so it reads the real client IP behind Render's proxy rather than
// Render's own load balancer IP for every request.

// Login/signup: generous enough for a real person mistyping a password a
// few times, tight enough to blunt automated credential-stuffing/brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

// Password reset requests send an email — a much stricter limit here mostly
// prevents someone from spamming an inbox rather than guarding a secret.
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reset requests. Please wait a while and try again." },
});

module.exports = { authLimiter, passwordResetLimiter };
