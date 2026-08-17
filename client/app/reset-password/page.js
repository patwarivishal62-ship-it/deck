"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, TextInput, Button } from "@/components/FormControls";
import Logo from "@/components/Logo";
import { useTheme } from "@/lib/ThemeContext";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const { theme } = useTheme();
  const logoVariant = theme === "dark" ? "light" : "dark";
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
    <div className="relative flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />
      <div className="w-full max-w-sm relative">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 transition hover:opacity-90">
          <Logo variant={logoVariant} size={32} />
        </Link>

        <div className="rounded-2xl border border-line bg-card p-7 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          {!token ? (
            <>
              <h1 className="font-display text-lg font-bold tracking-tight text-text">Invalid link</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-soft">This reset link is missing its token. Request a new one from the sign-in page.</p>
              <Link href="/forgot-password" className="mt-6 inline-flex w-full justify-center rounded-full bg-signal px-4 py-2.5 text-sm font-semibold text-white hover:bg-signal-deep">
                Request a new link
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className="font-display text-lg font-bold tracking-tight text-text">Password updated</h1>
              <p className="mt-2 text-sm text-text-soft">Taking you to sign in…</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-lg font-bold tracking-tight text-text">Choose a new password</h1>
              <p className="mb-5 mt-1.5 text-sm text-text-soft">Make it at least 6 characters.</p>
              <form onSubmit={handleSubmit}>
                <Field label="New password">
                  <TextInput type="password" required autoFocus minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                </Field>
                <Field label="Confirm new password">
                  <TextInput type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Password" />
                </Field>
                {error && <p className="mb-3 rounded-xl bg-[#2E1A1E] border border-[#FF5D73]/20 px-3 py-2 text-sm text-[#FF5D73]">{error}</p>}
                <Button type="submit" disabled={busy} className="mt-2 w-full justify-center">
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
