// Single source of truth for category/period/status enums on the server.
// Mirrored on the client in client/lib/constants.js — keep both in sync.

const CATEGORIES = {
  social: { label: "Social Media", color: "#7C5CFF" },
  ads: { label: "Paid Ads", color: "#4F7BFF" },
  seo: { label: "SEO", color: "#22D3A6" },
  content: { label: "Content", color: "#E8A23D" },
  email: { label: "Email", color: "#14B8A6" },
  other: { label: "Other", color: "#8A94A8" },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const PERIODS = ["weekly", "monthly", "quarterly", "onetime"];
const STATUSES = ["todo", "in_progress", "done"];

const PRIORITIES = {
  low: { label: "Low", color: "#7A8599" },
  medium: { label: "Medium", color: "#E8A23D" },
  high: { label: "High", color: "#FF5D73" },
};
const PRIORITY_KEYS = Object.keys(PRIORITIES);

const PROJECT_SORTS = ["newest", "oldest", "name", "dueDate", "priority"];

// Suggested metrics per category, so "Metrics" means something different for
// Social Media than for Paid Ads — matches the same category keys as
// CATEGORIES/goals. "unit" is a display hint (count/percent/currency/ratio),
// not enforced — a metric can also be entered as fully custom (name + unit)
// if nothing here fits.
const METRIC_CATALOG = {
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

module.exports = {
  CATEGORIES,
  CATEGORY_KEYS,
  PERIODS,
  STATUSES,
  PRIORITIES,
  PRIORITY_KEYS,
  PROJECT_SORTS,
  METRIC_CATALOG,
};
