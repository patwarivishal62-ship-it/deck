"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { Button } from "@/components/FormControls";
import { InstallSteps, PLATFORM_LABELS } from "@/components/InstallSteps";
import { usePWA } from "@/lib/PWAContext";

/**
 * Install CTA. On Chromium browsers it fires the native install prompt;
 * everywhere else (iOS Safari, etc.) it opens step-by-step instructions.
 *
 * variants:
 *  - "primary"   solid signal button (hero CTAs)
 *  - "secondary" bordered card button (settings, banners)
 *  - "banner"    compact bold text button (inside the install banner)
 */
export default function InstallButton({
  label = "Install app",
  variant = "primary",
  className = "",
  showInstalledState = true,
}) {
  const { canInstall, installed, platform, isIOS, promptInstall } = usePWA();
  const stepsPlatform = platform === "android" ? "android" : isIOS ? "ios" : "desktop";
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (installed) {
    if (!showInstalledState) return null;
    return (
      <Button variant="secondary" disabled className={className}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Installed
      </Button>
    );
  }

  async function handleInstall() {
    if (canInstall) {
      setBusy(true);
      await promptInstall();
      setBusy(false);
    } else {
      setModalOpen(true); // no native prompt on this browser — show the steps
    }
  }

  return (
    <>
      {variant === "banner" ? (
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 rounded-full bg-[#7C5CFF] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(124,92,255,0.35)] transition hover:bg-[#6A44FF] active:scale-[0.98]"
        >
          {busy ? "Opening…" : label}
        </button>
      ) : (
        <Button variant={variant === "primary" ? "primary" : "secondary"} onClick={handleInstall} disabled={busy} className={className}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
          {busy ? "Opening…" : isIOS ? "Add to Home Screen" : label}
        </Button>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Install DECK — ${PLATFORM_LABELS[stepsPlatform]}`}
      >
        <p className="mb-4 text-sm leading-relaxed text-text-soft">
          DECK installs straight from the browser — no App Store, no download manager. It takes about
          ten seconds:
        </p>
        <InstallSteps platform={stepsPlatform} />
      </Modal>
    </>
  );
}
