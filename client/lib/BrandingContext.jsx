"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { applyFavicon } from "@/lib/favicon";
import { BRANDING_ENABLED } from "@/lib/featureFlags";

const EMPTY_BRANDING = { branding: null, setBranding: () => {}, loading: false, enabled: BRANDING_ENABLED };

const BrandingContext = createContext(EMPTY_BRANDING);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(BRANDING_ENABLED);

  useEffect(() => {
    // Feature disabled: never call /api/branding, never touch the favicon.
    // The app keeps the built-in logo and the static icons from app/layout.js.
    if (!BRANDING_ENABLED) return;

    let cancelled = false;

    fetch("/api/branding", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setBranding(d?.branding || null);
      })
      .catch(() => {
        // Branding is cosmetic — if the API is down or returns junk, the app
        // must still render with its built-in logo and favicon.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the favicon in sync with branding (initial load and later uploads).
  // applyFavicon only rewrites href on the existing React-rendered <link> tags;
  // it never removes them, which used to crash the whole app. See lib/favicon.js.
  useEffect(() => {
    if (!BRANDING_ENABLED) return;
    applyFavicon(branding?.faviconUrl);
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, setBranding, loading, enabled: BRANDING_ENABLED }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
