const express = require("express");
const usersDb = require("../db/users");
const projectsDb = require("../db/projects");
const deletionRequestsDb = require("../db/deletionRequests");
const { requireAuth } = require("../middleware/auth");
const { sendAccountDeletedEmail } = require("../lib/email");

const router = express.Router();
router.use(requireAuth);

// Must match the cookie options used when the cookie was set (routes/auth.js),
// or clearCookie won't actually remove it in the browser.
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
};

// Deletes the account, all of its projects/goals/tasks, and signs the user
// out — immediately and irreversibly. An audit record is still kept
// (db/deletionRequests.js) and the admin is notified by email.
router.delete("/me", async (req, res) => {
  try {
    const user = await usersDb.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Not signed in." });

    const { reason } = req.body || {};

    await deletionRequestsDb.create({
      userId: user.id,
      fullName: user.name,
      email: user.email,
      reason: (reason || "").trim(),
    });

    await projectsDb.removeByUser(user.id);
    await usersDb.deleteById(user.id);

    res.clearCookie("deck_token", COOKIE_OPTS);

    // A failed email shouldn't undo the deletion that already happened —
    // the account is gone either way, the email is just a courtesy notice.
    try {
      await sendAccountDeletedEmail({
        fullName: user.name,
        email: user.email,
        reason: (reason || "").trim(),
        requestedAt: new Date().toISOString(),
      });
    } catch (emailErr) {
      console.error("Failed to send account-deleted admin email:", emailErr);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete account." });
  }
});

module.exports = router;
