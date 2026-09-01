// Mirrors server/src/constants.js — keep both in sync.

export const CATEGORIES = {
  social: { label: "Social Media", color: "#7C5CFF" },
  ads: { label: "Paid Ads", color: "#4F7BFF" },
  seo: { label: "SEO", color: "#22D3A6" },
  content: { label: "Content", color: "#E8A23D" },
  email: { label: "Email", color: "#14B8A6" },
  other: { label: "Other", color: "#8A94A8" },
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
  low: { label: "Low", color: "#7A8599" },
  medium: { label: "Medium", color: "#E8A23D" },
  high: { label: "High", color: "#FF5D73" },
};

export const PRIORITY_KEYS = Object.keys(PRIORITIES);

export const PROJECT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
];

// Suggested metrics per category — mirrors server/src/constants.js. "unit" is
// a display hint (count/percent/currency/ratio), not enforced.
export const METRIC_CATALOG = {
  social: [
    { key: "reach", label: "Reach", unit: "count" },
    { key: "impressions", label: "Impressions", unit: "count" },
    { key: "followers", label: "Followers", unit: "count" },
    { key: "profile_visits", label: "Profile Visits", unit: "count" },
    { key: "engagement_rate", label: "Engagement Rate", unit: "percent" },
    { key: "shares", label: "Shares", unit: "count" },
    { key: "saves", label: "Saves", unit: "count" },
  ],
  ads: [
    { key: "spend", label: "Spend", unit: "currency" },
    { key: "reach", label: "Reach", unit: "count" },
    { key: "impressions", label: "Impressions", unit: "count" },
    { key: "ctr", label: "CTR", unit: "percent" },
    { key: "cpc", label: "CPC", unit: "currency" },
    { key: "cpm", label: "CPM", unit: "currency" },
    { key: "leads", label: "Leads", unit: "count" },
    { key: "conversions", label: "Conversions", unit: "count" },
    { key: "cpl", label: "Cost Per Lead", unit: "currency" },
    { key: "roas", label: "ROAS", unit: "ratio" },
  ],
  seo: [
    { key: "organic_traffic", label: "Organic Traffic", unit: "count" },
    { key: "keyword_rankings", label: "Keywords Ranking", unit: "count" },
    { key: "backlinks", label: "Backlinks", unit: "count" },
    { key: "domain_authority", label: "Domain Authority", unit: "count" },
  ],
  content: [
    { key: "views", label: "Views", unit: "count" },
    { key: "engagement", label: "Engagement", unit: "count" },
    { key: "avg_time_on_page", label: "Avg. Time on Page", unit: "count" },
  ],
  email: [
    { key: "open_rate", label: "Open Rate", unit: "percent" },
    { key: "click_rate", label: "Click Rate", unit: "percent" },
    { key: "unsubscribe_rate", label: "Unsubscribe Rate", unit: "percent" },
    { key: "list_growth", label: "List Growth", unit: "count" },
  ],
  other: [],
};

export const UNIT_SYMBOLS = { count: "", percent: "%", currency: "₹", ratio: "x" };

export function formatMetricValue(value, unit) {
  if (unit === "percent") return `${value}%`;
  if (unit === "currency") return `₹${value}`;
  if (unit === "ratio") return `${value}x`;
  return String(value);
}

export function statusLabel(value) {
  return STATUSES.find((s) => s.value === value)?.label || value;
}

export function periodLabel(value) {
  return PERIODS.find((p) => p.value === value)?.label || value;
}
