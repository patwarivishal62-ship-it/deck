"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * PWA state for the whole app: service-worker registration, the native
 * install prompt, platform detection, and "already installed?" tracking.
 * Now also manages real push notifications via VAPID + Android native bridge.
 */

const DISMISS_KEY = "deck-install-dismissed-at";
const REASK_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const PWAContext = createContext(null);

function detectPlatform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
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
  const [isAndroidApp, setIsAndroidApp] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());

    try {
      setDismissedAt(Number(localStorage.getItem(DISMISS_KEY)) || 0);
    } catch {}

    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone === true;
    setInstalled(isStandalone());

    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isStandalone());

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
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

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    // Detect Android native app bridge
    if (typeof window !== "undefined") {
      if (window.DeckAndroid || window.isDeckAndroidApp || navigator.userAgent.includes("DeckApp")) {
        setIsAndroidApp(true);
      }
      // Poll for bridge injection after WebView loads
      const interval = setInterval(() => {
        if (window.DeckAndroid) {
          setIsAndroidApp(true);
          clearInterval(interval);
        }
      }, 500);
      setTimeout(() => clearInterval(interval), 10000);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setSwRegistration(reg);
          navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data?.type === "CHECK_REMINDERS") {
              window.dispatchEvent(new CustomEvent("deck:check-reminders"));
            }
          });
        })
        .catch(() => {});
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
      setPromptEvent(null);
      return outcome;
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
    // Android native app has its own permission flow via bridge
    if (typeof window !== "undefined" && window.DeckAndroid?.requestNotificationPermission) {
      try {
        window.DeckAndroid.requestNotificationPermission();
        // Check after a short delay
        setTimeout(() => {
          if (window.DeckAndroid?.isNotificationEnabled?.()) {
            setNotificationPermission("granted");
          }
        }, 1000);
        return "granted";
      } catch {}
    }

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
      // Android native bridge — real push via NotificationManager
      if (typeof window !== "undefined" && window.DeckAndroid?.showNotification) {
        try {
          window.DeckAndroid.showNotification(title, options.body || "", options.url || "/dashboard");
          return true;
        } catch {}
      }

      if (!swRegistration) {
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, {
              body: options.body,
              icon: "/icons/icon-192.png",
            });
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
      try {
        await swRegistration.showNotification(title, {
          body: options.body || "",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: options.url || "/dashboard" },
          vibrate: [200, 100, 200],
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
      isAndroidApp,
      installed,
      canInstall,
      promptInstall,
      dismissInstall,
      dismissedRecently: mounted && !!dismissedAt && Date.now() - dismissedAt < REASK_AFTER_MS,
      notificationPermission,
      requestNotificationPermission,
      showLocalNotification,
      swRegistration,
      notificationsSupported: typeof window !== "undefined" && ("Notification" in window || window.DeckAndroid),
      realPushSupported: typeof window !== "undefined" && ("PushManager" in window || window.DeckAndroid),
    }),
    [
      mounted,
      platform,
      isAndroidApp,
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
