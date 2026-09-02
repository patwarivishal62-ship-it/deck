/**
 * Echo — model configuration
 *
 * One place that answers: which provider, which model, which endpoint, which
 * key. Everything is environment driven so the deployment can point Echo at
 * any OpenAI-compatible chat-completions API without a code change.
 *
 * Env vars (all optional except the key):
 *   ECHO_PROVIDER      openai | groq | openrouter | together | custom
 *   ECHO_API_KEY       API key (falls back to OPENAI_API_KEY)
 *   ECHO_MODEL         model id (falls back to OPENAI_MODEL, then the
 *                      provider's default)
 *   ECHO_BASE_URL      override the provider's base URL (required for "custom")
 *   ECHO_TEMPERATURE   0-2, default 0.2
 *   ECHO_MAX_TOKENS    default 1200
 *   ECHO_JSON_MODE     "false" to disable response_format json_object for
 *                      models/providers that reject it
 *
 * The legacy OPENAI_API_KEY / OPENAI_MODEL names still work, so existing
 * deployments keep running untouched.
 */

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    envKeys: ["OPENAI_API_KEY"],
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    envKeys: ["GROQ_API_KEY"],
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    envKeys: ["OPENROUTER_API_KEY"],
  },
  together: {
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    envKeys: ["TOGETHER_API_KEY"],
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  },
  custom: {
    label: "Custom",
    baseUrl: "",
    defaultModel: "",
    envKeys: [],
  },
};

const PLACEHOLDER_KEYS = new Set(["sk-your-openai-key", "sk-your-api-key", "changeme", "your-api-key", ""]);

function envStr(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function envNumber(name, fallback) {
  const raw = envStr(name);
  if (!raw) return fallback; // unset or blank — Number("") is 0, which is a trap
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function envBool(name, fallback) {
  const raw = envStr(name).toLowerCase();
  if (!raw) return fallback;
  return !["false", "0", "no", "off"].includes(raw);
}

function resolveProvider() {
  const requested = envStr("ECHO_PROVIDER").toLowerCase();
  if (requested && PROVIDERS[requested]) return requested;
  // Infer from whichever provider key is present, so setting GROQ_API_KEY alone
  // is enough.
  for (const name of ["groq", "openrouter", "together", "gemini"]) {
    if (PROVIDERS[name].envKeys.some((k) => envStr(k))) return name;
  }
  return "openai";
}

function resolveApiKey(providerName) {
  const explicit = envStr("ECHO_API_KEY");
  if (explicit) return explicit;
  for (const key of PROVIDERS[providerName].envKeys) {
    const value = envStr(key);
    if (value) return value;
  }
  return envStr("OPENAI_API_KEY");
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}

/** Resolve the live model configuration. Read fresh each call — env can change in tests. */
function getModelConfig() {
  const providerName = resolveProvider();
  const provider = PROVIDERS[providerName];
  const apiKey = resolveApiKey(providerName);
  const baseUrl = stripTrailingSlash(envStr("ECHO_BASE_URL") || provider.baseUrl);
  const model = envStr("ECHO_MODEL") || envStr("OPENAI_MODEL") || provider.defaultModel;

  const problems = [];
  if (!apiKey || PLACEHOLDER_KEYS.has(apiKey)) problems.push("no API key configured (set ECHO_API_KEY)");
  if (!baseUrl) problems.push("no base URL configured (set ECHO_BASE_URL)");
  if (!model) problems.push("no model configured (set ECHO_MODEL)");

  return {
    provider: providerName,
    providerLabel: provider.label,
    apiKey,
    baseUrl,
    endpoint: baseUrl ? `${baseUrl}/chat/completions` : "",
    model,
    temperature: Math.min(2, Math.max(0, envNumber("ECHO_TEMPERATURE", 0.2))),
    maxTokens: Math.max(256, envNumber("ECHO_MAX_TOKENS", 1200)),
    jsonMode: envBool("ECHO_JSON_MODE", true),
    timeoutMs: Math.max(1000, envNumber("ECHO_TIMEOUT_MS", envNumber("VOICE_AI_TIMEOUT_MS", 20000))),
    retries: Math.max(0, envNumber("ECHO_RETRIES", envNumber("VOICE_AI_RETRIES", 1))),
    configured: problems.length === 0,
    problems,
  };
}

/** Safe-to-expose summary for the client (never includes the key). */
function describeModelConfig() {
  const cfg = getModelConfig();
  return {
    enabled: cfg.configured,
    provider: cfg.provider,
    providerLabel: cfg.providerLabel,
    model: cfg.configured ? cfg.model : null,
    problems: cfg.problems,
  };
}

module.exports = { PROVIDERS, getModelConfig, describeModelConfig };
