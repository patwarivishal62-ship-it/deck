/**
 * Deck Voice AI Parser
 *
 * Rule-based parser that turns a spoken/typed transcript into structured
 * actions (create_project / create_goal / create_task / create_note /
 * create_reminder / assign_task). An optional LLM front-end (smartParse)
 * uses the same action schema and falls back to these rules.
 *
 * parseTranscript() is a hybrid pipeline:
 *   1. cleanTranscript()          undo speech-to-text mishears, drop filler
 *   2. extractProjectCreation()   "create a project called X" — runs FIRST so
 *                                 the new project becomes the default target
 *                                 for every goal/task in the same transcript
 *   3. extractGoals()             "goals like A monthly 500, B weekly 3"
 *   4. extractSmartTasks()        "research and writing deadlines for 4th of
 *                                 September, postings shall be done by 10th"
 *   5. generic sentence pass      tasks / task lists / notes / reminders /
 *                                 assignments (skips what 2–4 already covered)
 *   6. reminders extra pass       catches "remind me…" the splitter merged
 *   7. dedup
 *
 * Every date helper accepts an optional `now` so behaviour is testable.
 */

// ---------------------------------------------------------------------------
// Vocab
// ---------------------------------------------------------------------------

const CATEGORY_ALIASES = {
  social: ["social", "social media", "instagram", "facebook", "twitter", "linkedin", "tiktok", "followers", "reels", "youtube"],
  ads: ["ads", "ad", "paid ads", "google ads", "meta ads", "advertising", "ppc", "campaign", "cpc", "roas"],
  seo: ["seo", "search", "organic", "ranking", "rankings", "keyword", "keywords", "backlink", "backlinks"],
  content: ["content", "blog", "blogs", "article", "articles", "video", "videos", "copy", "writing", "post", "posts"],
  email: ["email", "emails", "newsletter", "mail", "drip", "automation"],
  other: ["other", "general", "misc"],
};

const PRIORITY_ALIASES = {
  high: ["high", "highest", "urgent", "urgently", "important", "critical", "asap", "top priority"],
  medium: ["medium", "normal", "moderate"],
  low: ["low", "lowest", "minor", "later", "whenever"],
};

const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MONTH_RE_SRC =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

// Verbs that usually open a new command/clause. Used to (a) split run-on
// voice transcripts into clauses and (b) accept verb-first fragments as tasks.
const COMMAND_VERBS_SRC =
  "create|add|make|assign|remind|notify|note|do|write|design|schedule|call|send|update|prepare|review|publish|post|research|" +
  "set\\s*up|setup|build|plan|fix|finish|complete|launch|draft|record|shoot|edit|upload|book|order|pay|check|test|deploy|" +
  "remove|delete|move|email|message|meet|organi[sz]e|clean|buy|read|study|submit|share|print|install|configure|contact|" +
  "follow\\s*up|postings?|start|run|analy[sz]e|optimi[sz]e|track|measure|report|collect|gather|hire|interview|onboard|" +
  "train|translate|proofread|approve|sign|renew|cancel|migrate|refactor|implement|integrate|ship|release|announce|promote|" +
  "pitch|present|demo|invite|reply|respond|confirm|verify|audit|backup|restore|reschedule|arrange|set|get|put";

const TASK_VERB_START_RE = new RegExp(`^(?:please\\s+)?(?:${COMMAND_VERBS_SRC})\\b`, "i");
const CLAUSE_BOUNDARY_SRC = `[.;!?\\n]+(?=\\s|$)|(?:,\\s*|\\s+)(?:(?:and\\s+then|and\\s+also|then|also|and)\\s+)?(?=(?:please\\s+)?(?:${COMMAND_VERBS_SRC})\\b)`;

const RESEARCH_WRITING_RE = /\bresearch(?:ing)?\b[\s\S]{0,40}?\bwriting\b|\bwriting\b[\s\S]{0,40}?\bresearch(?:ing)?\b/i;
const POSTINGS_RE = /\bpostings?\b|\bpublish(?:ing)?\b/i;
const TASK_MARKER_RE = /\b(?:tasks?|deadlines?|due|assign(?:ed)?|to-?do)\b/i;

// Patterns that route a transcript through the specialised extractors.
const GOAL_PATTERN_RE = /\bgoals?\b|\b(?:monthly|weekly|quarterly)\s+\d/i;
const SMART_TASK_PATTERN_RE = /\bresearch(?:ing)?\b[\s\S]{0,40}?\bwriting\b|\bdeadlines?\s+(?:for|by|on|is|are)\b|\b\d{1,2}(?:st|nd|rd|th)\s+of\b/i;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function normalize(str) {
  return String(str || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(s) {
  const str = String(s || "").trim();
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function titleCase(s) {
  return String(s || "")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function wordMatch(lower, alias) {
  return new RegExp(`\\b${escapeRegExp(alias)}(?:s|es)?\\b`).test(lower);
}

function detectCategory(text) {
  const lower = normalize(text);
  for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => wordMatch(lower, a))) return cat;
  }
  return "other";
}

function detectPriority(text) {
  const lower = normalize(text);
  for (const [prio, aliases] of Object.entries(PRIORITY_ALIASES)) {
    if (aliases.some((a) => wordMatch(lower, a))) return prio;
  }
  return "medium";
}

// ---------------------------------------------------------------------------
// 1. Transcript cleaning
// ---------------------------------------------------------------------------

// Speech-to-text mishears we have actually seen ("bread lines" → "deadlines").
const MISHEARD_RE = /\b(?:bread|dead|bred|red)\s*line(s?)\b/gi;

// Filler that marks a *boundary* between two commands in speech. Replaced by a
// full stop so the sentence splitter sees the seam ("…nutrition then add goals").
const BOUNDARY_FILLER_RE =
  /\b(?:and then|then|okay|ok|alright|also|i want you to|i need you to|i would like you to|i'd like you to|you need to|you have to|you should|after that|moving on|next up)\b/gi;

// Filler that carries no meaning at all — simply removed.
const FILLER_RE = /\b(?:you know|ya|yeah|yep|uh|umm?|hmm+|so|here|basically|actually|just|please|kindly)\b/gi;

// "add few goals" → "add goals", "create a couple of tasks" → "create tasks"
const QUANTITY_FILLER_RE = /\b(add|create|make|set)\s+(?:a\s+)?(?:few|some|couple of|a couple of|several|multiple)\b/gi;

function cleanTranscript(text) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";

  t = t.replace(MISHEARD_RE, (m, s) => `deadline${s ? "s" : ""}`);
  t = t.replace(/\bdue\s+lines?\b/gi, "deadlines");

  t = t.replace(QUANTITY_FILLER_RE, "$1");
  t = t.replace(BOUNDARY_FILLER_RE, ". ");
  t = t.replace(FILLER_RE, " ");

  // Tidy punctuation / whitespace left behind by the removals.
  t = t
    .replace(/\s+(?:and|or|but)\s*([.;])/gi, "$1") // "nutrition and ." → "nutrition."
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?:\s*[,.;:!?])+/g, (m, p) => (/[.;!?]/.test(m) ? "." : p))
    .replace(/^[\s,.;:!?-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return t;
}

// ---------------------------------------------------------------------------
// 2. Dates
// ---------------------------------------------------------------------------

// "4th of September", "4 September", "4th Sept 2026"
const DAY_MONTH_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE_SRC}\\b(?:,?\\s*(\\d{4}))?`, "i");
// "September 4th", "Sept 4, 2026"
const MONTH_DAY_RE = new RegExp(`\\b${MONTH_RE_SRC}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "i");

