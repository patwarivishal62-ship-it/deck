"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Sparkles, X, Check, Loader2, Trash2, Clock, User, Target, FileText, Bell, Play, Pause, Wand2, AlertTriangle, FolderPlus } from "lucide-react";
import { api } from "@/lib/api";

// Sent with every parse/execute so the server resolves "tomorrow" and reminder
// times against the user's actual calendar day instead of UTC.
function userTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

const EXAMPLE_PROMPTS = [
  "Create a task to design landing page for tomorrow and assign to Sarah",
  "Add a goal to increase Instagram followers to 10k",
  "Note that client meeting went well, need to follow up on proposal",
  "Remind me daily to update task progress at 9am",
  "Create tasks: write blog post, design social media, schedule email campaign",
];

function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) {
          setTranscript((prev) => (prev + " " + final).trim());
        }
        setInterimTranscript(interim);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      setInterimTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return { isSupported, isListening, transcript, interimTranscript, start, stop, reset, setTranscript };
}

function ActionCard({ action, index, onUpdate, onRemove }) {
  const typeIcons = {
    create_project: <FolderPlus size={14} />,
    create_task: <FileText size={14} />,
    create_goal: <Target size={14} />,
    create_note: <FileText size={14} />,
    assign_task: <User size={14} />,
    create_reminder: <Bell size={14} />,
  };

  const typeLabels = {
    create_project: "Project",
    create_task: "Task",
    create_goal: "Goal",
    create_note: "Note",
    assign_task: "Assignment",
    create_reminder: "Reminder",
  };

  const typeColors = {
    create_project: "bg-[#7C5CFF]/10 text-[#7C5CFF] border-[#7C5CFF]/20",
    create_task: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    create_goal: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    create_note: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    assign_task: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    create_reminder: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  };

  return (
    <div className="group relative rounded-xl border border-line bg-card p-3 transition hover:border-line">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${typeColors[action.type] || "bg-card border-line text-text-soft"}`}>
            {typeIcons[action.type]}
            {typeLabels[action.type] || action.type}
          </span>
          {action.confidence !== undefined && (
            <span className="text-[10px] text-text-faint">{Math.round(action.confidence * 100)}%</span>
          )}
          {action.needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              <AlertTriangle size={10} /> check this
            </span>
          )}
        </div>
        <button
          onClick={() => onRemove(index)}
          className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full bg-card text-text-faint transition hover:bg-error-tint hover:text-error-text"
        >
          <X size={12} />
        </button>
      </div>

      <div className="mt-2.5 space-y-2">
        {action.type === "create_project" && (
          <>
            <input
              value={action.name || ""}
              onChange={(e) => onUpdate(index, { name: e.target.value })}
              placeholder="Project name"
              className="w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none"
            />
            <p className="text-[11px] text-text-faint">Goals and tasks in this note that mention it will be placed inside.</p>
          </>
        )}

        {action.type === "create_task" && (
          <>
            <input
              value={action.title || ""}
              onChange={(e) => onUpdate(index, { title: e.target.value })}
              placeholder="Task title"
              className="w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                value={action.dueDate || ""}
                onChange={(e) => onUpdate(index, { dueDate: e.target.value })}
                type="date"
                className="flex-1 rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              />
              <select
                value={action.priority || "medium"}
                onChange={(e) => onUpdate(index, { priority: e.target.value })}

                className="rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            {action.assigneeHint && (
              <div className="flex items-center gap-1.5 text-xs text-text-soft">
                <User size={12} /> Assign to: <span className="font-medium text-text">{action.assignee?.name || action.assigneeHint}</span>
                {action.assigneeResolved === false && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertTriangle size={10} /> no teammate matched — will be unassigned
                  </span>
                )}
              </div>
            )}
            {action.project && (
              <div className="flex items-center gap-1.5 text-xs text-text-soft">
                Project: <span className="font-medium text-text">{action.project.name}</span>
                {action.project.isNew && (
                  <span className="rounded-full bg-[#7C5CFF]/10 px-2 py-0.5 text-[10px] font-medium text-[#7C5CFF]">will be created</span>
                )}
              </div>
            )}
          </>
        )}

        {action.type === "create_goal" && (
          <>
            <input
              value={action.label || ""}
              onChange={(e) => onUpdate(index, { label: e.target.value })}
              placeholder="Goal label"
              className="w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                value={action.targetValue || ""}
                onChange={(e) => onUpdate(index, { targetValue: e.target.value })}
                placeholder="Target"
                type="number"
                className="flex-1 rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              />
              <select
                value={action.category || "other"}
                onChange={(e) => onUpdate(index, { category: e.target.value })}
                className="flex-1 rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              >
                <option value="social">Social</option>
                <option value="ads">Ads</option>
                <option value="seo">SEO</option>
                <option value="content">Content</option>
                <option value="email">Email</option>
                <option value="other">Other</option>
              </select>
            </div>
            {action.project && (
              <div className="flex items-center gap-1.5 text-xs text-text-soft">
                Project: <span className="font-medium text-text">{action.project.name}</span>
                {action.project.isNew && (
                  <span className="rounded-full bg-[#7C5CFF]/10 px-2 py-0.5 text-[10px] font-medium text-[#7C5CFF]">will be created</span>
                )}
              </div>
            )}
          </>
        )}

        {action.type === "create_note" && (
          <>
          <textarea
            value={action.text || ""}
            onChange={(e) => onUpdate(index, { text: e.target.value })}
            placeholder="Note content"
            rows={2}
            className="w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none resize-none"
          />
          )}

        {action.type === "create_reminder" && (
          <>
            <input
              value={action.message || ""}
              onChange={(e) => onUpdate(index, { message: e.target.value })}
              placeholder="Reminder message"
              className="w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                value={action.dueDate || ""}
                onChange={(e) => onUpdate(index, { dueDate: e.target.value })}
                type="date"
                className="flex-1 rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              />
              <select
                value={action.frequency || "once"}
                onChange={(e) => onUpdate(index, { frequency: e.target.value })}
                className="flex-1 rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
          </>
        )}

        {action.type === "assign_task" && (
          <div className="text-sm text-text">
            <div>Task: <span className="font-medium">{action.taskHint || "—"}</span></div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-soft">
              <User size={12} /> To: <span className="font-medium text-text">{action.assignee?.name || action.assigneeHint || "—"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VoiceAssistant({ projectId, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [parsedActions, setParsedActions] = useState([]);
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const speech = useSpeechRecognition();
  const transcriptRef = useRef(null);

  // Load context and voice notes when opening
  useEffect(() => {
    if (open && !context) {
      api.voiceContext().then(setContext).catch(() => {});
      api.voiceNotes().then((d) => setVoiceNotes(d.notes || [])).catch(() => {});
    }
  }, [open, context]);

  // Sync speech transcript to main transcript
  useEffect(() => {
    if (speech.transcript) {
      setTranscript(speech.transcript + (speech.interimTranscript ? " " + speech.interimTranscript : ""));
    }
  }, [speech.transcript, speech.interimTranscript]);

  async function handleParse() {
    if (!transcript.trim()) {
      setError("Please speak or type something first");
      return;
    }
    setParsing(true);
    setError("");
    setSuccessMsg("");
    setAnalysis(null);
    try {
      const result = await api.voiceParse({ transcript: transcript.trim(), projectId, timeZone: userTimeZone() });
      setParsedActions(result.actions || []);
      setSummary(result.summary || "");
      setAnalysis({
        source: result.source,
        degraded: Boolean(result.degraded),
        reason: result.diagnostics?.reason || null,
        rejected: result.diagnostics?.rejected || [],
      });
      if (result.actions?.length === 0) {
        setError("Couldn't detect any tasks or goals. Try rephrasing — e.g., 'Create a task to...'");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleExecute() {
    if (parsedActions.length === 0) {
      setError("No actions to execute");
      return;
    }
    setExecuting(true);
    setError("");
    try {
      const result = await api.voiceExecute({ transcript, actions: parsedActions, projectId, timeZone: userTimeZone() });
      const failures = result.results?.errors || [];
      setSuccessMsg(result.summary || `Created ${result.results?.tasks?.length || 0} tasks, ${result.results?.goals?.length || 0} goals`);
      // A partial failure must not read as a clean success.
      if (failures.length > 0 || result.failedCount > 0) {
        const reasons = failures.map((f) => f.error).filter(Boolean).slice(0, 3);
        setError(
          `${failures.length} item${failures.length === 1 ? "" : "s"} could not be created${reasons.length ? `: ${reasons.join("; ")}` : "."}`
        );
      }
      setParsedActions([]);
      setAnalysis(null);
      setTranscript("");
      speech.reset();
      // Refresh voice notes
      api.voiceNotes().then((d) => setVoiceNotes(d.notes || [])).catch(() => {});
      if (onSuccess) onSuccess(result);
      // Auto close after 2s only when everything actually landed
      if (!failures.length && !result.failedCount) {
        setTimeout(() => {
          setSuccessMsg("");
          setOpen(false);
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  }

  function handleUpdateAction(index, updates) {
    setParsedActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  }

  function handleRemoveAction(index) {
    setParsedActions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleExampleClick(example) {
    setTranscript(example);
  }

  return (
    <>
      {/* Floating Mic Button - always visible, no modal popup */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#4F7BFF] text-white shadow-[0_8px_24px_rgba(124,92,255,0.4)] transition hover:scale-105 hover:shadow-[0_12px_32px_rgba(124,92,255,0.5)] active:scale-95"
        aria-label="Open voice assistant"
      >
        <Mic size={24} />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white animate-pulse">
          AI
        </span>
      </button>

      {/* Simplified history section - no full modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[300px] max-w-[90vw] shadow-2xl">
            <div className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-text">Recent voice notes</h3>
              {voiceNotes.length === 0 ? (
                <p className="text-sm text-text-soft">No voice notes yet. Your history will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {voiceNotes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-line bg-card p-3">
                      <p className="text-sm text-text line-clamp-2">{note.transcript}</p>
                      <p className="mt-1 text-xs text-text-faint">{new Date(note.createdAt).toLocaleString()} • {note.summary}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowHistory(false)} className="mt-4 text-sm font-medium text-[#7C5CFF] hover:text-[#8B6DFF]">← Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Notes History in main area */}
      <div className="mt-8 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Clock size={16} /> Recent Voice Notes
          </h2>
          <span className="text-xs text-text-faint">{voiceNotes.length} notes</span>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-text-faint">Loading...</p>
          ) : voiceNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper-2 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-tint text-[#7C5CFF]">
                <Mic size={20} />
              </span>
              <p className="mt-3 text-sm font-medium text-text">No voice notes yet</p>
              <p className="mt-1 max-w-xs text-xs text-text-faint">Tap the mic button to create your first voice note. It will appear here with tasks and goals extracted.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {voiceNotes.map((note) => (
                <div key={note.id} className="group rounded-xl border border-line bg-paper-2 p-3">
                  <p className="text-sm text-text leading-relaxed">{note.transcript}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {note.actions?.tasks?.length > 0 && (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-400">{note.actions.tasks.length} tasks</span>
                    )}
                    {note.actions?.goals?.length > 0 && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">{note.actions.goals.length} goals</span>
                    )}
                    {note.actions?.notes?.length > 0 && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">{note.actions.notes.length} notes</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-text-faint">{new Date(note.createdAt).toLocaleString()}</span>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full bg-card text-text-faint hover:text-error-text hover:bg-error-tint transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}