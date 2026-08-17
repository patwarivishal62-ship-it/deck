"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Field, TextInput, Button } from "@/components/FormControls";
import Logo from "@/components/Logo";

function LoginForm() {
  const { login, signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, name.trim());
      }
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/projects");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-12">
      {/* subtle glows */}
      <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[500px] w-[600px] rounded-full bg-[#4F7BFF]/[0.05] blur-[100px]" />

      <div className="relative w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 transition hover:opacity-90" aria-label="DECK home">
          <Logo variant="light" size={36} />
        </Link>

        <div className="rounded-2xl border border-[#232A36] bg-[#161B22] p-7 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          <h1 className="font-display text-xl font-bold tracking-tight text-white">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#B8C0CC]">
            {mode === "login" ? "Sign in to your workspace." : "Start tracking your marketing projects."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            {mode === "signup" && (
              <Field label="Name (optional)">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <TextInput
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>

            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="mb-4 mt-[-8px] inline-block text-xs font-medium text-[#B8C0CC] transition hover:text-[#7C5CFF]"
              >
                Forgot password?
              </Link>
            )}

            {error && <p className="mb-3 rounded-xl bg-[#2E1A1E] px-3 py-2 text-sm text-[#FF5D73] border border-[#FF5D73]/20">{error}</p>}

            <Button type="submit" disabled={busy} className="mt-2 w-full justify-center">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="mt-5 w-full text-center text-sm text-[#B8C0CC] transition hover:text-white"
          >
            {mode === "login" ? (
              <>
                New here? <span className="font-semibold text-[#7C5CFF] hover:text-[#8B6DFF]">Create an account</span>
              </>
            ) : (
              <>
                Already have an account? <span className="font-semibold text-[#7C5CFF] hover:text-[#8B6DFF]">Sign in</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-[#7A8599]">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline decoration-[#232A36] underline-offset-4 hover:text-[#B8C0CC]">
            Terms
          </Link>{" "}
          &{" "}
          <Link href="/privacy-policy" className="underline decoration-[#232A36] underline-offset-4 hover:text-[#B8C0CC]">
            Privacy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
