"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Check,
  Loader2,
  Trash2,
  FolderKanban,
  Target,
  ListTodo,
  StickyNote,
  Bell,
  User,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

// Short chip label → full sentence dropped into the textarea.
const QUICK_PROMPTS = [
  {
    label: "New project + goals + tasks",
    text:
      "Create a project called Sports Nutrition, add goals like Instagram followers monthly 500 and blog posts weekly 3, research and writing deadlines for 4th of September, postings shall be done by 10th of September",
  },
  { label: "Task for a teammate", text: "Create a task to design the landing page by tomorrow and assign to Sarah, high priority" },
  { label: "Goal", text: "Add a goal to increase Instagram followers to 10k this month" },
  { label: "Task list", text: "Create tasks: write blog post, design social media graphics, schedule email campaign" },
  { label: "Daily reminder", text: "Remind me daily at 9am to update task progress" },
  { label: "Note", text: "Note that the client wants a darker theme on the homepage" },
];

const TYPE_META = {
  create_project: { label: "Project", Icon: FolderKanban, tone: "text-sky-400 bg-sky-500/10" },
  create_goal: { label: "Goal", Icon: Target, tone: "text-emerald-400 bg-emerald-500/10" },
  create_task: { label: "Task", Icon: ListTodo, tone: "text-violet-400 bg-violet-500/10" },
  create_note: { label: "Note", Icon: StickyNote, tone: "text-blue-400 bg-blue-500/10" },
  create_reminder: { label: "Reminder", Icon: Bell, tone: "text-pink-400 bg-pink-500/10" },
  assign_task: { label: "Assign", Icon: User, tone: "text-amber-400 bg-amber-500/10" },
};

const TITLE_FIELD = {
  create_project: "name",
  create_goal: "label",
  create_task: "title",
  create_note: "text",
  create_reminder: "message",
  assign_task: "taskHint",
};

function formatDue(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript + " ";
        else interim += result[0].transcript;
      }
      if (final) setFinalText((prev) => `${prev} ${final}`.trim());
      setInterimText(interim);
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setFinalText("");
    setInterimText("");
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {}
  }, [isListening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, [isListening]);

  const reset = useCallback(() => {
    setFinalText("");
    setInterimText("");
  }, []);

  return { isSupported, isListening, finalText, interimText, start, stop, reset };
}

function Chip({ children, tone = "border-line bg-paper-2 text-text-soft", title, onClick, as: Tag = "span", ...rest }) {
  const cls = `inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${tone} ${
    onClick ? "cursor-pointer hover:border-[#7C5CFF]/40" : ""
  }`;
  return (
    <Tag className={cls} title={title} onClick={onClick} {...rest}>
      {children}
    </Tag>
  );
}

function DueChip({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={() => setEditing(false)}
        className="rounded-full border border-[#7C5CFF]/40 bg-paper-2 px-2 py-0.5 text-[11px] text-text focus:outline-none"
      />
    );
  }
  return (
    <Chip
      as="button"
      type="button"
      onClick={() => setEditing(true)}
      title="Change due date"
      tone={value ? "border-line bg-paper-2 text-text" : "border-dashed border-line bg-transparent text-text-faint"}
    >
      <CalendarDays size={11} />
      {value ? formatDue(value) : "No date"}
    </Chip>
  );
}

