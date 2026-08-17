"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, TextInput, Button } from "@/components/FormControls";
import Logo from "@/components/Logo";
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
    <div className="relative flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-12">
      <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />
      <div className="w-full max-w-sm relative">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 transition hover:opacity-90">
          <Logo variant="light" size={32} />
        </Link>

        <div className="rounded-2xl border border-[#232A36] bg-[#161B22] p-7 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          {sent ? (
            <>
              <h1 className="font-display text-lg font-bold tracking-tight text-white">Check your email</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#B8C0CC]">
                If an account exists for <strong className="text-white">{email.trim()}</strong>, a password reset link is on its way. The link
                expires in an hour.
              </p>
              <Link href="/login" className="mt-6 inline-flex items-center justify-center w-full rounded-full bg-[#7C5CFF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6A44FF]">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-lg font-bold tracking-tight text-white">Reset your password</h1>
              <p className="mt-1.5 text-sm text-[#B8C0CC]">Enter your email and we&apos;ll send you a link to choose a new password.</p>
              <form onSubmit={handleSubmit} className="mt-6">
                <Field label="Email">
                  <TextInput type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                </Field>
                {error && <p className="mb-3 rounded-xl bg-[#2E1A1E] border border-[#FF5D73]/20 px-3 py-2 text-sm text-[#FF5D73]">{error}</p>}
                <Button type="submit" disabled={busy} className="mt-2 w-full justify-center">
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <Link href="/login" className="mt-4 block text-center text-sm text-[#B8C0CC] hover:text-white">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
