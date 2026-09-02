/**
 * Deck Voice AI Parser
 */

const CATEGORY_ALIASES = {
  social: ["social", "social media", "instagram", "facebook", "twitter", "linkedin", "tiktok"],
  ads: ["ads", "ad", "paid ads", "google ads", "meta ads", "advertising", "ppc", "campaign"],
  seo: ["seo", "search", "organic", "ranking", "keyword", "backlink"],
  content: ["content", "blog", "article", "video", "copy", "writing", "post"],
  email: ["email", "newsletter", "mail", "drip", "automation"],
  other: ["other", "general", "misc"],
};

const PRIORITY_ALIASES = {
  high: ["high", "urgent", "important", "critical", "asap"],
  medium: ["medium", "normal", "moderate"],
  low: ["low", "minor", "later"],
};

function normalize(str) {
  return String(str || "").toLowerCase().trim();
}

function detectCategory(text) {
  const lower = normalize(text);
  for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => lower.includes(a))) return cat;
  }
  return "other";
}

function detectPriority(text) {
  const lower = normalize(text);
  for (const [prio, aliases] of Object.entries(PRIORITY_ALIASES)) {
    if (aliases.some((a) => lower.includes(a))) return prio;
  }
  return "medium";
}

function extractDueDate(text) {
  const lower = normalize(text);
  const today = new Date();
  if (lower.includes("today")) return today.toISOString().slice(0, 10);
  if (lower.includes("tomorrow")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (lower.includes("next week")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  if (lower.includes("next monday")) {
    const d = new Date(today);
    const daysUntilMonday = (1 + 7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    return d.toISOString().slice(0, 10);
  }
  const inDaysMatch = lower.match(/in (\d+) days?/);
  if (inDaysMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10));
    return d.toISOString().slice(0, 10);
  }
  const inWeeksMatch = lower.match(/in (\d+) weeks?/);
  if (inWeeksMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inWeeksMatch[1], 10) * 7);
    return d.toISOString().slice(0, 10);
  }
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const usMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    let year = parseInt(usMatch[3], 10);
    if (year < 100) year += 2000;
    const month = String(parseInt(usMatch[1], 10)).padStart(2, "0");
    const day = String(parseInt(usMatch[2], 10)).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

function extractAssignee(text) {
  const patterns = [
    /assign(?:ed)?\s+(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /assign(?:ed)?\s+(?:to\s+)?([a-z]+(?:\s+[a-z]+)?)\s*(?:,|\.|$|high|medium|low|priority|tomorrow|today|next)/i,
    /@([a-z0-9._-]+)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let candidate = m[1].trim();
      candidate = candidate.replace(/\s+(high|medium|low|priority|urgent|tomorrow|today|next week).*$/i, "").trim();
      const lower = candidate.toLowerCase();
      if (["me", "us", "team", "everyone", "project", "goal", "task", "it", "this", "that"].includes(lower)) continue;
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
      if (!["do", "be", "create", "add", "make"].includes(cand.toLowerCase())) return cand;
    }
  }
  return null;
}

function splitIntoSentences(transcript) {
  // Split by common conjunctions, but keep it smart
  // First, handle "and remind me" as separate
  let processed = transcript
    .replace(/\s+and\s+remind me\s+/gi, ". remind me ")
    .replace(/\s+and\s+also\s+/gi, ". ")
    .replace(/\s+also\s+remind me\s+/gi, ". remind me ");

  return processed
    .split(/(?:\band then\b|\balso\b|;\s*|\n)/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      // Split by ". " or " and " when it seems like separate tasks
      const parts = [];
      // If sentence has multiple "and" with task indicators, split
      if (s.toLowerCase().includes(" and ") && s.length > 80) {
        // Try splitting by " and " but keep reminder parts separate
        const sub = s.split(/\s+and\s+/i);
        // If any part contains reminder keywords, keep it separate
        for (const p of sub) {
          if (p.trim().length > 5) parts.push(p.trim());
        }
        return parts.length > 1 ? parts : [s];
      }
      if (s.includes(". ")) return s.split(/\.\s+/).map((x) => x.trim()).filter(Boolean);
      return [s];
    });
}

