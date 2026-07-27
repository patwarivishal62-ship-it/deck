"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/FormControls";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(true);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadingPreview(false);
      return;
    }
    api
      .previewInvite(token)
      .then((data) => setPreview(data))
      .catch((err) => setPreviewError(err.message))
      .finally(() => setLoadingPreview(false));
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError("");
    try {
      await api.acceptInvite(token);
      setAccepted(true);
      setTimeout(() => router.replace("/projects"), 1500);
    } catch (err) {
      setAcceptError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  const emailMismatch = user && preview && user.email.toLowerCase() !== preview.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 transition hover:opacity-80">
          <span className="h-2 w-2 animate-pulse_dot rounded-full bg-signal" />
          <span className="font-display text-xl font-semibold text-white">Deck</span>
        </Link>

        <div className="rounded-card bg-card p-6 shadow-2xl">
          {!token || previewError ? (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">Invalid invite</h1>
              <p className="text-sm text-text-soft">
                {previewError || "This invite link is missing its token."} It may have already been used or
                expired.
              </p>
            </>
          ) : loadingPreview || authLoading ? (
            <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
          ) : accepted ? (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">You're in!</h1>
              <p className="text-sm text-text-soft">Taking you to your projects…</p>
            </>
          ) : (
            <>
              <h1 className="mb-1 font-display text-lg font-semibold text-text">You've been invited</h1>
              <p className="mb-5 text-sm text-text-soft">
                Join <strong>{preview.workspaceName}</strong> as {preview.role === "admin" ? "an" : "a"}{" "}
                {preview.role}.
              </p>

              {!user ? (
                <>
                  <p className="mb-3 text-sm text-text-soft">
                    Sign in or create an account with <strong>{preview.email}</strong> to accept.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/login?email=${encodeURIComponent(preview.email)}&next=${encodeURIComponent(
                        `/invite/accept?token=${token}`
                      )}`}
                      className="flex-1"
                    >
                      <Button variant="secondary" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                    <Link
                      href={`/login?mode=signup&email=${encodeURIComponent(
                        preview.email
                      )}&next=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
                      className="flex-1"
                    >
                      <Button className="w-full">Sign up</Button>
                    </Link>
                  </div>
                  <p className="mt-3 text-xs text-text-faint">
                    You'll be brought back here after you sign in.
                  </p>
                </>
              ) : emailMismatch ? (
                <p className="text-sm text-signal-deep">
                  You're signed in as {user.email}, but this invite was sent to {preview.email}. Sign out and
                  sign back in with that email to accept it.
                </p>
              ) : (
                <>
                  {acceptError && <p className="mb-2 text-sm text-signal-deep">{acceptError}</p>}
                  <Button onClick={handleAccept} disabled={accepting} className="w-full">
                    {accepting ? "Joining…" : "Accept invite"}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
