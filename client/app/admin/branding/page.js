"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Button } from "@/components/FormControls";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

function BrandingCard({ title, description, currentUrl, onUpload, onReset, type }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/branding?type=${type}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSuccess("Updated! Refresh to see it live.");
      setFile(null);
      onUpload(data.branding);
      // Update favicon live if favicon
      if (type === "favicon" && data.branding?.faviconUrl) {
        const link = document.querySelector("link[rel='icon']");
        if (link) link.href = data.branding.faviconUrl;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/branding?type=${type}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setSuccess("Reset to default.");
      onReset(data.branding);
      if (type === "favicon") {
        const link = document.querySelector("link[rel='icon']");
        if (link) link.href = "/icon.png";
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <h3 className="font-display text-base font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm text-text-soft">{description}</p>

      <div className="mt-4 flex gap-4">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`${type} preview`} className="h-full w-full object-contain p-2" />
          ) : currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt={`current ${type}`} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="text-xs text-text-faint">No image</span>
          )}
        </div>
        <div className="flex-1">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-text-soft file:mr-3 file:rounded-full file:border-0 file:bg-ink-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text hover:file:bg-card"
          />
          <p className="mt-1.5 text-xs text-text-faint">PNG, SVG or JPG — max 5MB. For favicon use square 512×512.</p>
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
          {success && <p className="mt-2 text-xs text-good">{success}</p>}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={handleUpload} disabled={!file || busy}>
          {busy ? "Uploading…" : `Upload ${type}`}
        </Button>
        <Button variant="ghost" onClick={handleReset} disabled={busy}>
          Reset
        </Button>
      </div>
    </div>
  );
}

function BrandingDashboard() {
  const { user } = useAuth();
  const isOwner = user?.email?.toLowerCase() === "patwarivishal62@gmail.com";
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/branding", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setBranding(d.branding || {});
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>;
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-paper">
        <TopBar />
        <main className="mx-auto max-w-3xl px-5 py-8">
          <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Admin" }, { label: "Branding" }]} />
          <div className="rounded-2xl border border-error/20 bg-error-tint p-6 text-center">
            <p className="font-semibold text-error">Not authorized</p>
            <p className="mt-1 text-sm text-text-soft">Branding settings are only available to patwarivishal62@gmail.com</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Admin" }, { label: "Branding" }]} />
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">Branding</h1>
          <p className="text-sm text-text-soft">Update logos and favicons for DECK. Changes are live instantly — no rebuild needed.</p>
        </div>

        {error && <p className="mb-4 rounded-xl border border-error/20 bg-error-tint px-3 py-2 text-sm text-error">{error}</p>}

        <div className="grid gap-6">
          <BrandingCard
            title="Main Logo"
            description="Shown in the top bar and footer. Use a transparent PNG or SVG. Recommended height 32px."
            currentUrl={branding?.logoUrl}
            type="logo"
            onUpload={setBranding}
            onReset={setBranding}
          />
          <BrandingCard
            title="Favicon"
            description="Small icon in the browser tab. Use a square PNG, 512×512. Will update the tab icon live."
            currentUrl={branding?.faviconUrl}
            type="favicon"
            onUpload={setBranding}
            onReset={setBranding}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-ink-2 p-4">
          <h4 className="text-sm font-semibold text-text">How it works</h4>
          <p className="mt-1 text-xs leading-relaxed text-text-soft">
            Uploads are stored via Vercel Blob (or as data URLs if Blob isn’t configured). The TopBar and favicon fetch from <code className="rounded bg-paper px-1 py-0.5 font-mono text-[11px]">/api/branding</code> on every load, so updates are instant and survive deploys. No need to touch code.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BrandingPage() {
  return (
    <AuthGuard>
      <BrandingDashboard />
    </AuthGuard>
  );
}
