// Single source of truth for category/period/status enums on the server.
// Mirrored on the client in client/lib/constants.js — keep both in sync.

const CATEGORIES = {
  social: { label: "Social Media", color: "#7c5cfc" },
  ads: { label: "Paid Ads", color: "#1e88e5" },
  seo: { label: "SEO", color: "#1fa67a" },
  content: { label: "Content", color: "#e8a23d" },
  email: { label: "Email", color: "#14b8a6" },
  other: { label: "Other", color: "#8a8fa3" },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const PERIODS = ["weekly", "monthly", "quarterly", "onetime"];
const STATUSES = ["todo", "in_progress", "done"];

module.exports = { CATEGORIES, CATEGORY_KEYS, PERIODS, STATUSES };
