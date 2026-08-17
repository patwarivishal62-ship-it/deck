"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, TextInput, Button } from "@/components/FormControls";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      await api.resetPassword({ token, newPassword: password });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
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
          {!token ? (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">Invalid link</h1>
              <p className="text-sm text-text-soft">
                This reset link is missing its token. Request a new one from the sign-in page.
              </p>
              <Link
                href="/forgot-password"
                className="mt-5 inline-block text-sm text-signal-deep underline underline-offset-2"
              >
                Request a new link
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">Password updated</h1>
              <p className="text-sm text-text-soft">Taking you to sign in…</p>
            </>
          ) : (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">Choose a new password</h1>
              <p className="mb-5 text-sm text-text-soft">Make it at least 6 characters.</p>
              <form onSubmit={handleSubmit}>
                <Field label="New password">
                  <TextInput
                    type="password"
                    required
                    autoFocus
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                  />
                </Field>
                <Field label="Confirm new password">
                  <TextInput
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Password"
                  />
                </Field>
                {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
                <Button type="submit" disabled={busy} className="mt-2 w-full">
                  {busy ? "Saving…" : "Reset password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
