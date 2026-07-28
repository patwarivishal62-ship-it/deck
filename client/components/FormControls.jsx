"use client";

import { twMerge } from "tailwind-merge";

export function Field({ label, children }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClasses =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-text outline-none transition focus:border-signal focus:bg-card";

export function TextInput(props) {
  return <input {...props} className={twMerge(inputClasses, props.className)} />;
}

export function TextArea(props) {
  return <textarea {...props} className={twMerge(inputClasses, "resize-none", props.className)} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={twMerge(inputClasses, props.className)}>
      {children}
    </select>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const base = "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
  const variants = {
    primary: "bg-signal text-white hover:bg-signal-deep",
    secondary: "border border-line bg-card text-text hover:border-signal/40",
    ghost: "bg-transparent text-text-soft hover:bg-paper",
    danger: "bg-transparent text-signal-deep hover:bg-signal-tint",
    destructive: "bg-signal-deep text-white hover:bg-signal",
  };
  return <button {...props} className={twMerge(base, variants[variant], className)} />;
}
