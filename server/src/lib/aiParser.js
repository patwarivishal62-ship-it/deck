/**
 * Deck Voice AI Parser
 *
 * Two-stage pipeline:
 *   1. LLM parse — used when OPENAI_API_KEY is set. Understands free-form speech.
 *   2. Rule-based fallback — regex heuristics, used when the LLM is missing,
 *      unreachable, timed out, or returned something we cannot use.
 *
 * Two invariants this module is responsible for:
 *
 *   A. Every action it returns has passed through `normalizeActions`, so callers
 *      can trust the action type, the enum values, the date format and the
 *      required fields without re-validating.
 *   B. Every result carries `diagnostics` describing which stage produced it and
 *      why. A degraded parse is reported as degraded instead of being passed off
 *      as AI output.
 */

const { CATEGORY_KEYS, PRIORITY_KEYS, PERIODS, STATUSES } = require("../constants");

const ACTION_TYPES = ["create_project", "create_task", "create_goal", "create_note", "assign_task", "create_reminder"];
const FREQUENCIES = ["once", "daily", "weekdays", "weekly", "hourly"];

const DEFAULT_TIMEOUT_MS = Number(process.env.VOICE_AI_TIMEOUT_MS) || 20000;
const DEFAULT_RETRIES = Number.isFinite(Number(process.env.VOICE_AI_RETRIES))
  ? Number(process.env.VOICE_AI_RETRIES)
  : 1;

/* ------------------------------------------------------------------ *
 * Calendar helpers
 *
 * All "today" maths is done on plain YYYY-MM-DD calendar strings, anchored at
 * noon UTC, so a DST shift or the user's offset can never move the answer by a
 * day. The user's IANA zone decides which calendar day "today" actually is.
 * ------------------------------------------------------------------ */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function normalize(str) {
  return String(str == null ? "" : str).toLowerCase().trim();
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word test. `hasWord("add a task", "ad")` is false — substring matches are not. */
function hasWord(text, word) {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text);
}

/** The user's current calendar day, in their own zone, as YYYY-MM-DD. */
function localISODate(now = new Date(), timeZone) {
  if (!timeZone) return now.toISOString().slice(0, 10);
  try {
    // en-CA formats as YYYY-MM-DD, which is exactly the wire format we want.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function weekdayOf(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** Add whole days to a calendar date. Noon-UTC anchoring keeps this DST-safe. */
function shiftLocalDate(isoDate, days) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  const shifted = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12) + days * 86400000);
  return shifted.toISOString().slice(0, 10);
}

function shiftMonths(isoDate, months) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  const firstOfTarget = new Date(Date.UTC(y, (m || 1) - 1 + months, 1, 12));
  const lastDay = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0, 12)
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(d || 1, lastDay));
  return firstOfTarget.toISOString().slice(0, 10);
}

function lastDayOfMonth(isoDate) {
  const [y, m] = String(isoDate).split("-").map(Number);
  return new Date(Date.UTC(y, m || 1, 0, 12)).toISOString().slice(0, 10);
}

/**
 * Next occurrence of a weekday. `strictlyNext` means "next Monday" rather than
 * "the coming Monday" — i.e. the occurrence in the following week.
 */
function nextWeekdayISO(isoDate, targetDay, strictlyNext = false) {
  const current = weekdayOf(isoDate);
  if (!strictlyNext) {
    return shiftLocalDate(isoDate, (targetDay - current + 7) % 7);
  }
  const daysToNextMonday = ((1 - current + 7) % 7) || 7;
  return shiftLocalDate(isoDate, daysToNextMonday + ((targetDay - 1 + 7) % 7));
}

/**
 * Is this a real calendar date, and is it inside the window a human dictating
 * work could plausibly mean? Past dates are allowed on purpose — people dictate
 * backlog — but 1999 and 2100 are transcription noise, not intent.
 */
function sanitizeISODate(value, todayISO) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yRaw, mRaw, dRaw] = match;
  const year = Number(yRaw);
  const month = Number(mRaw);
  const day = Number(dRaw);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;

  const candidate = `${yRaw}-${mRaw}-${dRaw}`;
  const drift = Math.round((Date.parse(`${candidate}T12:00:00Z`) - Date.parse(`${todayISO}T12:00:00Z`)) / 86400000);
  if (!Number.isFinite(drift)) return null;
  if (drift < -365 || drift > 1095) return null;
  return candidate;
}

/* ------------------------------------------------------------------ *
 * Keyword detection
 * ------------------------------------------------------------------ */

const CATEGORY_ALIASES = {
  social: ["social media", "social", "instagram", "ig", "facebook", "twitter", "x posts", "linkedin", "tiktok", "reels", "followers"],
  ads: ["paid ads", "google ads", "meta ads", "ad spend", "ads", "ad", "advertising", "ppc", "campaign", "roas"],
  seo: ["seo", "search", "organic", "ranking", "rankings", "keyword", "keywords", "backlink", "backlinks", "serp"],
  content: ["content", "blog", "article", "video", "copy", "writing", "post", "reel", "script"],
  email: ["email", "emails", "newsletter", "mail", "drip", "automation", "sequence"],
  other: ["other", "general", "misc"],
};

