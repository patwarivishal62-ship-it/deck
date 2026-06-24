/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14161f",
        "ink-2": "#1c1f2c",
        "ink-line": "#2b2f40",
        paper: "#f1f2f7",
        card: "#ffffff",
        line: "#e1e4ee",
        text: "#1b1e2a",
        "text-soft": "#666c80",
        "text-faint": "#9499ab",
        signal: "#ff5a38",
        "signal-deep": "#e0431f",
        "signal-tint": "#ffe6de",
        good: "#1fa67a",
        "c-social": "#7c5cfc",
        "c-ads": "#1e88e5",
        "c-seo": "#1fa67a",
        "c-content": "#e8a23d",
        "c-email": "#14b8a6",
        "c-other": "#8a8fa3",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      keyframes: {
        pulse_dot: {
          "0%": { boxShadow: "0 0 0 0 rgba(255,90,56,.55)" },
          "70%": { boxShadow: "0 0 0 7px rgba(255,90,56,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,90,56,0)" },
        },
      },
      animation: {
        pulse_dot: "pulse_dot 2.6s infinite",
      },
    },
  },
  plugins: [],
};