function parseGoalFromSentence(sentence) {
  const lower = normalize(sentence);
  if (!lower.includes("goal")) return null;

  let label = sentence
    .replace(/.*?\bgoal\b\s*(?:to\s*)?/i, "")
    .replace(/\s+assign.*$/i, "")
    .replace(/\s+due.*$/i, "")
    .replace(/\s+by\s+.*$/i, "")
    .trim();

  if (!label) label = sentence.replace(/.*goal\s*/i, "").trim();
  if (!label) label = sentence.trim();
  label = label.replace(/^(to|that|is|for)\s+/i, "").trim();

  let targetValue = 0;
  const numMatch = sentence.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|m)?/i);
  if (numMatch) {
    let val = parseFloat(numMatch[1].replace(/,/g, ""));
    if (numMatch[2]?.toLowerCase() === "k") val *= 1000;
    if (numMatch[2]?.toLowerCase() === "m") val *= 1000000;
    targetValue = val;
  }

  if (label.length < 5) {
    label = sentence.replace(/^(create|add|make)\s+(a\s+)?goal\s+(to\s+)?/i, "").trim();
  }

  return {
    type: "create_goal",
    label: label.slice(0, 120),
    category: detectCategory(sentence),
    targetValue,
    currentValue: 0,
    unit: "",
    period: "monthly",
    confidence: 0.7,
    raw: sentence,
  };
}

function parseTaskFromSentence(sentence, projectHint) {
  const lower = normalize(sentence);
  const creationWords = ["create", "add", "make", "new task", "task to", "need to", "have to", "should", "must"];
  const hasCreation = creationWords.some((w) => lower.includes(w)) || lower.includes("task");
  const isOnlyAssignment = lower.startsWith("assign ") && !lower.includes("create") && !lower.includes("add") && !lower.includes("task to");
  const isNoteSentence = lower.includes("note that") || lower.includes("remember that") || lower.match(/^note:/);
  const isReminderSentence = lower.includes("remind me") || lower.includes("reminder") || lower.includes("notify me");

  if (isNoteSentence) return null;
  if (isOnlyAssignment) return null;
  if (isReminderSentence && !hasCreation) return null; // pure reminder, not task
  if (!hasCreation && lower.length < 15) return null;
  if (lower.includes("goal") && !lower.includes("task")) return null;

  let title = sentence
    .replace(/^(create|add|make|new)\s+(a\s+)?(task\s+)?(to\s+)?/i, "")
    .replace(/^(need to|have to|should|must)\s+/i, "")
    .trim();

  const assignSplit = title.split(/\s+and\s+assign\s+to\s+/i);
  if (assignSplit.length > 1) {
    title = assignSplit[0].trim();
  } else {
    const assignMatch = title.match(/(.+?)\s+assign(?:ed)?\s+to\s+.+$/i);
    if (assignMatch) title = assignMatch[1].trim();
  }

  title = title
    .replace(/\s+for\s+project\s+.*$/i, "")
    .replace(/\s+due\s+.*$/i, "")
    .replace(/\s+by\s+(tomorrow|today|next week|monday|friday).*$/i, "")
    .replace(/\s+for\s+tomorrow.*$/i, "")
    .replace(/\s+and\s+remind me.*$/i, "")
    .trim();

  if (title.length < 3) return null;
  if (title.length > 200) title = title.slice(0, 200);

  return {
    type: "create_task",
    title,
    notes: "",
    dueDate: extractDueDate(sentence),
    priority: detectPriority(sentence),
    assigneeHint: extractAssignee(sentence),
    projectHint: projectHint || null,
    status: "todo",
    confidence: 0.75,
    raw: sentence,
  };
}

function parseNoteFromSentence(sentence) {
  const lower = normalize(sentence);
  if (lower.includes("note that") || lower.includes("remember that") || lower.match(/^note:/i) || lower.startsWith("note ")) {
    let content = sentence
      .replace(/.*note that\s*/i, "")
      .replace(/.*remember that\s*/i, "")
      .replace(/^note:\s*/i, "")
      .replace(/^note\s+/i, "")
      .trim();
    if (content.length < 5) content = sentence.trim();
    return {
      type: "create_note",
      text: content.slice(0, 500),
      confidence: 0.85,
      raw: sentence,
    };
  }
  return null;
}

