/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware — values come from CSS variables in globals.css
        ink: "var(--bg)",
        "ink-2": "var(--bg-sub)",
        "ink-line": "var(--border)",
        paper: "var(--bg)",
        "paper-2": "var(--bg-sub)",
        card: "var(--surface)",
        surface: "var(--surface)",
        line: "var(--border)",
        border: "var(--border)",
        text: "var(--text)",
        "text-soft": "var(--text-soft)",
        "text-faint": "var(--text-faint)",
        "text-muted": "var(--text-muted)",
        // Accents stay constant per brand
        signal: "#7C5CFF",
        "signal-deep": "#5B43D6",
        "signal-tint": "var(--signal-tint)",
        "signal-soft": "#7C5CFF",
        violet: "#7C5CFF",
        royal: "#4F7BFF",
        "royal-deep": "#3A5FDB",
        good: "#22D3A6",
        "good-tint": "var(--good-tint)",
        error: "#FF5D73",
        "error-tint": "var(--error-tint)",
        // Category
        "c-social": "#7C5CFF",
        "c-ads": "#4F7BFF",
        "c-seo": "#22D3A6",
        "c-content": "#E8A23D",
        "c-email": "#14B8A6",
        "c-other": "#8A94A8",
      },
      fontFamily: {
        display: ["'Inter'", "'Satoshi'", "'General Sans'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.4)",
        glow: "0 0 24px rgba(124,92,255,0.35)",
        "glow-strong": "0 0 40px rgba(124,92,255,0.5)",
      },
      keyframes: {
        pulse_dot: {
          "0%": { boxShadow: "0 0 0 0 rgba(124,92,255,.45)" },
          "70%": { boxShadow: "0 0 0 7px rgba(124,92,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(124,92,255,0)" },
        },
        float: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(16px, -22px)" },
        },
        float_alt: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-18px, 18px)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        pulse_dot: "pulse_dot 2.6s infinite",
        float: "float 14s ease-in-out infinite",
        float_alt: "float_alt 17s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