function ProjectChip({ action, projects, newProjectName, onChange }) {
  const isNew = action.project?.isNew || (!action.projectId && newProjectName && action.projectHint === newProjectName);
  const options = [
    ...(newProjectName ? [{ id: "__new__", name: `${newProjectName} (new)` }] : []),
    ...(projects || []),
  ];
  const current = isNew ? "__new__" : action.projectId || "";
  const missing = !current;
  return (
    <label
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${
        missing ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-line bg-paper-2 text-text-soft"
      }`}
      title="Project this will be created in"
    >
      {missing ? <AlertTriangle size={11} /> : <FolderKanban size={11} />}
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[160px] cursor-pointer truncate bg-transparent text-[11px] focus:outline-none"
      >
        <option value="">Pick a project…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionCard({ action, index, projects, newProjectName, onUpdate, onRemove }) {
  const meta = TYPE_META[action.type] || { label: action.type, Icon: Sparkles, tone: "text-text-soft bg-paper-2" };
  const { Icon } = meta;
  const field = TITLE_FIELD[action.type] || "title";
  const needsProject = action.type === "create_task" || action.type === "create_goal";

  function handleProjectChange(value) {
    if (value === "__new__") {
      onUpdate(index, { projectId: undefined, projectHint: newProjectName, project: { id: null, name: newProjectName, isNew: true } });
      return;
    }
    const proj = (projects || []).find((p) => p.id === value);
    onUpdate(index, {
      projectId: proj ? proj.id : undefined,
      projectHint: proj ? proj.id : null,
      project: proj ? { id: proj.id, name: proj.name } : null,
      workspaceId: proj ? proj.workspaceId : undefined,
    });
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.tone}`} title={meta.label}>
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <input
            value={action[field] || ""}
            onChange={(e) => onUpdate(index, { [field]: e.target.value })}
            placeholder={`${meta.label} title`}
            className="w-full min-w-0 truncate bg-transparent text-sm font-medium text-text placeholder:text-text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-faint opacity-60 transition hover:bg-error-tint hover:text-error-text group-hover:opacity-100"
            aria-label="Remove"
          >
            <X size={12} />
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {action.type === "create_project" && <Chip tone="border-sky-500/30 bg-sky-500/10 text-sky-400">New project</Chip>}

          {(action.type === "create_task" || action.type === "create_reminder") && (
            <DueChip value={action.dueDate} onChange={(dueDate) => onUpdate(index, { dueDate })} />
          )}

          {action.type === "create_goal" && (
            <Chip tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              {Number(action.targetValue) || 0}
              {action.unit ? action.unit : ""} · {action.period || "monthly"}
            </Chip>
          )}

          {needsProject && <ProjectChip action={action} projects={projects} newProjectName={newProjectName} onChange={handleProjectChange} />}

          {(action.assignee?.name || action.assigneeHint) && (
            <Chip title={action.assignee ? "Teammate found" : "No matching teammate — will stay unassigned"}>
              <User size={11} />
              {action.assignee?.name || action.assigneeHint}
              {!action.assignee && <span className="text-amber-400">?</span>}
            </Chip>
          )}

          {action.type === "create_task" && action.priority && action.priority !== "medium" && (
            <Chip tone={action.priority === "high" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-line bg-paper-2 text-text-faint"}>
              {action.priority} priority
            </Chip>
          )}

          {action.type === "create_reminder" && action.frequency && action.frequency !== "once" && <Chip>{action.frequency}</Chip>}
        </div>
      </div>
    </div>
  );
}