function parseReminderFromSentence(sentence) {
  const lower = normalize(sentence);
  if (lower.includes("remind me") || lower.includes("reminder") || lower.includes("notify me")) {
    const due = extractDueDate(sentence);
    let message = sentence
      .replace(/remind me to\s*/i, "")
      .replace(/reminder to\s*/i, "")
      .replace(/notify me to\s*/i, "")
      .replace(/.*and\s+remind me\s*/i, "")
      .trim()
      .slice(0, 200);
    if (!message || message.toLowerCase() === "remind me" || message.toLowerCase().startsWith("remind")) {
      // Try to get meaningful part
      const m = sentence.match(/remind me (?:to\s+)?(.+)/i);
      if (m) message = m[1].trim().slice(0, 200);
    }
    if (!message) message = sentence.slice(0, 200);
    return {
      type: "create_reminder",
      message,
      dueDate: due,
      frequency: lower.includes("daily") ? "daily" : lower.includes("weekly") ? "weekly" : lower.includes("weekdays") ? "weekdays" : lower.includes("hourly") ? "hourly" : "once",
      confidence: 0.75,
      raw: sentence,
    };
  }
  return null;
}

function parseAssignmentFromSentence(sentence) {
  const lower = normalize(sentence);
  if (!lower.includes("assign")) return null;
  if ((lower.includes("create") || lower.includes("add")) && lower.includes("task")) return null;
  if (!lower.includes("to") && !lower.includes("@")) return null;

  const assignee = extractAssignee(sentence);
  if (!assignee) return null;

  let taskHint = sentence.replace(/assign.*to\s+.*/i, "").replace(/assign\s+/i, "").trim();
  if (!taskHint) {
    const m = sentence.match(/assign\s+(.+?)\s+to\s+/i);
    if (m) taskHint = m[1].trim();
  }

  return {
    type: "assign_task",
    taskHint: taskHint || null,
    assigneeHint: assignee,
    confidence: 0.65,
    raw: sentence,
  };
}

function detectProjectHint(transcript, availableProjects) {
  if (!availableProjects || availableProjects.length === 0) return null;
  const lower = normalize(transcript);
  for (const proj of availableProjects) {
    const nameLower = normalize(proj.name);
    if (nameLower && lower.includes(nameLower)) return proj.id;
    if (proj.tags && proj.tags.some((t) => lower.includes(normalize(t)))) return proj.id;
  }
  return null;
}

function parseTranscript(transcript, context = {}) {
  const { projects = [], collaborators = [] } = context;
  if (!transcript || !transcript.trim()) {
    return { actions: [], summary: "No transcript provided", raw: transcript };
  }

  const sentences = splitIntoSentences(transcript);
  const actions = [];
  const projectHint = detectProjectHint(transcript, projects);

  for (const sentence of sentences) {
    if (sentence.length < 3) continue;

    // Try to extract multiple action types from same sentence (e.g., task + reminder)
    const sentenceActions = [];

    // Check for reminder first if sentence contains reminder keywords
    const lower = normalize(sentence);
    const hasReminder = lower.includes("remind me") || lower.includes("reminder");
    const hasTaskCreation = lower.includes("create") || lower.includes("add") || lower.includes("task to");

    if (hasReminder && hasTaskCreation) {
      // Split into task part and reminder part
      const parts = sentence.split(/\s+and\s+remind me\s+/i);
      if (parts.length > 1) {
        const taskPart = parts[0];
        const reminderPart = "remind me " + parts[1];
        const taskAction = parseTaskFromSentence(taskPart, projectHint);
        const reminderAction = parseReminderFromSentence(reminderPart);
        if (taskAction) sentenceActions.push(taskAction);
        if (reminderAction) sentenceActions.push(reminderAction);
      } else {
        // Try to extract both via separate parsers
        const taskAction = parseTaskFromSentence(sentence, projectHint);
        const reminderAction = parseReminderFromSentence(sentence);
        // If sentence is "Create task ... and remind me...", we want both, but avoid duplicate if reminder is the main
        if (taskAction && taskAction.title && !taskAction.title.toLowerCase().includes("remind")) {
          sentenceActions.push(taskAction);
        }
        if (reminderAction) sentenceActions.push(reminderAction);
      }
    } else {
      // Single action per sentence - priority order
      const parsers = [
        parseGoalFromSentence,
        parseReminderFromSentence,
        parseNoteFromSentence,
        (s) => parseTaskFromSentence(s, projectHint),
        parseAssignmentFromSentence,
      ];

      for (const parser of parsers) {
        const parsed = parser(sentence);
        if (parsed) {
          sentenceActions.push(parsed);
          break;
        }
      }
    }

    for (const parsed of sentenceActions) {
      if ((parsed.type === "create_task" || parsed.type === "create_goal") && !parsed.projectId) {
        if (projectHint) parsed.projectId = projectHint;
        else if (context.currentProjectId) parsed.projectId = context.currentProjectId;
      }
      actions.push(parsed);
    }

    if (sentenceActions.length === 0 && sentence.length > 15) {
      actions.push({
        type: "create_task",
        title: sentence.slice(0, 200),
        notes: "",
        dueDate: extractDueDate(sentence),
        priority: detectPriority(sentence),
        assigneeHint: extractAssignee(sentence),
        projectId: projectHint || context.currentProjectId || null,
        status: "todo",
        confidence: 0.4,
        raw: sentence,
      });
    }
  }

  if (actions.length === 0 && transcript.trim().length > 5) {
    actions.push({
      type: "create_note",
      text: transcript.slice(0, 500),
      confidence: 0.5,
      raw: transcript,
    });
  }

  const summary = generateSummary(transcript, actions);

  return {
    actions,
    summary,
    raw: transcript,
    projectHint,
    detectedCollaborators: collaborators.filter((c) => {
      const name = normalize(c.name || c.email || "");
      return name && normalize(transcript).includes(name.split(" ")[0].toLowerCase());
    }),
  };
}

