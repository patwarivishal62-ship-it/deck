// Sends transactional email via Resend (https://resend.com). Uses the
// built-in fetch (Node 18+), so no extra npm package is needed.
//
// Required env vars:
//   RESEND_API_KEY — from Resend dashboard > API Keys
//   ADMIN_EMAIL    — where deletion-request notifications get sent
//
// Without a verified custom domain on Resend, emails can only be sent to the
// address that owns the Resend account — which is fine here, since that's
// the same address as ADMIN_EMAIL.
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
      from: "Deck <onboarding@resend.dev>",
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

async function sendDeletionRequestEmail({ fullName, email, reason, requestedAt }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("ADMIN_EMAIL is not set — skipping deletion request notification.");
    return { skipped: true };
  }

  const html = `
    <h2>New Account Deletion Request – Deck</h2>
    <p><strong>Full Name:</strong> ${fullName || "(not set)"}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Reason:</strong> ${reason ? reason : "(none given)"}</p>
    <p><strong>Requested Date:</strong> ${new Date(requestedAt).toLocaleString()}</p>
  `.trim();

  return sendEmail({
    to: adminEmail,
    subject: "New Account Deletion Request – Deck",
    html,
  });
}

module.exports = { sendEmail, sendDeletionRequestEmail };
