"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Sparkles, X, Check, Loader2, Trash2, Clock, User, Target, FileText, Bell, Play, Pause, Wand2, AlertTriangle } from "lucide-react";
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
    create_task: <FileText size={14} />,
    create_goal: <Target size={14} />,
    create_note: <FileText size={14} />,
    assign_task: <User size={14} />,
    create_reminder: <Bell size={14} />,
  };

  const typeLabels = {
    create_task: "Task",
    create_goal: "Goal",
    create_note: "Note",
    assign_task: "Assignment",
    create_reminder: "Reminder",
  };

  const typeColors = {
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
                {action.assigneeResolved === false ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertTriangle size={10} /> no teammate matched — will be unassigned
                  </span>
                ) : (
                  action.assignee && <span className="text-[10px] text-emerald-400">✓ resolved</span>
                )}
              </div>
            )}
            {action.project && (
              <div className="text-xs text-text-soft">Project: <span className="font-medium text-text">{action.project.name}</span></div>
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
          </>
        )}

        {action.type === "create_note" && (
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
  // Which stage produced the last parse, so the UI never presents a degraded
  // rule-based parse as if the model had analysed it.
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
          `${failures.length} item${failures.length === 1 ? "" : "s"} could not be created${
            reasons.length ? `: ${reasons.join("; ")}` : "."
          }`
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
      {/* Floating Mic Button */}
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

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[20px] sm:rounded-[20px] border border-line bg-paper-2 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#4F7BFF] text-white">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-text">Deck Voice AI</h2>
                  <p className="text-xs text-text-soft">Speak to create tasks, goals, notes & assign work</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-text-soft hover:text-text"
                >
                  <Clock size={16} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-text-soft hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {showHistory ? (
                <div className="flex-1 overflow-y-auto p-5">
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
                  <button onClick={() => setShowHistory(false)} className="mt-4 text-sm font-medium text-[#7C5CFF] hover:text-[#8B6DFF]">← Back to assistant</button>
                </div>
              ) : (
                <>
                  {/* Transcript Area */}
                  <div className="border-b border-line bg-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-text-faint">Voice Input</label>
                      <div className="flex items-center gap-2">
                        {speech.isListening && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Listening...
                          </span>
                        )}
                        <span className="text-[10px] text-text-faint">{transcript.length} chars</span>
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        ref={transcriptRef}
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Tap mic and speak, or type... e.g., 'Create a task to design homepage for tomorrow and assign to John'"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-line bg-paper-2 px-4 py-3 pr-12 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/20"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1.5">
                        {transcript && (
                          <button
                            onClick={() => { setTranscript(""); speech.reset(); setParsedActions([]); }}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-text-faint hover:text-text"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={speech.isListening ? speech.stop : speech.start}
                          disabled={!speech.isSupported}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                            speech.isListening
                              ? "bg-red-500 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                              : "bg-gradient-to-br from-[#7C5CFF] to-[#4F7BFF] text-white shadow-md hover:scale-105"
                          } disabled:opacity-40`}
                        >
                          {speech.isListening ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                      </div>
                    </div>

                    {!speech.isSupported && (
                      <p className="mt-2 text-xs text-amber-400">🎤 Voice recognition not supported in this browser. You can still type your command.</p>
                    )}

                    {parsedActions.length === 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Try saying:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {EXAMPLE_PROMPTS.slice(0, 3).map((ex, i) => (
                            <button
                              key={i}
                              onClick={() => handleExampleClick(ex)}
                              className="rounded-full border border-line bg-paper-2 px-3 py-1 text-xs text-text-soft transition hover:border-[#7C5CFF]/30 hover:text-text"
                            >
                              {ex.slice(0, 50)}...
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleParse}
                        disabled={parsing || !transcript.trim()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7C5CFF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.7)] transition hover:bg-[#6A4AF0] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {parsing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {parsing ? "Analyzing..." : "Parse with AI"}
                      </button>
                      {parsedActions.length > 0 && (
                        <button
                          onClick={handleExecute}
                          disabled={executing}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)] transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {executing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          {executing ? "Creating..." : `Create ${parsedActions.length} item${parsedActions.length > 1 ? "s" : ""}`}
                        </button>
                      )}
                    </div>

                    {error && (
                      <div className="mt-3 rounded-xl border border-error-line bg-error-tint px-3 py-2 text-sm text-error-text">
                        {error}
                      </div>
                    )}
                    {successMsg && (
                      <div className="mt-3 rounded-xl border border-good-line bg-good-tint px-3 py-2 text-sm text-good-text">
                        ✅ {successMsg}
                      </div>
                    )}
                    {summary && parsedActions.length > 0 && (
                      <div className="mt-3 rounded-xl bg-signal-tint px-3 py-2 text-xs text-text-soft border border-line">
                        <span className="font-medium text-text">AI Summary:</span> {summary}
                        {analysis && (
                          <span className="ml-2 rounded-full border border-line bg-card px-2 py-0.5 text-[10px] text-text-faint">
                            {analysis.source === "llm" ? "model parsed" : "rule-based"}
                            {analysis.degraded ? " · degraded" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {analysis?.degraded && parsedActions.length > 0 && (
                      <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>
                          The AI model was unavailable, so this was parsed with Deck&apos;s built-in rules — dates and
                          assignments may be less accurate. Check the cards below before creating.
                          {analysis.reason ? <span className="block text-[11px] text-amber-400/70">({analysis.reason})</span> : null}
                        </span>
                      </div>
                    )}

                    {analysis?.rejected?.length > 0 && (
                      <p className="mt-2 text-[11px] text-text-faint">
                        {analysis.rejected.length} fragment
                        {analysis.rejected.length === 1 ? "" : "s"} ignored
                        {analysis.rejected[0]?.reason ? ` (${analysis.rejected[0].reason})` : ""}.
                      </p>
                    )}
                  </div>

                  {/* Parsed Actions */}
                  <div className="flex-1 overflow-y-auto p-5">
                    {parsedActions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-tint text-[#7C5CFF]">
                          <Sparkles size={22} />
                        </span>
                        <p className="mt-3 text-sm font-medium text-text">Voice AI Ready</p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-text-faint">
                          Speak naturally. I'll extract tasks, goals, notes, assignments and reminders. Edit before creating.
                        </p>
                        {context && (
                          <div className="mt-4 rounded-xl border border-line bg-card px-3 py-2 text-xs text-text-soft">
                            <div>📁 {context.projects?.length || 0} projects available</div>
                            <div>👥 {context.collaborators?.length || 0} teammates can be assigned</div>
                            <div className={context.aiEnabled ? "text-emerald-400" : "text-amber-400"}>
                              {context.aiEnabled
                                ? "✨ AI model connected"
                                : "⚠️ AI model not configured — rule-based parsing only"}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-text">Detected actions ({parsedActions.length})</h3>
                          <span className="text-xs text-text-faint">Edit before creating</span>
                        </div>
                        <div className="space-y-3">
                          {parsedActions.map((action, idx) => (
                            <ActionCard
                              key={idx}
                              action={action}
                              index={idx}
                              onUpdate={handleUpdateAction}
                              onRemove={handleRemoveAction}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer tips */}
            <div className="border-t border-line bg-card px-5 py-3">
              <p className="text-[11px] leading-relaxed text-text-faint">
                💡 <span className="font-medium">Pro tip:</span> Say "assign to [name]" to assign tasks, "due tomorrow" for dates, "high priority" for urgency. Voice makes you 3x faster!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
