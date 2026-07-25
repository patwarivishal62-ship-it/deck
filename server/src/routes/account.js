const express = require("express");
const usersDb = require("../db/users");
const deletionRequestsDb = require("../db/deletionRequests");
const { requireAuth } = require("../middleware/auth");
const { sendDeletionRequestEmail } = require("../lib/email");

const router = express.Router();
router.use(requireAuth);

// Note: this does NOT delete the account. It records a request for an admin
// to review, per the "no immediate deletion" requirement, and notifies the
// admin by email (via Resend — see lib/email.js).
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

    // A failed email shouldn't fail the request itself — the record is what
    // matters, the email is a courtesy notification on top of it.
    try {
      await sendDeletionRequestEmail({
        fullName: request.fullName,
        email: request.email,
        reason: request.reason,
        requestedAt: request.requestedAt,
      });
    } catch (emailErr) {
      console.error("Failed to send deletion-request admin email:", emailErr);
    }

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
