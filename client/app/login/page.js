"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Field, TextInput, Button } from "@/components/FormControls";

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
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 transition hover:opacity-80"
        >
          <span className="h-2 w-2 animate-pulse_dot rounded-full bg-signal" />
          <span className="font-display text-xl font-semibold text-white">Deck</span>
        </Link>

        <div className="rounded-card bg-card p-6 shadow-2xl">
          <h1 className="mb-1 font-display text-lg font-semibold text-text">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mb-5 text-sm text-text-soft">
            {mode === "login" ? "Sign in to your projects." : "Start tracking your marketing projects."}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <Field label="Name (optional)">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
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
              />
            </Field>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="mb-3 mt-[-8px] inline-block text-xs text-text-soft hover:text-signal-deep"
              >
                Forgot password?
              </Link>
            )}

            {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}

            <Button type="submit" disabled={busy} className="mt-2 w-full">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="mt-4 w-full text-center text-sm text-text-soft hover:text-signal-deep"
          >
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
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