const PRIORITY_ALIASES = {
  high: ["high priority", "top priority", "high", "urgent", "urgently", "important", "critical", "asap", "p0", "p1"],
  low: ["low priority", "low", "minor", "later", "whenever", "someday", "eventually", "no rush"],
  medium: ["medium", "normal", "moderate"],
};

// Longest alias first so "social media" wins over "social" and "high priority"
// wins over "high".
function buildAliasIndex(table) {
  return Object.entries(table)
    .flatMap(([key, aliases]) => aliases.map((alias) => ({ key, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
}

const CATEGORY_ALIAS_INDEX = buildAliasIndex(CATEGORY_ALIASES);
const PRIORITY_ALIAS_INDEX = buildAliasIndex(PRIORITY_ALIASES);

// "this isn't urgent" must not read as high priority.
const PRIORITY_NEGATION = /\b(?:not|isn'?t|arent|aren't|never|no)\s+(?:that\s+|really\s+|so\s+)?(?:urgent|important|critical|high priority|a priority)\b/gi;

function detectCategory(text) {
  const lower = normalize(text);
  for (const { key, alias } of CATEGORY_ALIAS_INDEX) {
    if (hasWord(lower, alias)) return key;
  }
  return "other";
}

function detectPriority(text) {
  const lower = normalize(text).replace(PRIORITY_NEGATION, " ");
  for (const { key, alias } of PRIORITY_ALIAS_INDEX) {
    if (hasWord(lower, alias)) return key;
  }
  return "medium";
}

function detectPeriod(text) {
  const lower = normalize(text);
  for (const period of ["weekly", "monthly", "quarterly"]) {
    if (hasWord(lower, period)) return period;
  }
  if (/\b(?:one[- ]?time|once)\b/.test(lower)) return "onetime";
  return "monthly";
}

function extractDueDate(text, todayISO = localISODate()) {
  const lower = normalize(text);
  if (!lower) return null;
  const today = sanitizeISODate(todayISO, todayISO) || localISODate();

  if (/\bday after tomorrow\b/.test(lower)) return shiftLocalDate(today, 2);
  if (/\btomorrow\b/.test(lower)) return shiftLocalDate(today, 1);
  if (/\btonight\b/.test(lower) || /\btoday\b/.test(lower)) return today;

  const inDays = lower.match(/\bin\s+(\d{1,3})\s+days?\b/);
  if (inDays) return shiftLocalDate(today, parseInt(inDays[1], 10));
  const inWeeks = lower.match(/\bin\s+(\d{1,2})\s+weeks?\b/);
  if (inWeeks) return shiftLocalDate(today, parseInt(inWeeks[1], 10) * 7);
  const inMonths = lower.match(/\bin\s+(\d{1,2})\s+months?\b/);
  if (inMonths) return shiftMonths(today, parseInt(inMonths[1], 10));

  if (/\bend of (?:the )?month\b/.test(lower)) return lastDayOfMonth(today);
  if (/\bend of (?:the )?week\b/.test(lower)) return nextWeekdayISO(today, 5);
  if (/\bnext week\b/.test(lower)) return nextWeekdayISO(today, 1, true);
  if (/\bthis week\b/.test(lower)) return nextWeekdayISO(today, 5);

  for (let day = 0; day < WEEKDAYS.length; day += 1) {
    const name = WEEKDAYS[day];
    if (!hasWord(lower, name)) continue;
    const strictlyNext = new RegExp(`\\bnext\\s+${name}\\b`).test(lower);
    return nextWeekdayISO(today, day, strictlyNext);
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return sanitizeISODate(`${iso[1]}-${iso[2]}-${iso[3]}`, today);

  const monthFirst = lower.match(
    new RegExp(`\\b(${MONTHS.join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)
  );
  const dayFirst = lower.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join("|")})\\b`)
  );
  const named = monthFirst || dayFirst;
  if (named) {
    const monthName = monthFirst ? named[1] : named[2];
    const dayNum = parseInt(monthFirst ? named[2] : named[1], 10);
    const monthIndex = MONTHS.indexOf(monthName) + 1;
    if (monthIndex > 0 && dayNum >= 1 && dayNum <= 31) {
      const thisYear = `${new Date(`${today}T12:00:00Z`).getUTCFullYear()}-${String(monthIndex).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const resolved = sanitizeISODate(thisYear, today);
      if (resolved) {
        // A named month in the past almost always means next year ("March 5").
        return resolved < today ? sanitizeISODate(shiftMonths(resolved, 12), today) || resolved : resolved;
      }
    }
  }

  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (us) {
    let year = parseInt(us[3], 10);
    if (year < 100) year += 2000;
    return sanitizeISODate(
      `${year}-${String(parseInt(us[1], 10)).padStart(2, "0")}-${String(parseInt(us[2], 10)).padStart(2, "0")}`,
      today
    );
  }
  const usShort = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (usShort) {
    const year = new Date(`${today}T12:00:00Z`).getUTCFullYear();
    const candidate = `${year}-${String(parseInt(usShort[1], 10)).padStart(2, "0")}-${String(parseInt(usShort[2], 10)).padStart(2, "0")}`;
    const resolved = sanitizeISODate(candidate, today);
    if (resolved) return resolved < today ? sanitizeISODate(shiftMonths(resolved, 12), today) || resolved : resolved;
  }

  return null;
}

const ASSIGNEE_STOPWORDS = [
  "me", "us", "team", "everyone", "project", "goal", "task", "it", "this", "that",
  "the", "him", "her", "them", "someone", "myself",
];

function extractAssignee(text, collaborators = []) {
  const patterns = [
    /@([a-z0-9._-]+)/i,
    /assign(?:ed)?\s+(?:it\s+)?to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /assign(?:ed)?\s+(?:it\s+)?to\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    let candidate = match[1]
      .trim()
      .replace(/\s+(high|medium|low|priority|urgent|tomorrow|today|next week|due).*$/i, "")
      .trim();
    if (candidate.length < 2 || candidate.length > 40) continue;
    if (ASSIGNEE_STOPWORDS.includes(candidate.toLowerCase())) continue;

    // Prefer the teammate's canonical name when we can match one. When nothing
    // matches we still return what was heard: the route layer marks it
    // unresolved so the UI can say "no teammate matched" instead of the name
    // silently disappearing. No assigneeId is minted either way, so an
    // unmatched name can never assign work to the wrong person.
    if (collaborators.length > 0) {
      const resolved = matchCollaborator(candidate, collaborators);
      if (resolved) return resolved.name || resolved.email || candidate;
    }
    return candidate;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Rule-based fallback
 * ------------------------------------------------------------------ */

/**
 * A clause that only qualifies the instruction before it. Splitting on "and"
 * in front of one of these is what silently strips the assignee and priority
 * off a task and manufactures a second, bogus action.
 */
const MODIFIER_CLAUSE = /^(?:assign(?:ed)?\s+(?:it\s+)?to|remind\s+me|notify\s+me|due|by|for|on|at|with|priority|high|medium|low|urgent|asap|tomorrow|today|tonight|next)\b/i;

/**
 * Split a long run-on on "and", but only when every clause after the first is
 * an instruction in its own right rather than a modifier of the first.
 * Returns null when the sentence should be left intact.
 */
function splitRunOn(sentence) {
  if (sentence.length <= 80) return null;
  const parts = sentence.split(/\s+and\s+/i).map((p) => p.trim());
  if (parts.length < 2) return null;
  if (parts.some((p) => p.length <= 5)) return null;
  if (parts.some((p, i) => i > 0 && MODIFIER_CLAUSE.test(p))) return null;
  return parts;
}

function splitIntoSentences(transcript) {
  const processed = String(transcript || "")
    .replace(/\s+and\s+remind me\s+/gi, ". remind me ")
    .replace(/\s+and\s+also\s+/gi, ". ")
    .replace(/\s+also\s+remind me\s+/gi, ". remind me ")
    .replace(/\s+;\s*/g, ". ");

  return processed
    .split(/\n+/)
    .flatMap((line) => line.split(/(?:\band then\b|\balso\b|\bplus\b)/i))
    .flatMap((chunk) => chunk.split(/\.\s+/))
    .flatMap((sentence) => {
      const trimmed = sentence.trim().replace(/[.,;:!?]+$/, "").trim();
      if (!trimmed) return [];
      const runOn = splitRunOn(trimmed);
      return runOn ? runOn : [trimmed];
    });
}

/**
 * "create a project called deck" / "make a new project named Website".
 * Returns the action plus the bare name so callers can group the sentences that
 * follow ("in that I want to add goals...") under it.
 */
function parseProjectFromSentence(sentence) {
  const lower = normalize(sentence);
  if (!hasWord(lower, "project")) return null;
  const match = sentence.match(
    /\b(?:create|add|make|start|set\s+up)\s+(?:a\s+|an\s+|new\s+)?project\s*(?:called|named)?\s*[:"]?\s*([^",:.]+)/i
  );
  if (!match) return null;

  let name = match[1]
    .trim()
    .replace(/\s+(okay|ok|please|now|right|and|with|for|in|that|where)\b.*$/i, "")
    .replace(/^[":\s]+|[":\s]+$/g, "")
    .trim();
  if (name.length < 2 || name.length > 60) return null;
  return { type: "create_project", name, raw: sentence };
}

function parseGoalFromSentence(sentence, todayISO) {
  const lower = normalize(sentence);
  if (!hasWord(lower, "goal")) return null;

  let label = sentence
    .replace(/.*?\bgoal\b\s*(?:to\s*)?/i, "")
    .replace(/\s+assign.*$/i, "")
    .replace(/\s+due.*$/i, "")
    .replace(/\s+by\s+.*$/i, "")
    .trim();

  if (!label) label = sentence.replace(/.*goal\s*/i, "").trim();
  if (!label) label = sentence.trim();
  label = label.replace(/^(to|that|is|for)\s+/i, "").trim();
  if (label.length < 5) {
    label = sentence.replace(/^(create|add|make)\s+(a\s+)?goal\s+(to\s+)?/i, "").trim();
  }

  let targetValue = 0;
  const numMatch = sentence.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|m)?\b/i);
  if (numMatch) {
    let value = parseFloat(numMatch[1].replace(/,/g, ""));
    if (numMatch[2]?.toLowerCase() === "k") value *= 1000;
    if (numMatch[2]?.toLowerCase() === "m") value *= 1000000;
    targetValue = value;
  }

  return {
    type: "create_goal",
    label: label.slice(0, 120),
    category: detectCategory(sentence),
    targetValue,
    currentValue: 0,
    unit: "",
    period: detectPeriod(sentence),
    raw: sentence,
  };
}

const TASK_CREATION_WORDS = ["create", "add", "make", "new task", "task to", "need to", "have to", "should", "must"];

function parseTaskFromSentence(sentence, projectHint, todayISO, collaborators = []) {
  const lower = normalize(sentence);
  const hasCreation = TASK_CREATION_WORDS.some((w) => hasWord(lower, w)) || hasWord(lower, "task");
  const isOnlyAssignment = lower.startsWith("assign ") && !hasWord(lower, "create") && !hasWord(lower, "add");
  const isNote = /note that|remember that|^note:/i.test(lower);
  const isReminder = /remind me|reminder|notify me/i.test(lower);

  if (isNote || isOnlyAssignment) return null;
  if (isReminder && !hasCreation) return null;
  if (!hasCreation && lower.length < 15) return null;
  if (hasWord(lower, "goal") && !hasWord(lower, "task")) return null;

  let title = sentence
    .replace(/^(create|add|make|new)\s+(a\s+)?(task\s+)?(to\s+)?/i, "")
    .replace(/^(need to|have to|should|must)\s+/i, "")
    .trim();

  const assignSplit = title.split(/\s+and\s+assign\s+(?:it\s+)?to\s+/i);
  if (assignSplit.length > 1) {
    title = assignSplit[0].trim();
  } else {
    const assignMatch = title.match(/(.+?)\s+assign(?:ed)?\s+(?:it\s+)?to\s+.+$/i);
    if (assignMatch) title = assignMatch[1].trim();
  }

  title = title
    .replace(/\s+for\s+project\s+.*$/i, "")
    .replace(/\s+due\s+.*$/i, "")
    .replace(/\s+by\s+(tomorrow|today|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday).*$/i, "")
    .replace(/\s+for\s+tomorrow.*$/i, "")
    .replace(/\s+and\s+remind me.*$/i, "")
    .trim();

  if (title.length < 3) return null;

  return {
    type: "create_task",
    title: title.slice(0, 200),
    notes: "",
    dueDate: extractDueDate(sentence, todayISO),
    priority: detectPriority(sentence),
    assigneeHint: extractAssignee(sentence, collaborators),
    projectHint: projectHint || null,
    status: "todo",
    raw: sentence,
  };
}

function parseNoteFromSentence(sentence) {
  const lower = normalize(sentence);
  if (!/note that|remember that|^note:|^note\s/i.test(lower)) return null;

  let content = sentence
    .replace(/.*note that\s*/i, "")
    .replace(/.*remember that\s*/i, "")
    .replace(/^note:\s*/i, "")
    .replace(/^note\s+/i, "")
    .trim();
  if (content.length < 5) content = sentence.trim();

  return { type: "create_note", text: content.slice(0, 500), raw: sentence };
}

function parseReminderFromSentence(sentence, todayISO) {
  const lower = normalize(sentence);
  if (!/remind me|reminder|notify me/i.test(lower)) return null;

  let message = sentence
    .replace(/.*\bremind me to\s*/i, "")
    .replace(/.*\breminder to\s*/i, "")
    .replace(/.*\bnotify me to\s*/i, "")
    .replace(/.*\band\s+remind me\s*/i, "")
    .trim();

  if (!message || /^(remind|reminder|notify)/i.test(message)) {
    const match = sentence.match(/remind me (?:to\s+)?(.+)/i);
    message = match ? match[1].trim() : sentence.trim();
  }
  // A trailing "tomorrow / on friday / next week" is the schedule, not the message.
  message = message
    .replace(/[.,;:!?]+$/, "")
    .replace(
      new RegExp(
        `\\s+(?:due|on|by|for)?\\s*(?:tomorrow|today|tonight|next week|this week|end of (?:the )?(?:week|month)|next\\s+(?:${WEEKDAYS.join("|")})|(?:${WEEKDAYS.join("|")})|\\d{4}-\\d{2}-\\d{2})$`,
        "i"
      ),
      ""
    )
    .trim();

  let frequency = "once";
  for (const candidate of ["daily", "weekdays", "weekly", "hourly"]) {
    if (hasWord(lower, candidate)) {
      frequency = candidate;
      break;
    }
  }

  return {
    type: "create_reminder",
    message: (message || sentence).slice(0, 200),
    dueDate: extractDueDate(sentence, todayISO),
    frequency,
    raw: sentence,
  };
}

function parseAssignmentFromSentence(sentence, collaborators = []) {
  const lower = normalize(sentence);
  if (!hasWord(lower, "assign") && !hasWord(lower, "assigned")) return null;
  if ((hasWord(lower, "create") || hasWord(lower, "add")) && hasWord(lower, "task")) return null;

  const assignee = extractAssignee(sentence, collaborators);
  if (!assignee) return null;

  let taskHint = sentence.replace(/assign.*to\s+.*/i, "").replace(/assign\s+/i, "").trim();
  if (!taskHint) {
    const match = sentence.match(/assign\s+(.+?)\s+to\s+/i);
    if (match) taskHint = match[1].trim();
  }

  return { type: "assign_task", taskHint: taskHint || null, assigneeHint: assignee, raw: sentence };
}

function detectProjectHint(transcript, availableProjects = []) {
  if (!availableProjects.length) return null;
  const lower = normalize(transcript);
  let best = null;
  for (const project of availableProjects) {
    const name = normalize(project.name);
    if (name.length >= 3 && hasWord(lower, name)) {
      if (!best || name.length > best.length) best = { id: project.id, length: name.length };
      continue;
    }
    const tags = project.tags || [];
    for (const tag of tags) {
      const normalizedTag = normalize(tag);
      if (normalizedTag.length >= 3 && hasWord(lower, normalizedTag)) {
        if (!best || normalizedTag.length > best.length) best = { id: project.id, length: normalizedTag.length };
      }
    }
  }
  return best ? best.id : null;
}

function parseTranscript(transcript, context = {}) {
  const { projects = [], collaborators = [], timeZone } = context;
  const todayISO = context.todayISO || localISODate(new Date(), timeZone);

  if (!transcript || !transcript.trim()) {
    return { actions: [], summary: "No transcript provided", raw: transcript, todayISO };
  }

  const sentences = splitIntoSentences(transcript);
  const projectHint = detectProjectHint(transcript, projects);
  const actions = [];
  // When the speaker says "create a project called X ... and in it add ...",
  // the goals/tasks that follow belong to X even though X has no id yet. We
  // carry the spoken name so the route layer can attach them after creating it.
  let pendingProject = null;

  for (const sentence of sentences) {
    if (sentence.length < 3) continue;
    const lower = normalize(sentence);
    const sentenceActions = [];

    const hasReminder = /remind me|reminder|notify me/i.test(lower);
    const hasTaskCreation = hasWord(lower, "create") || hasWord(lower, "add") || hasWord(lower, "task");

    if (hasReminder && hasTaskCreation) {
      const parts = sentence.split(/\s+and\s+remind me\s+/i);
      if (parts.length > 1) {
        const taskAction = parseTaskFromSentence(parts[0], projectHint, todayISO, collaborators);
        const reminderAction = parseReminderFromSentence(`remind me ${parts[1]}`, todayISO);
        if (taskAction) sentenceActions.push(taskAction);
        if (reminderAction) sentenceActions.push(reminderAction);
      } else {
        const taskAction = parseTaskFromSentence(sentence, projectHint, todayISO, collaborators);
        const reminderAction = parseReminderFromSentence(sentence, todayISO);
        if (taskAction && !/remind/i.test(taskAction.title || "")) sentenceActions.push(taskAction);
        if (reminderAction) sentenceActions.push(reminderAction);
      }
    } else {
      const projectAction = parseProjectFromSentence(sentence);
      if (projectAction) {
        sentenceActions.push(projectAction);
        pendingProject = projectAction.name;
      } else {
        const parsers = [
          (s) => parseGoalFromSentence(s, todayISO),
          (s) => parseReminderFromSentence(s, todayISO),
          parseNoteFromSentence,
          (s) => parseTaskFromSentence(s, projectHint || pendingProject, todayISO, collaborators),
          (s) => parseAssignmentFromSentence(s, collaborators),
        ];
        for (const parser of parsers) {
          const parsed = parser(sentence);
          if (parsed) {
            sentenceActions.push(parsed);
            break;
          }
        }
      }
    }

    // Nothing matched. Only guess a task when the sentence actually sounds like
    // an instruction; otherwise record a note. Guessing tasks from chatter is
    // how phantom to-dos get created.
    if (sentenceActions.length === 0 && sentence.length > 15) {
      const looksLikeInstruction = TASK_CREATION_WORDS.some((w) => hasWord(lower, w));
      if (looksLikeInstruction) {
        sentenceActions.push({
          type: "create_task",
          title: sentence.slice(0, 200),
          notes: "",
          dueDate: extractDueDate(sentence, todayISO),
          priority: detectPriority(sentence),
          assigneeHint: extractAssignee(sentence, collaborators),
          projectId: projectHint || context.currentProjectId || null,
          status: "todo",
          raw: sentence,
        });
      } else {
        sentenceActions.push({
          type: "create_note",
          text: sentence.slice(0, 500),
          raw: sentence,
        });
      }
    }

    for (const action of sentenceActions) {
      if (action.type === "create_task" || action.type === "create_goal") {
        if (!action.projectId) action.projectId = projectHint || context.currentProjectId || null;
        if (!action.projectId && !action.projectHint && pendingProject) action.projectHint = pendingProject;
      }
      actions.push(action);
    }
  }

  if (actions.length === 0 && transcript.trim().length > 5) {
    actions.push({ type: "create_note", text: transcript.slice(0, 500), raw: transcript });
  }

  return {
    actions,
    summary: generateSummary(transcript, actions),
    raw: transcript,
    projectHint,
    todayISO,
    detectedCollaborators: collaborators.filter((c) => {
      const first = normalize(c.name || c.email || "").split(" ")[0];
      return first.length > 1 && hasWord(normalize(transcript), first);
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Normalization — the single gate every action passes through
 * ------------------------------------------------------------------ */

function clampEnum(value, allowed, fallback) {
  const normalized = normalize(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function matchCollaborator(hint, collaborators = []) {
  if (!hint) return null;
  const target = hint.toLowerCase().trim();
  if (!target) return null;

  const byEmail = collaborators.find((c) => (c.email || "").toLowerCase() === target);
  if (byEmail) return byEmail;
  const byName = collaborators.find((c) => (c.name || "").toLowerCase() === target);
  if (byName) return byName;

  const firstName = target.split(" ")[0];
  const byFirstName = collaborators.filter((c) => {
    const parts = (c.name || "").toLowerCase().split(" ").filter(Boolean);
    return parts[0] === firstName;
  });
  // Only accept a first-name match when it is unambiguous.
  if (byFirstName.length === 1) return byFirstName[0];

  const byFullEmailPrefix = collaborators.find((c) => (c.email || "").toLowerCase().split("@")[0] === target);
  return byFullEmailPrefix || null;
}

/**
 * Per-type required-field checks, used both to reject unusable actions and to
 * score the ones we keep. Confidence is derived from how much of the action was
 * actually understood, so the number in the UI means something.
 */
function completenessChecks(action) {
  switch (action.type) {
    case "create_project":
      return [
        Boolean((action.name || "").trim().length >= 3),
        Boolean((action.name || "").trim().length >= 6),
      ];
    case "create_task":
      return [
        Boolean((action.title || "").trim().length >= 6),
        !/\bremind\b|\bnote that\b/i.test(action.title || ""),
        Boolean(action.dueDate),
        action.priority !== "medium",
        Boolean(action.assigneeHint || action.assigneeId),
        Boolean(action.projectId),
      ];
    case "create_goal":
      return [
        Boolean((action.label || "").trim().length >= 4),
        Number(action.targetValue) > 0,
        Boolean((action.unit || "").trim()),
        action.category !== "other",
        Boolean(action.projectId),
      ];
    case "create_note":
      return [Boolean((action.text || "").trim().length >= 10), Boolean((action.text || "").trim().length >= 40)];
    case "assign_task":
      return [Boolean(action.assigneeHint || action.assigneeId), Boolean((action.taskHint || "").trim().length >= 4)];
    case "create_reminder":
      return [
        Boolean((action.message || "").trim().length >= 5),
        Boolean(action.dueDate),
        action.frequency !== "once",
      ];
    default:
      return [];
  }
}

function scoreAction(action, source) {
  const checks = completenessChecks(action);
  const ratio = checks.length ? checks.filter(Boolean).length / checks.length : 0.5;
  const base = source === "llm" ? 0.55 : 0.45;
  return Math.round(Math.min(0.97, base + ratio * 0.4) * 100) / 100;
}

/**
 * Validate + coerce a raw action list into something the DB layer can consume.
 * Returns the usable actions and a list of what was dropped and why, so nothing
 * disappears silently.
 */
function normalizeActions(rawActions, options = {}) {
  const { source = "rule-based", todayISO = localISODate(), transcript = "" } = options;
  const list = Array.isArray(rawActions) ? rawActions : [];
  const actions = [];
  const rejected = [];

  list.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      rejected.push({ index, reason: "not an object" });
      return;
    }
    const type = normalize(raw.type);
    if (!ACTION_TYPES.includes(type)) {
      rejected.push({ index, type: raw.type ?? null, reason: "unknown action type" });
      return;
    }

    const action = { type, raw: raw.raw || raw.source || transcript.slice(0, 200) };

    if (type === "create_project") {
      const name = String(raw.name || raw.title || "").trim().slice(0, 60);
      if (name.length < 2) {
        rejected.push({ index, type, reason: "missing project name" });
        return;
      }
      action.name = name;
      action.description = String(raw.description || "").trim().slice(0, 300);
    } else if (type === "create_task") {
      const title = String(raw.title || raw.label || "").trim().slice(0, 200);
      if (title.length < 3) {
        rejected.push({ index, type, reason: "title too short" });
        return;
      }
      action.title = title;
      action.notes = String(raw.notes || "").trim().slice(0, 2000);
      action.dueDate = sanitizeISODate(raw.dueDate, todayISO);
      action.priority = clampEnum(raw.priority, PRIORITY_KEYS, "medium");
      action.status = clampEnum(raw.status, STATUSES, "todo");
      action.assigneeHint = raw.assigneeHint ? String(raw.assigneeHint).slice(0, 80) : null;
      action.assigneeId = raw.assigneeId || null;
      action.projectId = raw.projectId || null;
      action.projectHint = raw.projectHint ? String(raw.projectHint).slice(0, 80) : null;
      action.goalId = raw.goalId || null;
    } else if (type === "create_goal") {
      const label = String(raw.label || raw.title || "").trim().slice(0, 120);
      if (!label) {
        rejected.push({ index, type, reason: "missing label" });
        return;
      }
      action.label = label;
      action.category = clampEnum(raw.category, CATEGORY_KEYS, "other");
      action.period = clampEnum(raw.period, PERIODS, "monthly");
      const target = Number(raw.targetValue);
      action.targetValue = Number.isFinite(target) && target > 0 ? target : 0;
      const current = Number(raw.currentValue);
      action.currentValue = Number.isFinite(current) && current > 0 ? current : 0;
      action.unit = String(raw.unit || "").trim().slice(0, 24);
      action.platform = String(raw.platform || "").trim().slice(0, 60);
      action.projectId = raw.projectId || null;
      action.projectHint = raw.projectHint ? String(raw.projectHint).slice(0, 80) : null;
    } else if (type === "create_note") {
      const text = String(raw.text || raw.title || raw.content || "").trim().slice(0, 500);
      if (!text) {
        rejected.push({ index, type, reason: "missing note text" });
        return;
      }
      action.text = text;
    } else if (type === "assign_task") {
      const assigneeHint = raw.assigneeHint ? String(raw.assigneeHint).trim().slice(0, 80) : null;
      if (!assigneeHint && !raw.assigneeId) {
        rejected.push({ index, type, reason: "missing assignee" });
        return;
      }
      action.assigneeHint = assigneeHint;
      action.assigneeId = raw.assigneeId || null;
      action.taskHint = raw.taskHint ? String(raw.taskHint).trim().slice(0, 200) : null;
      action.taskId = raw.taskId || null;
    } else if (type === "create_reminder") {
      const message = String(raw.message || raw.text || raw.title || "").trim().slice(0, 200);
      if (!message) {
        rejected.push({ index, type, reason: "missing reminder message" });
        return;
      }
      action.message = message;
      action.dueDate = sanitizeISODate(raw.dueDate, todayISO);
      action.frequency = clampEnum(raw.frequency, FREQUENCIES, "once");
    }

    action.confidence = scoreAction(action, source);
    action.needsReview = action.confidence < 0.7;
    actions.push(action);
  });

  return { actions, rejected };
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

const TYPE_LABELS = {
  create_project: "project",
  create_task: "task",
  create_goal: "goal",
  create_note: "note",
  assign_task: "assignment",
  create_reminder: "reminder",
};

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function generateSummary(transcript, actions = []) {
  const counts = {};
  actions.forEach((action) => {
    counts[action.type] = (counts[action.type] || 0) + 1;
  });

  const parts = ACTION_TYPES.filter((type) => counts[type]).map((type) => pluralize(counts[type], TYPE_LABELS[type]));
  if (parts.length === 0) return String(transcript || "").slice(0, 120) || "Nothing detected";

  const details = [];
  const dated = actions.filter((a) => a.dueDate);
  if (dated.length) details.push(`${pluralize(dated.length, "due date")} (${dated.slice(0, 2).map((a) => a.dueDate).join(", ")})`);

  const assigned = actions.filter((a) => a.assigneeHint || a.assigneeId);
  if (assigned.length) {
    const names = [...new Set(assigned.map((a) => a.assignee?.name || a.assigneeHint).filter(Boolean))];
    if (names.length) details.push(`assigned to ${names.slice(0, 3).join(", ")}`);
  }

  const flagged = actions.filter((a) => a.needsReview).length;
  if (flagged) details.push(`${pluralize(flagged, "item")} to review`);

  return `${parts.join(", ")}${details.length ? ` — ${details.join(", ")}` : ""}`;
}

/* ------------------------------------------------------------------ *
 * LLM stage
 * ------------------------------------------------------------------ */

/**
 * Pull the first balanced JSON object out of a model response. Handles ```json
 * fences and leading/trailing prose. A naive /\{[\s\S]*\}/ grabs from the first
 * brace to the last, which silently merges prose and JSON when both are present.
 */
function extractJSON(content) {
  if (typeof content !== "string" || !content.trim()) return null;

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    /* fall through to a balanced-brace scan */
  }

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function buildPrompt(transcript, context, todayISO) {
  const projects = (context.projects || []).slice(0, 20).map((p) => ({ id: p.id, name: p.name }));
  const collaborators = (context.collaborators || []).slice(0, 20).map((c) => ({ name: c.name, email: c.email }));
  const weekday = WEEKDAYS[weekdayOf(todayISO)];
  const zone = context.timeZone || "UTC";

  return `You are Deck AI, a project management assistant. Convert a voice transcript into structured actions.

TODAY IS ${todayISO}, which is a ${weekday}. The user's time zone is ${zone}.
Resolve every relative date ("tomorrow", "next Friday", "end of month") against that date and return it as YYYY-MM-DD.

Available projects (use these exact ids for projectId): ${JSON.stringify(projects)}
Team members (assigneeHint must be one of these names, or null): ${JSON.stringify(collaborators)}

Transcript: """${transcript}"""

Return a single JSON object, no prose, of the shape:
{
  "summary": "one short sentence describing what was captured",
  "actions": [ ... ]
}

Each action needs "type" plus the fields for that type:
- "create_project": name
- "create_task": title, notes, dueDate (YYYY-MM-DD or null), priority ("low"|"medium"|"high"), assigneeHint (name or null), projectId or projectHint
- "create_goal": label, category ("social"|"ads"|"seo"|"content"|"email"|"other"), targetValue (number), unit, period ("weekly"|"monthly"|"quarterly"|"onetime"), projectId or projectHint
- "create_note": text
- "assign_task": taskHint, assigneeHint
- "create_reminder": message, dueDate (YYYY-MM-DD or null), frequency ("once"|"daily"|"weekly"|"weekdays"|"hourly")

Rules:
- Split one transcript into as many actions as it genuinely contains.
- If the user asks to create a project and then add goals/tasks "in it" or "to it", emit one create_project action and set "projectHint" to that new project's NAME on those goals/tasks (do not use projectId for a project that does not exist yet).
- A phrase like "social media postings of monthly 15" is a goal with category "social", targetValue 15, period "monthly". "X of N" / "N per period" both mean targetValue N.
- Omit fields the user did not state rather than inventing them; use null for dates they did not mention.
- Only use a projectId that appears in the list above.
- Return {"summary": "", "actions": []} if the transcript contains no actionable request.`;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

async function callOpenAI({ apiKey, model, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = new Error(`OpenAI responded ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned no content");
    const parsed = extractJSON(content);
    if (!parsed) throw new Error("OpenAI response was not valid JSON");
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns { ok, data, error } rather than null, so the caller can tell
 * "no API key" apart from "the model failed" apart from "the output was junk".
 */
async function parseWithLLM(transcript, context = {}, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-openai-key") {
    return { ok: false, error: "OPENAI_API_KEY is not configured" };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const retries = Number.isFinite(options.retries) ? options.retries : DEFAULT_RETRIES;
  const todayISO = context.todayISO || localISODate(new Date(), context.timeZone);
  const prompt = buildPrompt(transcript, context, todayISO);

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const data = await callOpenAI({ apiKey, model, prompt, timeoutMs });
      return { ok: true, data, model };
    } catch (err) {
      lastError = err;
      const retryable = err.name === "AbortError" || RETRYABLE_STATUS.has(err.status);
      if (!retryable || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  const message = lastError?.name === "AbortError" ? `timed out after ${timeoutMs}ms` : lastError?.message || "unknown error";
  return { ok: false, error: message, model };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

async function smartParse(transcript, context = {}) {
  const startedAt = Date.now();
  const timeZone = context.timeZone;
  const todayISO = context.todayISO || localISODate(new Date(), timeZone);
  const base = { raw: transcript, todayISO };

  if (!transcript || !transcript.trim()) {
    return {
      ...base,
      actions: [],
      summary: "No transcript provided",
      source: "none",
      degraded: false,
      diagnostics: { source: "none", reason: "empty transcript", durationMs: 0, rejected: [] },
    };
  }

  const llm = await parseWithLLM(transcript, { ...context, todayISO });

  if (llm.ok) {
    const { actions, rejected } = normalizeActions(llm.data?.actions, {
      source: "llm",
      todayISO,
      transcript,
    });

    if (actions.length > 0) {
      const summary = typeof llm.data?.summary === "string" && llm.data.summary.trim()
        ? llm.data.summary.trim().slice(0, 300)
        : generateSummary(transcript, actions);

      return {
        ...base,
        actions,
        summary,
        source: "llm",
        degraded: false,
        diagnostics: {
          source: "llm",
          model: llm.model,
          reason: "llm parse succeeded",
          durationMs: Date.now() - startedAt,
          rejected,
        },
      };
    }

    // The model answered, but with nothing usable. Fall through to rules and say so.
    const fallback = parseTranscript(transcript, { ...context, todayISO });
    const fallbackNormalized = normalizeActions(fallback.actions, {
      source: "rule-based",
      todayISO,
      transcript,
    });
    return {
      ...base,
      actions: fallbackNormalized.actions,
      summary: generateSummary(transcript, fallbackNormalized.actions),
      projectHint: fallback.projectHint,
      detectedCollaborators: fallback.detectedCollaborators,
      source: "rule-based",
      degraded: true,
      diagnostics: {
        source: "rule-based",
        model: llm.model,
        reason: "LLM returned no usable actions",
        durationMs: Date.now() - startedAt,
        rejected,
      },
    };
  }

  const fallback = parseTranscript(transcript, { ...context, todayISO });
  const { actions, rejected } = normalizeActions(fallback.actions, {
    source: "rule-based",
    todayISO,
    transcript,
  });

  return {
    ...base,
    actions,
    summary: generateSummary(transcript, actions),
    projectHint: fallback.projectHint,
    detectedCollaborators: fallback.detectedCollaborators,
    source: "rule-based",
    degraded: true,
    diagnostics: {
      source: "rule-based",
      reason: llm.error,
      llmError: llm.error,
      durationMs: Date.now() - startedAt,
      rejected,
    },
  };
}

module.exports = {
  // pipeline
  smartParse,
  parseTranscript,
  parseWithLLM,
  // normalization
  normalizeActions,
  scoreAction,
  sanitizeISODate,
  matchCollaborator,
  extractJSON,
  // helpers (also used by routes and tests)
  localISODate,
  shiftLocalDate,
  nextWeekdayISO,
  detectCategory,
  detectPriority,
  extractDueDate,
  extractAssignee,
  generateSummary,
  hasWord,
  // enums
  ACTION_TYPES,
  FREQUENCIES,
};
