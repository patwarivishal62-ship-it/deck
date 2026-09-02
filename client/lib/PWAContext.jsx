"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * PWA state for the whole app: service-worker registration, the native
 * install prompt, platform detection, and "already installed?" tracking.
 * Now also manages notification permission for timely mobile reminders.
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
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [swRegistration, setSwRegistration] = useState(null);

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

    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    // Register the service worker (production only — dev assets aren't cache-stable).
    // In dev, still try to register for notification testing, but don't cache.
    if ("serviceWorker" in navigator) {
      const shouldRegister = process.env.NODE_ENV === "production" || true; // allow in dev for voice notifications
      if (shouldRegister) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            setSwRegistration(reg);
            // Listen for messages from SW
            navigator.serviceWorker.addEventListener("message", (event) => {
              if (event.data?.type === "CHECK_REMINDERS") {
                // SW asks to check reminders — could trigger a refetch
                window.dispatchEvent(new CustomEvent("deck:check-reminders"));
              }
            });
          })
          .catch(() => {});
      }
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

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported";
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      return perm;
    } catch {
      return "denied";
    }
  }, []);

  const showLocalNotification = useCallback(
    async (title, options = {}) => {
      if (!swRegistration) {
        // Fallback to simple Notification API
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, {
            body: options.body,
            icon: "/icons/icon-192.png",
          });
          return true;
        }
        return false;
      }
      try {
        await swRegistration.showNotification(title, {
          body: options.body || "",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: options.url || "/dashboard" },
          ...options,
        });
        return true;
      } catch {
        return false;
      }
    },
    [swRegistration]
  );

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
      notificationPermission,
      requestNotificationPermission,
      showLocalNotification,
      swRegistration,
      notificationsSupported: typeof window !== "undefined" && "Notification" in window,
    }),
    [
      mounted,
      platform,
      installed,
      canInstall,
      promptInstall,
      dismissInstall,
      dismissedAt,
      notificationPermission,
      requestNotificationPermission,
      showLocalNotification,
      swRegistration,
    ]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error("usePWA must be used inside <PWAProvider>");
  return ctx;
}
