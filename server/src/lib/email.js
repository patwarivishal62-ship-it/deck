// Sends transactional email via Resend (https://resend.com). Uses the
// built-in fetch (Node 18+), so no extra npm package is needed.
//
// Required env vars:
//   RESEND_API_KEY — from Resend dashboard > API Keys
//   ADMIN_EMAIL    — where deletion-request notifications get sent
//
// Sends from a verified domain (planyourdeck.com), so this can deliver to
// any recipient — not just the address that owns the Resend account.
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set — skipping email send.");
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Deck <contact@planyourdeck.com>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return res.json();
}

async function sendAccountDeletedEmail({ fullName, email, reason, requestedAt }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("ADMIN_EMAIL is not set — skipping account-deletion notification.");
    return { skipped: true };
  }

  const html = `
    <h2>Account Deleted – Deck</h2>
    <p>The following account was deleted immediately by its owner:</p>
    <p><strong>Full Name:</strong> ${fullName || "(not set)"}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Reason given:</strong> ${reason ? reason : "(none given)"}</p>
    <p><strong>Deleted At:</strong> ${new Date(requestedAt).toLocaleString()}</p>
  `.trim();

  return sendEmail({
    to: adminEmail,
    subject: "Account Deleted – Deck",
    html,
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const html = `
    <h2>Reset your Deck password</h2>
    <p>We got a request to reset the password on your Deck account.</p>
    <p><a href="${resetUrl}">Click here to choose a new password</a>. This link expires in 1 hour.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `.trim();

  return sendEmail({
    to,
    subject: "Reset your Deck password",
    html,
  });
}

async function sendWorkspaceInviteEmail({ to, workspaceName, inviterName, inviteUrl }) {
  const html = `
    <h2>You've been invited to a Deck workspace</h2>
    <p>${inviterName || "Someone"} invited you to join <strong>${workspaceName}</strong> on Deck.</p>
    <p><a href="${inviteUrl}">Click here to accept the invite</a>.</p>
    <p>If you weren't expecting this, you can ignore this email.</p>
  `.trim();

  return sendEmail({
    to,
    subject: `You've been invited to ${workspaceName} on Deck`,
    html,
  });
}

module.exports = { sendEmail, sendAccountDeletedEmail, sendPasswordResetEmail, sendWorkspaceInviteEmail };