export default function VoiceAssistant({ projectId, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [actions, setActions] = useState([]);
  const [newProjectName, setNewProjectName] = useState(null);
  const [context, setContext] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const speech = useSpeechRecognition();
  const typedBeforeMicRef = useRef("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open && !context) api.voiceContext().then(setContext).catch(() => {});
  }, [open, context]);

  // Speech appends to whatever was already typed when the mic was started.
  useEffect(() => {
    if (!speech.isListening && !speech.finalText) return;
    const spoken = `${speech.finalText} ${speech.interimText}`.trim();
    if (!spoken) return;
    setTranscript(`${typedBeforeMicRef.current} ${spoken}`.trim());
  }, [speech.finalText, speech.interimText, speech.isListening]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggleMic() {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    typedBeforeMicRef.current = transcript.trim();
    speech.start();
  }

  function resetAll() {
    setTranscript("");
    setActions([]);
    setNewProjectName(null);
    setError("");
    setResult(null);
    speech.reset();
  }

  async function handleUnderstand() {
    if (!transcript.trim()) {
      setError("Say or type what you want to create first.");
      return;
    }
    if (speech.isListening) speech.stop();
    setParsing(true);
    setError("");
    setResult(null);
    try {
      const res = await api.voiceParse({ transcript: transcript.trim(), projectId });
      setActions(res.actions || []);
      setNewProjectName(res.newProjectName || null);
      if (!res.actions || res.actions.length === 0) {
        setError("Couldn't find anything to create. Try “Create a task to …” or “Add a goal …”.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleCreate() {
    if (actions.length === 0) return;
    setExecuting(true);
    setError("");
    try {
      const res = await api.voiceExecute({ transcript: transcript.trim(), actions, projectId });
      setResult(res);
      setActions([]);
      if (onSuccess) onSuccess(res);
      const hadErrors = (res.results?.errors || []).length > 0;
      if (!hadErrors) {
        setTimeout(() => {
          resetAll();
          setOpen(false);
        }, 1600);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  }

  function updateAction(index, patch) {
    setActions((prev) => {
      const target = prev[index];
      const renamedProject = target?.type === "create_project" && typeof patch.name === "string" ? patch.name : null;
      return prev.map((a, i) => {
        if (i === index) return { ...a, ...patch };
        // Renaming the new project keeps the goals/tasks pointed at it.
        if (renamedProject !== null && a.project?.isNew) {
          return { ...a, projectHint: renamedProject, project: { ...a.project, name: renamedProject } };
        }
        return a;
      });
    });
    if (typeof patch.name === "string" && actions[index]?.type === "create_project") setNewProjectName(patch.name);
  }

  function removeAction(index) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function useQuickPrompt(text) {
    setTranscript(text);
    setActions([]);
    setResult(null);
    setError("");
    textareaRef.current?.focus();
  }

  const hasActions = actions.length > 0;
  const missingProject = actions.some((a) => (a.type === "create_task" || a.type === "create_goal") && !a.projectId && !a.project?.isNew);
  const errors = result?.results?.errors || [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#4F7BFF] text-white shadow-[0_8px_24px_rgba(124,92,255,0.4)] transition hover:scale-105 active:scale-95"
        aria-label="Open voice assistant"
      >
        <Mic size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[20px] border border-line bg-paper-2 shadow-2xl sm:rounded-[20px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#4F7BFF] text-white">
                  <Sparkles size={15} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-text">Deck Voice AI</h2>
                  <p className="text-[11px] text-text-soft">Projects, goals, tasks, notes & reminders — in one go</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-soft hover:bg-card hover:text-text"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Transcript */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    if (hasActions) setActions([]);
                  }}
                  placeholder="Tap the mic or type… e.g. “Create a project called Sports Nutrition, add goals like Instagram followers monthly 500, research and writing deadlines 4th of September”"
                  rows={6}
                  className="w-full resize-y rounded-2xl border border-line bg-card px-4 py-3 pb-12 text-[15px] leading-relaxed text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/20"
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="text-[11px] text-text-faint">
                    {speech.isListening ? (
                      <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Listening…
                      </span>
                    ) : transcript ? (
                      `${transcript.length} chars`
                    ) : speech.isSupported ? (
                      "Speak naturally — filler words are fine"
                    ) : (
                      "Voice not supported in this browser — type instead"
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {transcript && (
                      <button
                        type="button"
                        onClick={resetAll}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-text-faint hover:bg-paper-2 hover:text-text"
                        aria-label="Clear"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleMic}
                      disabled={!speech.isSupported}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-40 ${
                        speech.isListening
                          ? "animate-pulse bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                          : "bg-gradient-to-br from-[#7C5CFF] to-[#4F7BFF] shadow-md hover:scale-105"
                      }`}
                      aria-label={speech.isListening ? "Stop listening" : "Start listening"}
                    >
                      {speech.isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick chips */}
              {!hasActions && !result && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => useQuickPrompt(q.text)}
                      className="rounded-full border border-line bg-card px-3 py-1 text-xs text-text-soft transition hover:border-[#7C5CFF]/40 hover:text-text"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Parsed actions */}
              {hasActions && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                      I understood {actions.length} item{actions.length > 1 ? "s" : ""}
                    </h3>
                    <span className="text-[11px] text-text-faint">Tap to edit · × to drop</span>
                  </div>
                  <div className="space-y-2">
                    {actions.map((action, idx) => (
                      <ActionCard
                        key={`${action.type}-${idx}`}
                        action={action}
                        index={idx}
                        projects={context?.projects || []}
                        newProjectName={newProjectName}
                        onUpdate={updateAction}
                        onRemove={removeAction}
                      />
                    ))}
                  </div>
                  {missingProject && (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle size={12} /> Some items have no project yet — pick one, or they'll be skipped.
                    </p>
                  )}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-good-line bg-good-tint px-3 py-2 text-sm text-good-text">
                    <Check size={15} /> {result.summary}
                  </div>
                  {errors.length > 0 && (
                    <div className="rounded-xl border border-warn-line bg-warn-tint px-3 py-2 text-xs text-warn-text">
                      <div className="mb-1 font-semibold">Skipped</div>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {errors.map((e, i) => (
                          <li key={i}>{e.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {error && <div className="mt-3 rounded-xl border border-error-line bg-error-tint px-3 py-2 text-sm text-error-text">{error}</div>}
            </div>

            {/* Footer action */}
            <div className="border-t border-line px-5 py-3">
              {hasActions ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUnderstand}
                    disabled={parsing || executing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-text-soft transition hover:text-text disabled:opacity-50"
                  >
                    {parsing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Re-read
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={executing || parsing}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)] transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {executing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {executing ? "Creating…" : `Create ${actions.length}`}
                  </button>
                </div>
              ) : result ? (
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6A4AF0]"
                >
                  <Mic size={15} /> New command
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnderstand}
                  disabled={parsing || !transcript.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.7)] transition hover:bg-[#6A4AF0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {parsing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {parsing ? "Understanding…" : "Understand"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
