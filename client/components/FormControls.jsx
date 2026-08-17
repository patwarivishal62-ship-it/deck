"use client";

import { twMerge } from "tailwind-merge";

export function Field({ label, children, hint }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#B8C0CC]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-[#7A8599]">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-xl border bg-[#111827] px-3.5 py-2.5 text-sm text-white placeholder:text-[#7A8599] outline-none transition-all duration-200 border-[#232A36] focus:border-[#7C5CFF] focus:bg-[#161B22] focus:ring-2 focus:ring-[#7C5CFF]/20 disabled:opacity-50 disabled:cursor-not-allowed";

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
  const base = "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";
  const variants = {
    primary:
      "bg-[#7C5CFF] text-white shadow-[0_0_20px_rgba(124,92,255,0.35)] hover:bg-[#6A44FF] hover:shadow-[0_0_28px_rgba(124,92,255,0.45)] hover:scale-[1.01]",
    secondary:
      "border border-[#232A36] bg-[#161B22] text-white hover:border-[#7C5CFF]/40 hover:bg-[#1A1F2A]",
    ghost: "bg-transparent text-[#B8C0CC] hover:bg-[#161B22] hover:text-white",
    danger: "bg-transparent text-[#FF5D73] hover:bg-[#2E1A1E]",
    destructive: "bg-[#FF5D73] text-white hover:bg-[#E94D63] shadow-[0_0_16px_rgba(255,93,115,0.35)]",
    subtle: "bg-[#111827] border border-[#232A36] text-[#B8C0CC] hover:border-[#2A3447] hover:text-white",
  };
  return <button {...props} className={twMerge(base, variants[variant], className)} />;
}