function generateSummary(transcript, actions) {
  const counts = {};
  actions.forEach((a) => {
    counts[a.type] = (counts[a.type] || 0) + 1;
  });
  const parts = [];
  if (counts.create_task) parts.push(`${counts.create_task} task${counts.create_task > 1 ? "s" : ""}`);
  if (counts.create_goal) parts.push(`${counts.create_goal} goal${counts.create_goal > 1 ? "s" : ""}`);
  if (counts.create_note) parts.push(`${counts.create_note} note${counts.create_note > 1 ? "s" : ""}`);
  if (counts.assign_task) parts.push(`${counts.assign_task} assignment${counts.assign_task > 1 ? "s" : ""}`);
  if (counts.create_reminder) parts.push(`${counts.create_reminder} reminder${counts.create_reminder > 1 ? "s" : ""}`);

  if (parts.length === 0) return transcript.slice(0, 120);
  return `Detected ${parts.join(", ")} from voice input`;
}

async function parseWithLLM(transcript, context = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const projectsList = (context.projects || []).map((p) => ({ id: p.id, name: p.name })).slice(0, 20);
    const collabList = (context.collaborators || []).map((c) => ({ name: c.name, email: c.email })).slice(0, 20);
    const prompt = `You are Deck AI, a project management assistant. Parse this voice transcript into structured actions.

Available projects: ${JSON.stringify(projectsList)}
Team members: ${JSON.stringify(collabList)}

Transcript: "${transcript}"

Return JSON with actions array, each action has:
- type: "create_task" | "create_goal" | "create_note" | "assign_task" | "create_reminder"
- For create_task: title, notes, dueDate (YYYY-MM-DD), priority (low/medium/high), assigneeHint (name), projectId
- For create_goal: label, category (social/ads/seo/content/email/other), targetValue (number), unit, period (weekly/monthly/quarterly/onetime)
- For create_note: text
- For assign_task: taskHint, assigneeHint
- For create_reminder: message, dueDate, frequency (once/daily/weekly/weekdays)

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
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error("LLM parse failed, falling back to rule-based:", err.message);
    return null;
  }
}

async function smartParse(transcript, context = {}) {
  const llmResult = await parseWithLLM(transcript, context);
  if (llmResult && llmResult.actions) {
    return {
      actions: llmResult.actions.map((a) => ({ ...a, confidence: 0.9, raw: transcript })),
      summary: llmResult.summary || generateSummary(transcript, llmResult.actions),
      raw: transcript,
      source: "llm",
    };
  }
  const ruleResult = parseTranscript(transcript, context);
  return { ...ruleResult, source: "rule-based" };
}

module.exports = {
  parseTranscript,
  smartParse,
  detectCategory,
  detectPriority,
  extractDueDate,
  extractAssignee,
  generateSummary,
};
