"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, TextInput, Button } from "@/components/FormControls";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 transition hover:opacity-80">
          <span className="h-2 w-2 animate-pulse_dot rounded-full bg-signal" />
          <span className="font-display text-xl font-semibold text-white">Deck</span>
        </Link>

        <div className="rounded-card bg-card p-6 shadow-2xl">
          {sent ? (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">Check your email</h1>
              <p className="text-sm text-text-soft">
                If an account exists for <strong>{email.trim()}</strong>, a password reset link is on its
                way. The link expires in an hour.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-block text-sm text-signal-deep underline underline-offset-2"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">Reset your password</h1>
              <p className="mb-5 text-sm text-text-soft">
                Enter your email and we&rsquo;ll send you a link to choose a new password.
              </p>
              <form onSubmit={handleSubmit}>
                <Field label="Email">
                  <TextInput
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                  />
                </Field>
                {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
                <Button type="submit" disabled={busy} className="mt-2 w-full">
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <Link
                href="/login"
                className="mt-4 block text-center text-sm text-text-soft hover:text-signal-deep"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