function monthIndex(name) {
  const key = String(name || "").slice(0, 3).toLowerCase();
  return key in MONTH_INDEX ? MONTH_INDEX[key] : -1;
}

// If no year was spoken, assume the current year — unless that would put the
// date more than 60 days in the past, in which case the speaker means next year
// ("15th of January" said in September).
function buildDate(day, month, explicitYear, now) {
  if (month < 0 || !Number.isFinite(day) || day < 1 || day > 31) return null;
  let year = explicitYear ? parseInt(explicitYear, 10) : now.getFullYear();
  let d = new Date(year, month, day);
  if (d.getMonth() !== month) return null; // e.g. 31st of February
  if (!explicitYear) {
    const daysAgo = (startOfDay(now) - d) / 86400000;
    if (daysAgo > 60) {
      year += 1;
      d = new Date(year, month, day);
      if (d.getMonth() !== month) return null;
    }
  }
  return toISODate(d);
}

// Three spoken forms: "4th of September", "4 September", "September 4th".
// When a text contains several dates, the first one spoken wins.
function parseOrdinalDate(text, now = new Date()) {
  const t = String(text || "");
  const dm = t.match(DAY_MONTH_RE);
  const md = t.match(MONTH_DAY_RE);
  const candidates = [];
  if (dm) candidates.push({ index: dm.index, day: parseInt(dm[1], 10), month: monthIndex(dm[2]), year: dm[3] });
  if (md) candidates.push({ index: md.index, day: parseInt(md[2], 10), month: monthIndex(md[1]), year: md[3] });
  candidates.sort((a, b) => a.index - b.index);
  for (const c of candidates) {
    const iso = buildDate(c.day, c.month, c.year, now);
    if (iso) return iso;
  }
  return null;
}

function extractDueDate(text, now = new Date()) {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const lower = raw.toLowerCase();
  const today = startOfDay(now);

  // Explicit calendar dates win over relative words.
  const ordinal = parseOrdinalDate(raw, now);
  if (ordinal) return ordinal;

  if (/\bday after tomorrow\b/.test(lower)) return toISODate(addDays(today, 2));
  if (/\b(?:today|tonight|this evening|this afternoon|end of (?:the )?day|eod)\b/.test(lower)) return toISODate(today);
  if (/\btomorrow\b/.test(lower)) return toISODate(addDays(today, 1));
  if (/\bnext week\b/.test(lower)) return toISODate(addDays(today, 7));
  if (/\bnext month\b/.test(lower)) return toISODate(addDays(today, 30));
  if (/\bend of (?:the |this )?month\b/.test(lower)) return toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const inMatch = lower.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month)s?\b/);
  if (inMatch) {
    const n = /^\d+$/.test(inMatch[1]) ? parseInt(inMatch[1], 10) : NUMBER_WORDS[inMatch[1]] || 1;
    const days = inMatch[2] === "day" ? n : inMatch[2] === "week" ? n * 7 : n * 30;
    return toISODate(addDays(today, days));
  }

  const wd = lower.match(/\b(?:(next|this|coming|on|by|before|until|till|every)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // "on Monday" said on a Monday → next one
    return toISODate(addDays(today, diff));
  }
  if (/\bend of (?:the |this )?week\b/.test(lower)) {
    const diff = ((5 - today.getDay() + 7) % 7) || 7;
    return toISODate(addDays(today, diff));
  }

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const slash = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    let first = parseInt(slash[1], 10);
    let second = parseInt(slash[2], 10);
    let year = parseInt(slash[3], 10);
    if (year < 100) year += 2000;
    // m/d/y by default, d/m/y when the first number can't be a month.
    const [month, day] = first > 12 ? [second, first] : [first, second];
    return buildDate(day, month - 1, String(year), now);
  }

  // "by the 4th" (no month) → this month, or next month if already passed.
  const bare = lower.match(/\b(?:by|on|before|until|till)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s+of)/);
  if (bare) {
    const day = parseInt(bare[1], 10);
    let d = new Date(today.getFullYear(), today.getMonth(), day);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
    if (d.getDate() === day) return toISODate(d);
  }

  return null;
}

// Everything extractDueDate understands, as one alternation — used to strip
// date phrases (and their leading preposition) out of titles/messages.
const DATE_CORE_SRC = [
  `\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE_SRC}(?:,?\\s*\\d{4})?`,
  `${MONTH_RE_SRC}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?`,
  "day after tomorrow",
  "today",
  "tonight",
  "this evening",
  "this afternoon",
  "tomorrow",
  "next week",
  "next month",
  "end of (?:the |this )?(?:month|week|day)",
  "eod",
  "in\\s+(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:days?|weeks?|months?)",
  "(?:(?:next|this|coming)\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
  "\\d{4}-\\d{2}-\\d{2}",
  "\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}",
  "the\\s+\\d{1,2}(?:st|nd|rd|th)",
].join("|");

const DATE_PHRASE_RE = new RegExp(
  `\\s*,?\\s*\\b(?:(?:is|are)\\s+)?(?:due|by|on|before|until|till|deadlines?(?:\\s+(?:is|are|for|by|on))?|for|at|around|from|starting|within)?\\s*\\b(?:${DATE_CORE_SRC})\\b`,
  "gi"
);

const TIME_PHRASE_RE = /\s*,?\s*\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|o'?clock)?\b/gi;

