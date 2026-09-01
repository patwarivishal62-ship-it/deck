"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const THEMES = ["dark", "light", "eye"];
const LABELS = {
  dark: "Dark",
  light: "Light",
  eye: "Eye Care",
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let saved = null;
    try { saved = typeof window !== "undefined" ? localStorage.getItem("deck-theme") : null; } catch {}
    const initial = saved && THEMES.includes(saved) ? saved : "dark"; // default premium dark
    setTheme(initial);
    try { document.documentElement.setAttribute("data-theme", initial); } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { document.documentElement.setAttribute("data-theme", theme); } catch {}
    try { localStorage.setItem("deck-theme", theme); } catch {}
  }, [theme, mounted]);

  function cycleTheme() {
    setTheme((prev) => {
      const idx = THEMES.indexOf(prev);
      return THEMES[(idx + 1) % THEMES.length];
    });
  }

  function setThemeDirect(next) {
    if (THEMES.includes(next)) setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeDirect, cycleTheme, mounted, THEMES, LABELS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeToggle({ variant = "pill" }) {
  const { theme, cycleTheme, setTheme, THEMES, LABELS } = useTheme();

  if (variant === "menu") {
    return (
      <div className="flex items-center gap-1 rounded-full border border-line bg-paper p-1">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              theme === t ? "bg-signal text-white shadow" : "text-text-soft hover:text-text"
            }`}
            aria-pressed={theme === t}
            title={LABELS[t]}
          >
            {t === "dark" ? "Dark" : t === "light" ? "Light" : "Eye"}
          </button>
        ))}
      </div>
    );
  }

  // pill toggle — cycles
  const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "👁️";
  // Use SVG icons for premium feel
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Theme: ${LABELS[theme]}. Click to switch.`}
      title={`Theme: ${LABELS[theme]} — click to switch`}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-text-soft transition hover:border-signal/30 hover:text-text"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-paper text-[12px]">
        {theme === "dark" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : theme === "light" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M18.36 18.36l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M18.36 5.64l1.41-1.41" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </span>
      <span className="hidden sm:inline capitalize">{LABELS[theme]}</span>
    </button>
  );
}
