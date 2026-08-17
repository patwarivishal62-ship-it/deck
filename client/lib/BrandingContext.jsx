"use client";

import { createContext, useContext, useEffect, useState } from "react";

const BrandingContext = createContext({ branding: null, loading: true });

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((d) => {
        setBranding(d.branding || null);
        // Update favicon live if custom
        if (d.branding?.faviconUrl) {
          const link = document.querySelector("link[rel='icon']");
          if (link) link.href = d.branding.faviconUrl;
          // Also handle apple touch icon if present
          const apple = document.querySelector("link[rel='apple-touch-icon']");
          if (apple) apple.href = d.branding.faviconUrl;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Also update favicon when branding changes (after upload)
  useEffect(() => {
    if (branding?.faviconUrl) {
      const link = document.querySelector("link[rel='icon']");
      if (link) link.href = branding.faviconUrl;
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, setBranding, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