function stripDatePhrases(text) {
  return String(text || "").replace(DATE_PHRASE_RE, " ").replace(/\s{2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// 3. Assignees
// ---------------------------------------------------------------------------

function extractAssignee(text) {
  const patterns = [
    /assign(?:ed)?\s+(?:it\s+|this\s+|that\s+|them\s+)?(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /assign(?:ed)?\s+(?:it\s+|this\s+|that\s+|them\s+)?(?:to\s+)?([a-z]+(?:\s+[a-z]+)?)\s*(?:,|\.|$|high|medium|low|priority|tomorrow|today|next|by|due)/i,
    /@([a-z0-9._-]+)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let candidate = m[1].trim();
      candidate = candidate.replace(/\s+(high|medium|low|priority|urgent|tomorrow|today|next week|by|due).*$/i, "").trim();
      const lower = candidate.toLowerCase();
      if (["me", "us", "team", "everyone", "project", "goal", "task", "it", "this", "that", "them", "the", "a", "to"].includes(lower)) continue;
      if (candidate.length >= 2 && candidate.length <= 40) return candidate;
    }
  }
  const assignIdx = text.toLowerCase().indexOf("assign");
  if (assignIdx !== -1) {
    const afterAssign = text.slice(assignIdx);
    const toMatch = afterAssign.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (toMatch) return toMatch[1].trim();
    const toMatchLower = afterAssign.match(/to\s+([a-z]+)/i);
    if (toMatchLower) {
      const cand = toMatchLower[1].trim();
      if (!["do", "be", "create", "add", "make", "the", "a", "it", "this", "that"].includes(cand.toLowerCase())) return cand;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. Projects
// ---------------------------------------------------------------------------

// Cheap gate before the precise PROJECT_CREATE_RE below.
const PROJECT_CREATE_PRECHECK_RE = /create.*project|new project|\b(?:make|start|set\s*up|setup|open|begin)\b.*\bproject\b/i;
// Finer check: don't treat "create a project plan" / "create the project brief" as a new project.
const PROJECT_VERBS_SRC = "create|make|start|set\\s*up|setup|open|add|build|begin";
const PROJECT_NOT_ENTITY_SRC =
  "plan|timeline|brief|proposal|report|update|status|kick-?off|budget|scope|meeting|review|deck|document|doc|page|roadmap|folder|file|board|manager|management";
// A word that can be part of a project name in "<verb> the X project" — never a
// connector or another entity word, so "create a task for X in project" can't match.
const PROJECT_NAME_WORD_SRC =
  "(?!(?:tasks?|goals?|notes?|reminders?|milestones?|for|in|to|and|with|on|of|at|by|a|an|the|this|that|it|me|us|under|into)\\b)[A-Za-z0-9][\\w&'’-]*";
// Three shapes: "<verb> (a|the) (new) project [called X]", "new project X", and
// "<verb> the X project" (name before the word). A trailing noun such as
// "project plan" / "project brief" means a deliverable, not a new project.
const PROJECT_CREATE_RE = new RegExp(
  `\\b(?:${PROJECT_VERBS_SRC})\\s+(?:a\\s+|an\\s+|the\\s+|one\\s+)?(?:new\\s+|fresh\\s+|separate\\s+)?project\\b(?!\\s+(?:${PROJECT_NOT_ENTITY_SRC})\\b)` +
    `|\\b(?:${PROJECT_VERBS_SRC})\\s+(?:a\\s+|an\\s+|the\\s+)?(?:new\\s+)?${PROJECT_NAME_WORD_SRC}(?:\\s+${PROJECT_NAME_WORD_SRC}){0,4}?\\s+project\\b(?!\\s+(?:${PROJECT_NOT_ENTITY_SRC})\\b)` +
    `|\\bnew project\\b|\\bproject\\s+(?:called|named|titled)\\b`,
  "i"
);
const PROJECT_NAME_INTRO_RE = /^(?:called|named|titled|by the name of|with the name|name|for|on|about|of|:|-|–|—)\s*/i;
const PROJECT_NAME_STOP_RE =
  /\b(?:and|with|where|which|that|add|also|having|containing|include|including|goals?|tasks?|deadlines?|assign|due|whose|remind|note|create|make|do|research|writing|postings?|then|so)\b|[.,;:!?\n"“”]/i;

// True when the sentence's primary intent is to create a project — not a
// task/goal that merely names one ("create a task … in project called Alpha").
function isProjectSentence(sentence) {
  const s = String(sentence || "");
  if (!PROJECT_CREATE_PRECHECK_RE.test(s) || !PROJECT_CREATE_RE.test(s)) return false;
  const m = PROJECT_CREATE_RE.exec(s);
  const head = s.slice(0, m.index).toLowerCase();
  return !/\b(?:tasks?|goals?|notes?|reminders?|milestones?)\b/.test(head);
}

function extractProjectCreation(text) {
  const t = String(text || "").trim();
  if (!t || !PROJECT_CREATE_PRECHECK_RE.test(t)) return null;
  const m = PROJECT_CREATE_RE.exec(t);
  if (!m) return null;
  // "create a task … in project called Alpha" targets an existing project.
  if (/\b(?:tasks?|goals?|notes?|reminders?|milestones?)\b/i.test(t.slice(0, m.index))) return null;

  const projectWordIdx = t.toLowerCase().indexOf("project", m.index);
  const afterIdx = projectWordIdx + "project".length;
  const rest = t.slice(afterIdx);
  const restTrimmed = rest.replace(/^\s+/, "");
  const leadingWs = rest.length - restTrimmed.length;

  let name = "";
  let consumed = 0;

  const quoted = restTrimmed.match(/^(?:(?:called|named|titled)\s*)?["“'‘]([^"”'’]{2,80})["”'’]/i);
  if (quoted) {
    name = quoted[1];
    consumed = quoted[0].length;
  } else {
    const intro = restTrimmed.match(PROJECT_NAME_INTRO_RE);
    const introLen = intro ? intro[0].length : 0;
    const body = restTrimmed.slice(introLen);
    const stop = body.search(PROJECT_NAME_STOP_RE);
    name = stop === -1 ? body : body.slice(0, stop);
    consumed = introLen + name.length;
  }

  name = name
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s+project$/i, "")
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  let spanEnd = afterIdx + leadingWs + consumed;

  if (!name) {
    // "create the Sports Nutrition project"
    const before = t.match(
      new RegExp(`\\b(?:${PROJECT_VERBS_SRC})\\s+(?:a\\s+|an\\s+|the\\s+)?(?:new\\s+)?(${PROJECT_NAME_WORD_SRC}(?:\\s+${PROJECT_NAME_WORD_SRC}){0,4}?)\\s+project\\b`, "i")
    );
    if (before && !/^(?:new|a|an|the)$/i.test(before[1])) {
      name = before[1].trim();
      spanEnd = afterIdx;
    }
  }

  const needsName = !name;
  if (needsName) name = "Untitled project";

  return {
    type: "create_project",
    name: titleCase(name).slice(0, 80),
    description: "",
    priority: "medium",
    confidence: needsName ? 0.4 : 0.85,
    needsName,
    raw: t.slice(m.index, spanEnd).trim(),
    span: [m.index, spanEnd],
  };
}

function detectProjectHint(transcript, availableProjects) {
  if (!availableProjects || availableProjects.length === 0) return null;
  const lower = normalize(transcript);
  for (const proj of availableProjects) {
    const nameLower = normalize(proj.name);
    if (nameLower && nameLower.length >= 3 && wordMatch(lower, nameLower)) return proj.id;
    if (proj.tags && proj.tags.some((t) => normalize(t).length >= 4 && wordMatch(lower, normalize(t)))) return proj.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Goals
// ---------------------------------------------------------------------------

const GOAL_SEGMENT_START_RE = /\bgoals?\b\s*(?:like|such as|as|are|is|:|-|–|of|being|to have|include|including|would be|will be|should be|to)?\s+/gi;
const GOAL_STOP_RE =
  /[.;!?\n]|\b(?:tasks?|deadlines?|research|writing|remind|assign|postings?|create|make|note|then|also|next|before|after)\b|\b\d{1,2}(?:st|nd|rd|th)\b/i;

const NUM_SRC = "(\\d+(?:[.,]\\d+)?)\\s*(?:(k|thousand|m|million|lakhs?|crores?)\\b|(%|percent|per cent))?";
const PERIOD_SRC = "monthly|weekly|quarterly|daily|yearly|annually";
const PERIOD_TAIL_SRC =
  "monthly|weekly|quarterly|daily|yearly|annually|per\\s+month|per\\s+week|per\\s+quarter|per\\s+day|per\\s+year|a\\s+month|a\\s+week|a\\s+day|a\\s+year|" +
  "every\\s+month|every\\s+week|every\\s+day|every\\s+quarter|this\\s+month|this\\s+week|this\\s+quarter|this\\s+year|each\\s+month|each\\s+week";

// "instagram followers monthly 500 blog posts weekly 3"  (label → number)
const GOAL_ITEM_RE = new RegExp(
  `([a-z][a-z\\s]{2,40}?)\\s+(?:(${PERIOD_SRC})\\s+)?${NUM_SRC}(?:\\s*(${PERIOD_TAIL_SRC})\\b)?`,
  "gi"
);
// "500 instagram followers monthly and 3 blog posts weekly"  (number → label)
const GOAL_ITEM_NUM_FIRST_RE = new RegExp(
  `${NUM_SRC}\\s+((?:new\\s+)?[a-z][a-z\\s]{2,40}?)(?=\\s*(?:,|;|\\band\\b|\\bplus\\b|$|\\d))`,
  "gi"
);
const PERIOD_IN_LABEL_RE = new RegExp(`\\b(${PERIOD_TAIL_SRC})\\b`, "i");

function normalizePeriod(word) {
  const w = normalize(word);
  if (!w) return null;
  if (/week/.test(w)) return "weekly";
  if (/quarter/.test(w)) return "quarterly";
  if (/month/.test(w)) return "monthly";
  if (/day|daily/.test(w)) return "daily";
  if (/year|annual/.test(w)) return "yearly";
  return null;
}

function multiplier(suffix) {
  const s = normalize(suffix);
  if (s === "k" || s === "thousand") return 1000;
  if (s === "m" || s === "million") return 1000000;
  if (s.startsWith("lakh")) return 100000;
  if (s.startsWith("crore")) return 10000000;
  return 1;
}

const GOAL_LABEL_LEAD_RE = /^(?:and|also|plus|with|like|such as|goals?|add|the|a|an|of|to|for|is|are|be|being|have|having|i want|we want|we need|i need|:|-|–)\s+/i;
const GOAL_LABEL_TRAIL_RE =
  /\s+(?:to|of|by|at|around|about|for|up to|upto|target|targets|is|are|should be|will be|be|reach|reaching|hit|get|getting|approximately|minimum|min|max|maximum|per|a|an|the|and|from|in|with|on)$/i;

function cleanGoalLabel(label, projectName) {
  let l = String(label || "").replace(/\s+/g, " ").trim();
  let prev;

  if (projectName) {
    const pn = escapeRegExp(normalize(projectName));
    if (pn) {
      l = l.replace(new RegExp(`^(?:for|in|of|under)?\\s*${pn}\\s+`, "i"), "");
      l = l.replace(new RegExp(`\\s+(?:for|in|of|under)\\s+${pn}$`, "i"), "");
    }
  }
  // "…project called sports nutrition goals like instagram followers" → "instagram followers"
  l = l.replace(/^.*\bgoals?\s+(?:like|such as|are|:)\s+/i, "");
  l = l.replace(/^.*\bproject\s+(?:called|named)\s+\S+(?:\s+\S+)?\s+/i, "");

  do {
    prev = l;
    l = l.replace(GOAL_LABEL_LEAD_RE, "");
  } while (l !== prev);
  do {
    prev = l;
    l = l.replace(GOAL_LABEL_TRAIL_RE, "");
  } while (l !== prev);

  return l.trim();
}

function buildGoal(rawLabel, numStr, suffix, percent, periodWord, itemText, projectName) {
  let label = cleanGoalLabel(rawLabel, projectName);
  let period = normalizePeriod(periodWord);
  const inLabel = label.match(PERIOD_IN_LABEL_RE);
  if (inLabel) {
    period = period || normalizePeriod(inLabel[1]);
    label = label.replace(PERIOD_IN_LABEL_RE, " ").replace(/\s{2,}/g, " ").trim();
    label = cleanGoalLabel(label, projectName);
  }
  if (!label || label.length < 3) return null;
  if (/^(?:get|reach|hit|achieve|increase|grow|generate|gain|drive|have|make|do|target|about|around)$/i.test(label)) return null;

  let value = parseFloat(String(numStr).replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  value *= multiplier(suffix);

  let finalPeriod = period || "monthly";
  if (finalPeriod === "daily") {
    // Goals only support weekly/monthly/quarterly — fold daily into weekly.
    finalPeriod = "weekly";
    value *= 7;
  } else if (finalPeriod === "yearly") {
    finalPeriod = "onetime";
  }

  return {
    type: "create_goal",
    label: capitalize(label).slice(0, 120),
    category: detectCategory(label),
    targetValue: value,
    currentValue: 0,
    unit: percent ? "%" : "",
    period: finalPeriod,
    confidence: 0.8,
    raw: String(itemText || "").trim(),
  };
}

function goalSegments(text) {
  const t = String(text || "");
  const segments = [];
  let m;
  GOAL_SEGMENT_START_RE.lastIndex = 0;
  while ((m = GOAL_SEGMENT_START_RE.exec(t)) !== null) {
    let seg = t.slice(m.index + m[0].length);
    const stop = seg.search(GOAL_STOP_RE);
    if (stop !== -1) seg = seg.slice(0, stop);
    seg = seg.trim();
    if (seg) segments.push(seg);
    if (m[0].length === 0) GOAL_SEGMENT_START_RE.lastIndex++;
  }
  if (segments.length === 0) {
    // No "goal" word, but "monthly 500" style — take the clause around it.
    const pm = new RegExp(`\\b(?:${PERIOD_SRC})\\s+\\d`, "i").exec(t);
    if (pm) segments.push(clauseAt(t, pm.index));
  }
  return segments;
}

function extractGoals(text, projectName) {
  const goals = [];
  const seen = new Set();

  for (const seg of goalSegments(text)) {
    const numberFirst = /^\s*(?:[a-z]+\s+)?\d/i.test(seg);
    const re = numberFirst ? GOAL_ITEM_NUM_FIRST_RE : GOAL_ITEM_RE;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(seg)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const goal = numberFirst
        ? buildGoal(m[4], m[1], m[2], m[3], null, m[0], projectName)
        : buildGoal(m[1], m[3], m[4], m[5], m[2] || m[6], m[0], projectName);
      if (!goal) continue;
      const key = normalize(goal.label);
      if (seen.has(key)) continue;
      seen.add(key);
      goals.push(goal);
    }
  }
  return goals;
}

// Fallback for goals with no number ("add a goal to improve brand awareness").
function parseGoalFromSentence(sentence) {
  const lower = normalize(sentence);
  if (!/\bgoals?\b/.test(lower)) return null;

  let label = sentence
    .replace(/.*?\bgoals?\b\s*(?:to\s*|of\s*|:\s*|like\s*|is\s*)?/i, "")
    .replace(/\s+assign.*$/i, "")
    .replace(/\s+due.*$/i, "")
    .replace(/\s+by\s+.*$/i, "")
    .trim();
  if (!label) label = sentence.trim();
  label = label.replace(/^(to|that|is|for|of)\s+/i, "").trim();

  let targetValue = 0;
  const numMatch = sentence.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|m)?\b/i);
  if (numMatch) {
    let val = parseFloat(numMatch[1].replace(/,/g, ""));
    if (numMatch[2]?.toLowerCase() === "k") val *= 1000;
    if (numMatch[2]?.toLowerCase() === "m") val *= 1000000;
    targetValue = val;
    label = label.replace(/\s+(?:to|of|by|at)\s+\d[\d,.]*\s*(?:k|m)?\b.*$/i, "").trim();
  }
  label = cleanGoalLabel(label) || label;
  if (label.length < 3) return null;

  return {
    type: "create_goal",
    label: capitalize(label).slice(0, 120),
    category: detectCategory(sentence),
    targetValue,
    currentValue: 0,
    unit: "",
    period: /\bweek/i.test(sentence) ? "weekly" : /\bquarter/i.test(sentence) ? "quarterly" : "monthly",
    confidence: 0.6,
    raw: sentence,
  };
}

// ---------------------------------------------------------------------------
// 6. Clauses / sentences
// ---------------------------------------------------------------------------

// The clause (between sentence punctuation or "and <verb>" seams) that contains `index`.
function clauseAt(text, index) {
  const t = String(text || "");
  const re = new RegExp(CLAUSE_BOUNDARY_SRC, "gi");
  let start = 0;
  let end = t.length;
  let m;
  while ((m = re.exec(t)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (m.index + m[0].length <= index) start = m.index + m[0].length;
    else if (m.index >= index) {
      end = m.index;
      break;
    }
  }
  return t.slice(start, end).trim();
}

function splitIntoSentences(transcript) {
  let t = String(transcript || "");

  // Keep "… and assign (it) to X" glued to the task it belongs to.
  t = t.replace(/\s*(?:,|\band\b|\bthen\b)?\s*\bassign(?:ed)?\s+(?:it\s+|this\s+|that\s+|them\s+)?to\s+/gi, " assigned to ");

  // "… and set the due date to tomorrow" belongs to the preceding command.
  t = t.replace(/\s*(?:,|\band\b|\bthen\b)?\s*\bset\s+(?:the\s+|its\s+|a\s+)?(?:due\s*date|deadline)\s+(?:(?:to|for|as|on|of|at)\s+)?/gi, " due ");

  // Explicit seams before a new command, even without a conjunction.
  t = t.replace(/\s+(?=(?:(?:and|then|also)\s+)?(?:remind|notify)\s+(?:me|us)\b)/gi, ". ");
  t = t.replace(/\s+(?=(?:(?:and|then|also)\s+)?note that\b)/gi, ". ");
  t = t.replace(
    /\s+(?=(?:(?:and|then|also)\s+)?(?:create|add|make|set\s*up)\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:new\s+)?(?:task|goal|project|note|reminder|milestone)s?\b)/gi,
    ". "
  );
  // Conjunction followed by a command verb → seam ("… weekly 3 and do research").
  t = t.replace(new RegExp(`\\s+(?:and\\s+then|and\\s+also|then|also|and)\\s+(?=(?:please\\s+)?(?:${COMMAND_VERBS_SRC})\\b)`, "gi"), ". ");

  return t
    .split(/[.;!?\n]+(?=\s|$)/)
    .map((s) => s.replace(/^\s*(?:and|then|also|please|,)\s+/i, "").trim())
    .filter((s) => s.length > 2);
}

// ---------------------------------------------------------------------------
// 7. Tasks
// ---------------------------------------------------------------------------

function cleanTaskTitle(raw, projectName) {
  let title = String(raw || "").replace(/\s+/g, " ").trim();

  title = title.replace(/^(?:please\s+|can you\s+|could you\s+|kindly\s+)+/i, "");
  // "create a new task to / for / of / with …"
  title = title.replace(
    /^(?:create|add|make|new|open|start|log)\s+(?:a\s+|an\s+|the\s+|one\s+)?(?:new\s+)?(?:task|todo|to-do|item)?\s*(?:called|named|titled|:)?\s*(?:to\s+|for\s+|of\s+|with\s+|about\s+)?/i,
    ""
  );
  title = title.replace(/^(?:i\s+|we\s+)?(?:need to|have to|should|must|want to|would like to|got to|gotta|will)\s+/i, "");
  title = title.replace(/^(?:a\s+)?task\s+(?:to\s+|for\s+|of\s+)?/i, "");
  title = title.replace(/^to\s+/i, "");

  // Assignment split: "design page assigned to Sarah" → "design page"
  const assignSplit = title.split(/\s*,?\s*(?:and\s+)?assign(?:ed)?\s+(?:it\s+|this\s+|that\s+|them\s+)?(?:to\s+)?[A-Za-z@]/i);
  if (assignSplit.length > 1) title = assignSplit[0].trim();
  title = title.replace(/\s*@[a-z0-9._-]+/gi, "");

  // Project mentions: "for project X", "in the project called X", "under <ProjectName>"
  title = title.replace(/\s*,?\s*(?:for|in|under|to|into|on|inside)\s+(?:the\s+)?(?:new\s+)?project\s*(?:called|named|titled)?\b.*$/i, "");
  title = title.replace(/\s*,?\s*(?:for|in|under|into|inside)\s+(?:the\s+)?(?:new\s+)?project\b.*$/i, "");
  if (projectName) {
    title = title.replace(new RegExp(`\\s*,?\\s*(?:for|in|under|into|on|inside)\\s+(?:the\\s+)?${escapeRegExp(projectName)}\\b.*$`, "i"), "");
  }

  title = title.replace(DATE_PHRASE_RE, " ");
  title = title.replace(TIME_PHRASE_RE, " ");

  // Priority words
  title = title.replace(/\s*,?\s*(?:with\s+|as\s+|at\s+|of\s+)?(?:high|low|medium|normal|top|highest|lowest|urgent)\s+priority\b/gi, " ");
  title = title.replace(/\s*,?\s*\b(?:urgent(?:ly)?|asap)\b/gi, " ");

  // Trailing reminder / status clauses
  title = title.replace(/\s*,?\s*(?:and\s+)?(?:remind|notify)\s+(?:me|us)\b.*$/i, "");
  title = title.replace(/\s+(?:shall|should|must|will|needs?\s+to|has\s+to|have\s+to|are\s+to|is\s+to)\s+(?:be\s+)?(?:done|completed|finished|ready|published|delivered|submitted)\b.*$/i, "");
  title = title.replace(/\s+(?:is|are)\s+due\b.*$/i, "");

  // Dangling connectors
  title = title.replace(/[\s,;:.-]+$/g, "");
  let prev;
  do {
    prev = title;
    title = title.replace(/\s+(?:and|or|by|on|for|with|to|the|a|an|of|in|at|from|due)$/i, "");
    title = title.replace(/^(?:and|or|the|a|an|to|for|of|with|in|that)\s+/i, "");
  } while (title !== prev);

  title = title.replace(/\s{2,}/g, " ").trim();
  return capitalize(title);
}

function buildTask(title, sentence, projectHint, confidence, now, overrides = {}) {
  return {
    type: "create_task",
    title: String(title || "").slice(0, 200),
    notes: "",
    dueDate: extractDueDate(sentence, now),
    priority: detectPriority(sentence),
    assigneeHint: extractAssignee(sentence),
    projectHint: projectHint || null,
    status: "todo",
    confidence,
    raw: sentence,
    ...overrides,
  };
}

function parseTaskFromSentence(sentence, projectHint, opts = {}) {
  const lower = normalize(sentence);
  if (!lower) return null;
  const covered = opts.covered || {};

  // Pure project sentences are handled by extractProjectCreation.
  if (isProjectSentence(sentence)) return null;
  // The combined research+writing sentence is split by extractSmartTasks.
  if (covered.researchWriting && RESEARCH_WRITING_RE.test(lower)) return null;
  if (covered.postings && POSTINGS_RE.test(lower)) return null;

  const hasCreation = /\b(?:create|add|make|new task|task to|need to|have to|should|must)\b/.test(lower) || /\btasks?\b/.test(lower);
  const isOnlyAssignment = /^(?:please\s+)?(?:re)?assign\b/.test(lower) && !/\b(?:create|add|task to)\b/.test(lower);
  const isNoteSentence = /\b(?:note that|remember that)\b|^note[:\s]/.test(lower);
  const isReminderSentence = /\b(?:remind|notify)\s+(?:me|us)\b|\breminder\b/.test(lower);

  if (isNoteSentence) return null;
  if (isOnlyAssignment) return null;
  if (isReminderSentence && !hasCreation) return null;
  if (/\bgoals?\b/.test(lower) && !/\btasks?\b/.test(lower)) return null;

  const dueDate = extractDueDate(sentence, opts.now);
  const hasPriority = detectPriority(sentence) !== "medium";
  const startsWithVerb = TASK_VERB_START_RE.test(lower);
  if (!hasCreation && !startsWithVerb && !dueDate && !hasPriority && !TASK_MARKER_RE.test(lower) && !opts.lenient) return null;

  const title = cleanTaskTitle(sentence, opts.projectName);
  if (!title || title.length < 3) return null;
  if (/^(?:task|tasks|it|this|that|something|the task|a task)$/i.test(title)) return null;

  return buildTask(title, sentence, projectHint, hasCreation ? 0.8 : 0.6, opts.now, { dueDate });
}

// "create tasks: write blog post, design graphics and schedule email campaign"
function parseMultipleTasksFromSentence(sentence, projectHint, opts = {}) {
  const m = String(sentence || "").match(/\b(?:tasks|to-?dos|todo items|items)\b\s*(?::|-|–|—|like|such as|are|include|including|as follows|namely|of)?\s+(.+)$/i);
  if (!m) return null;

  const head = sentence.slice(0, m.index + m[0].length - m[1].length);
  const parts = m[1]
    .split(/\s*(?:,|;|\band\b|\bplus\b|\bthen\b)\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);
  if (parts.length < 2) return null;

  const sharedDue = extractDueDate(head, opts.now);
  const sharedAssignee = extractAssignee(head);
  const sharedPriority = detectPriority(head);

  const tasks = [];
  for (const part of parts) {
    const title = cleanTaskTitle(part, opts.projectName);
    if (!title || title.length < 3) continue;
    tasks.push(
      buildTask(title, part, projectHint, 0.75, opts.now, {
        dueDate: extractDueDate(part, opts.now) || sharedDue,
        priority: detectPriority(part) !== "medium" ? detectPriority(part) : sharedPriority,
        assigneeHint: extractAssignee(part) || sharedAssignee,
      })
    );
  }
  return tasks.length >= 2 ? tasks : null;
}

// Recognises the "stages" pattern people dictate for content work:
//   "research and writing deadlines for 4th of September, postings shall be done by 10th"
// → Research (4 Sep), Writing (4 Sep), Postings (10 Sep)
function extractSmartTasks(text, opts = {}) {
  const t = String(text || "");
  const lower = normalize(t);
  const now = opts.now || new Date();
  const projectHint = opts.projectHint || null;
  const tasks = [];
  const covered = { researchWriting: false, postings: false };

  const hasTaskMarker = TASK_MARKER_RE.test(lower);

  // Deadline that applies to the whole stage list: the date spoken right after "deadline(s)".
  let globalDeadline = null;
  const dl = t.match(/\bdeadlines?\b\s*(?:is|are|for|by|on|of|:|-)?\s*([\s\S]{0,60})/i);
  if (dl) globalDeadline = extractDueDate(dl[1], now);

  const rw = RESEARCH_WRITING_RE.exec(t);
  const pm = POSTINGS_RE.exec(t);
  if (rw) {
    const clause = clauseAt(t, rw.index);
    if (!globalDeadline) {
      // Date spoken with the research/writing stage itself — stop before a
      // later postings stage so we don't borrow its date.
      const regionEnd = pm && pm.index > rw.index ? pm.index : t.length;
      globalDeadline = extractDueDate(t.slice(rw.index, regionEnd), now) || extractDueDate(clause, now);
    }
    if (globalDeadline) {
      // Optional topic: "research and writing for the keto article …"
      let topic = "";
      const after = clause.slice(clause.toLowerCase().indexOf(rw[0].toLowerCase()) + rw[0].length);
      const tm = after.match(/^\s+(?:for|on|about|of)\s+(.+?)(?=\s+(?:deadlines?|due|by|before|until|on)\b|[,.;]|$)/i);
      if (tm && !extractDueDate(tm[1], now)) {
        topic = tm[1].replace(/^(?:the|a|an)\s+/i, "").trim().slice(0, 60);
      }
      const suffix = topic ? `: ${capitalize(topic)}` : "";
      const base = { dueDate: globalDeadline, assigneeHint: extractAssignee(clause) };
      tasks.push(buildTask(`Research${suffix}`, clause, projectHint, 0.8, now, base));
      tasks.push(buildTask(`Writing${suffix}`, clause, projectHint, 0.8, now, base));
      covered.researchWriting = true;
    }
  }

  if (pm && (hasTaskMarker || globalDeadline || /\bpostings?\s+(?:shall|should|must|will|need|needs|have|has|to be|are to be)\b/i.test(t))) {
    const clause = clauseAt(t, pm.index);
    // Its own date is whatever is spoken after the word "postings"/"publish".
    const afterWord = clause.slice(Math.max(0, clause.toLowerCase().indexOf(pm[0].toLowerCase())));
    const ownDue = extractDueDate(afterWord, now);
    const title = /publish/i.test(pm[0]) ? "Publishing" : "Postings";
    tasks.push(buildTask(title, clause, projectHint, 0.75, now, { dueDate: ownDue || globalDeadline }));
    covered.postings = true;
  }

  return { tasks, covered, globalDeadline };
}

// ---------------------------------------------------------------------------
// 8. Notes / reminders / assignments
// ---------------------------------------------------------------------------

function parseNoteFromSentence(sentence) {
  const lower = normalize(sentence);
  if (/\b(?:note that|remember that|take a note|make a note)\b/.test(lower) || /^note[:\s]/.test(lower)) {
    let content = sentence
      .replace(/.*?\b(?:note that|remember that|take a note(?: that)?|make a note(?: that)?)\s*/i, "")
      .replace(/^note:\s*/i, "")
      .replace(/^note\s+/i, "")
      .trim();
    if (content.length < 5) content = sentence.trim();
    return {
      type: "create_note",
      text: capitalize(content).slice(0, 500),
      confidence: 0.85,
      raw: sentence,
    };
  }
  return null;
}

function parseReminderFromSentence(sentence, now = new Date()) {
  const lower = normalize(sentence);
  if (!/\b(?:remind|notify)\s+(?:me|us)\b|\breminder\b/.test(lower)) return null;

  const due = extractDueDate(sentence, now);
  const frequency = /\b(?:daily|every ?day|each day)\b/.test(lower)
    ? "daily"
    : /\bweekdays?\b|\bevery weekday\b/.test(lower)
      ? "weekdays"
      : /\b(?:weekly|every week|each week|every (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(lower)
        ? "weekly"
        : /\b(?:hourly|every hour)\b/.test(lower)
          ? "hourly"
          : "once";

  let message = sentence.replace(/^.*?\b(?:remind|notify)\s+(?:me|us)\b\s*/i, "").replace(/^.*?\breminder\b\s*/i, (m) => (m.length === sentence.length ? m : ""));
  message = message
    .replace(/^(?:to|that|about|of|for)\s+/i, "")
    .replace(/\b(?:daily|every ?day|each day|weekly|every week|each week|on weekdays|weekdays|hourly|every hour)\b/gi, " ")
    .replace(DATE_PHRASE_RE, " ")
    .replace(TIME_PHRASE_RE, " ")
    .replace(/^\s*(?:to|that|about|of|for)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .trim();
  if (!message || /^(?:remind|reminder)$/i.test(message)) {
    const m = sentence.match(/(?:remind|notify)\s+(?:me|us)\s+(?:to\s+)?(.+)/i);
    message = m ? m[1].trim() : sentence.trim();
  }

  return {
    type: "create_reminder",
    message: capitalize(message).slice(0, 200),
    dueDate: due,
    frequency,
    confidence: 0.75,
    raw: sentence,
  };
}

function parseAssignmentFromSentence(sentence, now = new Date()) {
  const lower = normalize(sentence);
  if (!/^(?:please\s+)?(?:re)?assign\b/.test(lower)) return null;
  if (/\b(?:create|add)\b.*\btask\b/.test(lower)) return null;
  if (!/\bto\b/.test(lower) && !lower.includes("@")) return null;

  const assignee = extractAssignee(sentence);
  if (!assignee) return null;

  let taskHint = "";
  const m = sentence.match(/assign(?:ed)?\s+(.+?)\s+to\s+/i);
  if (m) taskHint = m[1].trim();
  taskHint = taskHint.replace(/^(?:the|a|an)\s+/i, "").replace(/\s+task$/i, "").trim();
  if (!taskHint) return null;

  return {
    type: "assign_task",
    taskHint,
    assigneeHint: assignee,
    dueDate: extractDueDate(sentence, now),
    confidence: 0.65,
    raw: sentence,
  };
}

// ---------------------------------------------------------------------------
// 9. Generic per-sentence dispatch
// ---------------------------------------------------------------------------

function parseSentence(sentence, opts) {
  const lower = normalize(sentence);
  const note = parseNoteFromSentence(sentence);
  if (note) return [note];

  const hasReminder = /\b(?:remind|notify)\s+(?:me|us)\b|\breminder\b/.test(lower);
  const hasCreation = /\b(?:create|add|make|new task|task to)\b/.test(lower);

  if (hasReminder && !hasCreation) {
    const r = parseReminderFromSentence(sentence, opts.now);
    return r ? [r] : [];
  }
  if (hasReminder && hasCreation) {
    const idx = sentence.search(/\b(?:and\s+|then\s+|also\s+)?(?:remind|notify)\s+(?:me|us)\b/i);
    if (idx > 0) {
      const out = [];
      const task = parseTaskFromSentence(sentence.slice(0, idx), opts.projectHint, opts);
      const reminder = parseReminderFromSentence(sentence.slice(idx), opts.now);
      if (task) out.push(task);
      if (reminder) out.push(reminder);
      return out;
    }
  }

  const multi = parseMultipleTasksFromSentence(sentence, opts.projectHint, opts);
  if (multi) return multi;

  if (/\bgoals?\b/.test(lower) && !/\btasks?\b/.test(lower)) {
    const g = parseGoalFromSentence(sentence);
    return g ? [g] : [];
  }

  const assignment = parseAssignmentFromSentence(sentence, opts.now);
  if (assignment) return [assignment];

  const task = parseTaskFromSentence(sentence, opts.projectHint, opts);
  return task ? [task] : [];
}

// ---------------------------------------------------------------------------
// 10. Dedup / summary
// ---------------------------------------------------------------------------

function actionKey(a) {
  return `${a.type}:${normalize(a.title || a.label || a.message || a.text || a.name || a.taskHint || "")}`;
}

function dedupActions(actions) {
  const seen = new Set();
  const out = [];
  for (const a of actions) {
    const key = actionKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  const goalLabels = new Set(out.filter((a) => a.type === "create_goal").map((a) => normalize(a.label)));
  const projectNames = new Set(out.filter((a) => a.type === "create_project").map((a) => normalize(a.name)));
  return out.filter((a) => {
    if (a.type !== "create_task") return true;
    const t = normalize(a.title);
    return !goalLabels.has(t) && !projectNames.has(t);
  });
}

function generateSummary(transcript, actions) {
  const counts = {};
  (actions || []).forEach((a) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });
  const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
  const parts = [];
  if (counts.create_project) parts.push(plural(counts.create_project, "project"));
  if (counts.create_goal) parts.push(plural(counts.create_goal, "goal"));
  if (counts.create_task) parts.push(plural(counts.create_task, "task"));
  if (counts.create_note) parts.push(plural(counts.create_note, "note"));
  if (counts.assign_task) parts.push(plural(counts.assign_task, "assignment"));
  if (counts.create_reminder) parts.push(plural(counts.create_reminder, "reminder"));

  if (parts.length === 0) return String(transcript || "").slice(0, 120);
  return `Detected ${parts.join(", ")} from voice input`;
}

// ---------------------------------------------------------------------------
// 11. The hybrid pipeline
// ---------------------------------------------------------------------------

function parseTranscript(transcript, context = {}) {
  const { projects = [], collaborators = [] } = context;
  const now = context.now ? new Date(context.now) : new Date();
  const original = String(transcript || "");
  if (!original.trim()) {
    return { actions: [], summary: "No transcript provided", raw: transcript };
  }

  const cleaned = cleanTranscript(original);
  const actions = [];

  // 1. Project first — it becomes the default home for everything else.
  const projectAction = extractProjectCreation(cleaned);
  let working = cleaned;
  let newProjectName = null;
  if (projectAction) {
    const { span, ...action } = projectAction;
    actions.push(action);
    newProjectName = action.needsName ? null : action.name;
    if (span) working = `${cleaned.slice(0, span[0])} . ${cleaned.slice(span[1])}`.replace(/\s{2,}/g, " ").trim();
  }

  const existingProjectId = newProjectName ? null : detectProjectHint(cleaned, projects);
  const projectName = newProjectName || projects.find((p) => p.id === existingProjectId)?.name || null;
  // Name for a brand-new project (the route resolves it after creating), id otherwise.
  const projectHint = newProjectName || existingProjectId || context.currentProjectId || null;
  const covered = { goals: false, researchWriting: false, postings: false };
  const opts = { projectHint, projectName, covered, now };

  // 2. Goals
  if (GOAL_PATTERN_RE.test(working)) {
    const goals = extractGoals(working, projectName);
    if (goals.length > 0) {
      goals.forEach((g) => actions.push({ ...g, projectHint }));
      covered.goals = true;
    }
  }

  // 3. Smart (staged) tasks
  if (SMART_TASK_PATTERN_RE.test(working)) {
    const smart = extractSmartTasks(working, opts);
    smart.tasks.forEach((t) => actions.push(t));
    Object.assign(covered, smart.covered);
  }

  // 4. Generic sentence pass
  for (const sentence of splitIntoSentences(working)) {
    if (sentence.length < 3) continue;
    const lower = normalize(sentence);
    if (isProjectSentence(sentence)) continue;
    if (covered.goals && /\bgoals?\b/.test(lower)) continue;
    if (covered.goals && /\b(?:monthly|weekly|quarterly)\s+\d/.test(lower) && !TASK_VERB_START_RE.test(lower)) continue;
    if (covered.researchWriting && RESEARCH_WRITING_RE.test(lower)) continue;
    if (covered.postings && POSTINGS_RE.test(lower)) continue;
    parseSentence(sentence, opts).forEach((a) => actions.push(a));
  }

  // 5. Reminders extra pass — anything the splitter left attached to another clause.
  const reminderRe = /\b(?:remind|notify)\s+(?:me|us)\b[^.;!?\n]*/gi;
  let rm;
  while ((rm = reminderRe.exec(working)) !== null) {
    const r = parseReminderFromSentence(rm[0], now);
    if (r) actions.push(r);
  }

  // 6. Dedup + attach project
  let final = dedupActions(actions).map((a) => {
    if (a.type !== "create_task" && a.type !== "create_goal") return a;
    const out = { ...a };
    if (newProjectName) {
      out.projectHint = newProjectName;
      delete out.projectId;
    } else if (!out.projectId) {
      if (existingProjectId) out.projectId = existingProjectId;
      else if (context.currentProjectId) out.projectId = context.currentProjectId;
    }
    return out;
  });

  if (final.length === 0 && original.trim().length > 5) {
    final.push({ type: "create_note", text: original.trim().slice(0, 500), confidence: 0.5, raw: original });
  }

  return {
    actions: final,
    summary: generateSummary(original, final),
    raw: transcript,
    cleaned,
    projectHint: newProjectName || existingProjectId || null,
    newProjectName,
    detectedCollaborators: collaborators.filter((c) => {
      const name = normalize(c.name || c.email || "");
      return name && normalize(cleaned).includes(name.split(" ")[0]);
    }),
  };
}

// ---------------------------------------------------------------------------
// 12. Optional LLM front-end
// ---------------------------------------------------------------------------

async function parseWithLLM(transcript, context = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const projectsList = (context.projects || []).map((p) => ({ id: p.id, name: p.name })).slice(0, 20);
    const collabList = (context.collaborators || []).map((c) => ({ name: c.name, email: c.email })).slice(0, 20);
    const today = toISODate(context.now ? new Date(context.now) : new Date());
    const prompt = `You are Deck AI, a project management assistant. Parse this voice transcript into structured actions.
Today is ${today}. The transcript is speech-to-text: fix obvious mishears (e.g. "bread lines" = "deadlines") and ignore filler words.

Available projects: ${JSON.stringify(projectsList)}
Team members: ${JSON.stringify(collabList)}

Transcript: "${transcript}"

Return JSON {"actions": [...], "summary": "..."}; each action has:
- type: "create_project" | "create_task" | "create_goal" | "create_note" | "assign_task" | "create_reminder"
- For create_project: name, description. If the transcript creates a project, EVERY goal/task in the same transcript belongs to it: set projectHint to that project name on them.
- For create_task: title (short, imperative, no dates in it), notes, dueDate (YYYY-MM-DD), priority (low/medium/high), assigneeHint (name), projectHint (project name) or projectId
- For create_goal: label, category (social/ads/seo/content/email/other), targetValue (number), unit, period (weekly/monthly/quarterly/onetime), projectHint
- For create_note: text
- For assign_task: taskHint, assigneeHint
- For create_reminder: message, dueDate, frequency (once/daily/weekly/weekdays)
"research and writing deadlines for 4th of September" means two tasks (Research, Writing) sharing that due date.

Only return valid JSON. Be concise.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("LLM parse failed, falling back to rule-based:", err.message);
    return null;
  }
}

async function smartParse(transcript, context = {}) {
  const cleaned = cleanTranscript(transcript);
  const llmResult = await parseWithLLM(cleaned, context);
  if (llmResult && Array.isArray(llmResult.actions) && llmResult.actions.length > 0) {
    const newProject = llmResult.actions.find((a) => a.type === "create_project" && a.name);
    const actions = llmResult.actions.map((a) => {
      const out = { ...a, confidence: 0.9, raw: transcript };
      if ((a.type === "create_task" || a.type === "create_goal") && newProject && !a.projectHint && !a.projectId) {
        out.projectHint = newProject.name;
      }
      return out;
    });
    return {
      actions,
      summary: llmResult.summary || generateSummary(transcript, actions),
      raw: transcript,
      cleaned,
      newProjectName: newProject ? newProject.name : null,
      source: "llm",
    };
  }
  const ruleResult = parseTranscript(transcript, context);
  return { ...ruleResult, source: "rule-based" };
}

module.exports = {
  parseTranscript,
  smartParse,
  cleanTranscript,
  parseOrdinalDate,
  extractDueDate,
  extractProjectCreation,
  extractGoals,
  extractSmartTasks,
  parseTaskFromSentence,
  parseMultipleTasksFromSentence,
  parseReminderFromSentence,
  parseNoteFromSentence,
  parseAssignmentFromSentence,
  splitIntoSentences,
  cleanTaskTitle,
  detectCategory,
  detectPriority,
  extractAssignee,
  generateSummary,
};
