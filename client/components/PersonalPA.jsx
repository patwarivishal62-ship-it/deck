"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function formatTime() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function PersonalPA() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const listRef = useRef(null);

  // Don't show on auth pages
  const hideOn = ["/login", "/forgot-password", "/reset-password", "/invite"];
  const shouldHide = !user || hideOn.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (shouldHide) return;
    // Fetch briefing once per session for morning prompt
    api
      .aiBriefing()
      .then((data) => {
        setBriefing(data);
        // Auto-add morning greeting as first assistant message (once)
        const hour = new Date().getHours();
        const hasGreeted = sessionStorage.getItem("pa-greeted");
        if (!hasGreeted && hour < 12) {
          setMessages((prev) =>
            prev.length === 0
              ? [{ role: "assistant", text: `${data.message}\n\nJust type what you're doing today — e.g. \`Add task Design review due today\`` }]
              : prev
          );
          sessionStorage.setItem("pa-greeted", "1");
        }
      })
      .catch(() => {});
  }, [shouldHide]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const data = await api.aiChat({ message: trimmed });
      // Simple markdown-like bold handling
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      // If task was created, we could trigger a global refresh — for now just notify
      if (data.action === "task_created") {
        // subtle in-chat success, no reload needed — tasks list will update on next navigation
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function handleQuick(text) {
    send(text);
  }

  if (shouldHide) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Deck PA" : "Open Deck PA"}
        className={`fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-signal text-white shadow-glow transition hover:scale-105 active:scale-95 ${open ? "rotate-90 bg-signal-deep" : ""}`}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          </svg>
        )}
        {!open && briefing && briefing.stats?.dueToday > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF5D73] px-1 font-mono text-[10px] font-bold text-white">
            {briefing.stats.dueToday}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[420px] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8a3 3 0 0 0 3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3zM20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="3" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-text">Deck PA</p>
                <p className="text-xs text-text-faint">Your personal assistant — simple, private, fast.</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-text-faint hover:bg-ink-2 hover:text-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto bg-paper px-3 py-3">
            {messages.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-text">Good {formatTime()}, {user?.name?.split(" ")[0] || "there"}! 👋</p>
                <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-text-soft">
                  Tell me what you’re doing today in one line — I’ll add the tasks, track progress, and nudge you before due dates.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {[
                    "Add task Client review due today",
                    "What’s due today?",
                    "Organize pending tasks",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQuick(q)}
                      className="rounded-full border border-line bg-card px-3 py-1 text-xs text-text-soft hover:border-signal/30 hover:text-text"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {briefing && (
                  <p className="mt-4 rounded-xl border border-line bg-card px-3 py-2 text-left text-xs leading-relaxed text-text-soft">
                    📊 {briefing.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "bg-signal text-white" : "bg-card border border-line text-text"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {busy && <p className="text-xs text-text-faint">Deck PA is thinking…</p>}
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-line bg-paper px-3 py-2 scrollbar-hide">
            {["Add task …", "Due today", "Organize"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label === "Add task …") setInput("Add task ");
                  else if (label === "Due today") handleQuick("What’s due today?");
                  else handleQuick("Organize my pending tasks");
                }}
                className="shrink-0 rounded-full bg-card border border-line px-2.5 py-1 text-xs text-text-soft hover:border-signal/30 hover:text-text"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-line bg-card px-3 py-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or add a task…"
              className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-signal text-white transition hover:bg-signal-deep disabled:opacity-40"
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2 11 13M22 2 15 22 11 13 2 9z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
