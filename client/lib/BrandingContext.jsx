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
        // Update favicon live
        const link2 = document.querySelector("link[rel='icon']");
        if (link2) {
          if (d.branding?.faviconUrl) link2.href = d.branding.faviconUrl;
          else link2.remove();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Also update favicon when branding changes (after upload)
  useEffect(() => {
    const link = document.querySelector("link[rel='icon']");
    if (!link) return;
    if (branding?.faviconUrl) link.href = branding.faviconUrl;
    else link.remove(); // truly no favicon when none set — tab will show no icon
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
