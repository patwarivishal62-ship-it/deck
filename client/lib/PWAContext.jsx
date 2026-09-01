"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * PWA state for the whole app: service-worker registration, the native
 * install prompt, platform detection, and "already installed?" tracking.
 */

const DISMISS_KEY = "deck-install-dismissed-at";
// Re-offer the install banner two weeks after the user dismissed it.
const REASK_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const PWAContext = createContext(null);

function detectPlatform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPadOS 13+ masquerades as desktop Safari — detect via touch points.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function PWAProvider({ children }) {
  const [platform, setPlatform] = useState("desktop");
  const [mounted, setMounted] = useState(false);
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());

    try {
      setDismissedAt(Number(localStorage.getItem(DISMISS_KEY)) || 0);
    } catch {}

    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone === true; // iOS Safari
    setInstalled(isStandalone());

    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isStandalone());

    // Chromium fires beforeinstallprompt once the PWA is installable.
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault(); // keep our own UI in control
      setPromptEvent(e);
    };
    const onAppInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    mq.addEventListener?.("change", onDisplayChange);

    // Register the service worker (production only — dev assets aren't cache-stable).
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mq.removeEventListener?.("change", onDisplayChange);
    };
  }, []);

  const canInstall = mounted && !!promptEvent && !installed;

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return "unavailable";
    try {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      setPromptEvent(null); // the deferred event can only be used once
      return outcome; // "accepted" | "dismissed"
    } catch {
      return "dismissed";
    }
  }, [promptEvent]);

  const dismissInstall = useCallback(() => {
    const now = Date.now();
    setDismissedAt(now);
    try {
      localStorage.setItem(DISMISS_KEY, String(now));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      mounted,
      platform,
      isIOS: platform === "ios",
      isAndroid: platform === "android",
      isDesktop: platform === "desktop",
      installed,
      canInstall,
      promptInstall,
      dismissInstall,
      dismissedRecently: mounted && !!dismissedAt && Date.now() - dismissedAt < REASK_AFTER_MS,
    }),
    [mounted, platform, installed, canInstall, promptInstall, dismissInstall, dismissedAt]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error("usePWA must be used inside <PWAProvider>");
  return ctx;
}
