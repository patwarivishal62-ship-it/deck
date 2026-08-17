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
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function parseAddTaskLocal(message) {
  if (!/^(add|create)\s+task\s+/i.test(message)) return null;
  let rest = message.replace(/^(add|create)\s+task\s+/i, "").trim();
  if (!rest) return null;
  let dueDate = null;
  const dueRegex = /\s+due\s+(today|tomorrow|next week|on\s+(\d{4}-\d{2}-\d{2})|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4}))/i;
  const m = rest.match(dueRegex);
  if (m) {
    const phrase = m[1].toLowerCase().trim();
    if (phrase === "today") dueDate = todayISO();
    else if (phrase === "tomorrow") dueDate = addDaysISO(todayISO(), 1);
    else if (phrase === "next week") dueDate = addDaysISO(todayISO(), 7);
    else if (m[2]) dueDate = m[2];
    else if (m[3]) dueDate = m[3];
    else if (m[4]) {
      const [mm, dd, yyyy] = m[4].split("/");
      dueDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    rest = rest.replace(m[0], " ").trim();
  }
  let projectName = null;
  const projM = rest.match(/\s+in\s+(.+)$/i);
  if (projM) {
    projectName = projM[1].trim();
    rest = rest.replace(projM[0], " ").trim();
  }
  let title = rest.replace(/\s+/g, " ").trim().replace(/[.]+$/, "").trim();
  if (!title) return null;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title, dueDate, projectName };
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

  const hideOn = ["/login", "/forgot-password", "/reset-password", "/invite"];
  const shouldHide = !user || hideOn.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (shouldHide) return;
    api
      .aiBriefing()
      .then((data) => {
        setBriefing(data);
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
      .catch(async () => {
        // Fallback: compute briefing client-side via projects
        try {
          const data = await api.listProjects({ archived: false });
          const projects = data.projects || [];
          const today = todayISO();
          let pending = 0, dueToday = 0, overdue = 0;
          for (const p of projects) for (const t of p.tasks || []) if (t.status !== "done") { pending++; if (t.dueDate === today) dueToday++; else if (t.dueDate && t.dueDate < today) overdue++; }
          const hour = new Date().getHours();
          let msg = hour < 12 ? "Good morning! " : hour < 17 ? "Good afternoon! " : "Good evening! ";
          if (pending === 0) msg += "No tasks yet — what are we doing today?";
          else if (dueToday || overdue) msg += `You have ${dueToday} due today${overdue ? ` and ${overdue} overdue` : ""}. What are we tackling first?`;
          else msg += `No tasks due today, but ${pending} pending. Want to plan the day?`;
          setBriefing({ message: msg, stats: { pending, dueToday, overdue } });
        } catch {}
      });
  }, [shouldHide]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  async function handleLocalFallback(text) {
    // Try client-side handling when server AI is not yet deployed (502/503)
    const add = parseAddTaskLocal(text);
    if (add) {
      const data = await api.listProjects({ archived: false });
      const projects = data.projects || [];
      if (projects.length === 0) return `You don't have a project yet. Create a project first, then I can add tasks.`;
      let target = null;
      if (add.projectName) {
        const low = add.projectName.toLowerCase();
        target = projects.find((p) => p.name.toLowerCase() === low) || projects.find((p) => p.name.toLowerCase().includes(low));
      }
      if (!target) target = projects[0];
      await api.createTask(target.id, { title: add.title, dueDate: add.dueDate || null, status: "todo" });
      let reply = `✅ Added "${add.title}" to ${target.name}`;
      if (add.dueDate) reply += ` — due ${add.dueDate}`;
      reply += `. I’ll remind you as the due date approaches.`;
      return reply;
    }
    const low = text.toLowerCase();
    const isOrganize = low.includes("organize") || low.includes("push pending") || low.includes("prioritize");
    const isList = (low.includes("what") && (low.includes("task") || low.includes("doing today"))) || (low.includes("show") && low.includes("task")) || low.includes("pending") || low.includes("due today");

    if (isOrganize) {
      const data = await api.listProjects({ archived: false });
      const projects = data.projects || [];
      const pending = [];
      for (const p of projects) for (const t of p.tasks || []) if (t.status !== "done") pending.push({ ...t, projectName: p.name, projectId: p.id });
      if (pending.length === 0) return "🎉 No pending tasks — you’re all clear!";
      const today = todayISO();
      const overdue = pending.filter((t) => t.dueDate && t.dueDate < today);
      let pushed = 0;
      for (const t of overdue) {
        try { await api.updateTask(t.projectId, t.id, { dueDate: today }); pushed++; } catch {}
      }
      pending.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      let reply = `📋 Organized ${pending.length} pending tasks\n\n`;
      if (pushed) reply += `⚠️ Pushed ${pushed} overdue to today.\n`;
      reply += `\nTop 5 to focus on:\n` + pending.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} · ${t.projectName}${t.dueDate ? ` (due ${t.dueDate})` : ""}`).join("\n");
      return reply;
    }
    if (isList) {
      const data = await api.listProjects({ archived: false });
      const projects = data.projects || [];
      const today = todayISO();
      const dueToday = [], overdue = [];
      for (const p of projects) for (const t of p.tasks || []) if (t.status !== "done") {
        if (t.dueDate === today) dueToday.push({ ...t, projectName: p.name });
        else if (t.dueDate && t.dueDate < today) overdue.push({ ...t, projectName: p.name });
      }
      if (dueToday.length === 0 && overdue.length === 0) {
        const total = projects.reduce((s, p) => s + (p.tasks || []).filter((x) => x.status !== "done").length, 0);
        if (total === 0) return "Good morning! ☀️ No tasks pending. Tell me what you want to achieve today — e.g. `Add task Design review due today`.";
        return `Good morning! ☀️ You have ${total} pending, none due today. What are we doing today?`;
      }
      let reply = "";
      if (overdue.length) reply += `⚠️ Overdue (${overdue.length}):\n` + overdue.slice(0, 5).map((t) => `• ${t.title} · ${t.projectName}`).join("\n") + "\n\n";
      if (dueToday.length) reply += `📌 Due today (${dueToday.length}):\n` + dueToday.slice(0, 5).map((t) => `• ${t.title} · ${t.projectName}`).join("\n");
      return reply || "Here are your tasks — want me to organize them?";
    }
    return `I’m your Deck PA — try:\n• Add task Shoot reel due tomorrow in Acme Launch\n• What’s due today?\n• Organize my pending tasks`;
  }

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const data = await api.aiChat({ message: trimmed });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (err) {
      const msg = err.message || "";
      const isDeployMissing = msg.includes("502") || msg.includes("503") || msg.includes("Failed to fetch") || msg.includes("Request failed");
      if (isDeployMissing) {
        try {
          const fallbackReply = await handleLocalFallback(trimmed);
          setMessages((m) => [...m, { role: "assistant", text: fallbackReply }]);
        } catch (e2) {
          setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${e2.message}` }]);
        }
      } else {
        setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${err.message}` }]);
      }
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
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 font-mono text-[10px] font-bold text-white">
            {briefing.stats.dueToday}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[420px] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
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
