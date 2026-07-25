// Mirrors server/src/constants.js — keep both in sync.

export const CATEGORIES = {
  social: { label: "Social Media", color: "#7c5cfc" },
  ads: { label: "Paid Ads", color: "#1e88e5" },
  seo: { label: "SEO", color: "#1fa67a" },
  content: { label: "Content", color: "#e8a23d" },
  email: { label: "Email", color: "#14b8a6" },
  other: { label: "Other", color: "#8a8fa3" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "onetime", label: "One-time" },
];

export const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export const PRIORITIES = {
  low: { label: "Low", color: "#8a8fa3" },
  medium: { label: "Medium", color: "#e8a23d" },
  high: { label: "High", color: "#ff5a38" },
};

export const PRIORITY_KEYS = Object.keys(PRIORITIES);

export const PROJECT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
];

export function statusLabel(value) {
  return STATUSES.find((s) => s.value === value)?.label || value;
}

export function periodLabel(value) {
  return PERIODS.find((p) => p.value === value)?.label || value;
}
