"use client";

import { twMerge } from "tailwind-merge";

export function Field({ label, children, hint }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-text-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-text-faint">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-xl border bg-ink-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint outline-none transition-all duration-200 border-line focus:border-[#7C5CFF] focus:bg-card focus:ring-2 focus:ring-[#7C5CFF]/20 disabled:opacity-50 disabled:cursor-not-allowed";

export function TextInput(props) {
  return <input {...props} className={twMerge(baseInput, props.className)} />;
}

export function TextArea(props) {
  return <textarea {...props} className={twMerge(baseInput, "resize-none py-3", props.className)} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={twMerge(baseInput, "cursor-pointer pr-8", props.className)}>
      {children}
    </select>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const base = "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] sm:px-5";
  const variants = {
    primary:
      "bg-[#7C5CFF] text-text shadow-[0_0_20px_rgba(124,92,255,0.35)] hover:bg-[#6A44FF] hover:shadow-[0_0_28px_rgba(124,92,255,0.45)] hover:scale-[1.01]",
    secondary:
      "border border-line bg-card text-text hover:border-[#7C5CFF]/40 hover:bg-card",
    ghost: "bg-transparent text-text-soft hover:bg-card hover:text-text",
    danger: "bg-transparent text-[#FF5D73] hover:bg-[#2E1A1E]",
    destructive: "bg-[#FF5D73] text-text hover:bg-[#E94D63] shadow-[0_0_16px_rgba(255,93,115,0.35)]",
    subtle: "bg-ink-2 border border-line text-text-soft hover:border-[#2A3447] hover:text-text",
  };
  return <button {...props} className={twMerge(base, variants[variant], className)} />;
}
