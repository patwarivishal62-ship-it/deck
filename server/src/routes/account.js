const express = require("express");
const usersDb = require("../db/users");
const deletionRequestsDb = require("../db/deletionRequests");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Note: this does NOT delete the account. It records a request for an admin
// to review, per the "no immediate deletion" requirement. Wiring up an actual
// admin notification email needs an email provider (e.g. Resend, SendGrid) —
// EMAIL_FROM / provider API key env vars would go here once one is chosen.
router.post("/deletion-request", async (req, res) => {
  try {
    const user = await usersDb.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Not signed in." });

    const existing = await deletionRequestsDb.findPendingByUser(user.id);
    if (existing) {
      return res.status(409).json({ error: "You already have a pending deletion request." });
    }

    const { reason } = req.body || {};
    const request = await deletionRequestsDb.create({
      userId: user.id,
      fullName: user.name,
      email: user.email,
      reason: (reason || "").trim(),
    });

    res.status(201).json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit deletion request." });
  }
});

router.get("/deletion-request", async (req, res) => {
  const request = await deletionRequestsDb.findPendingByUser(req.userId);
  res.json({ request });
});

module.exports = router;
