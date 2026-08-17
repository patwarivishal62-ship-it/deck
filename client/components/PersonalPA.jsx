"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function parseAddTaskLocal(message) {
  // More flexible: handles "add task", "create task", "I need to do", "remind me to", "task: ..."
  const triggers = [/^(add|create)\s+task\s+/i, /^task\s*:\s*/i, /^(remind me to|i need to|need to)\s+/i];
  let isAdd = triggers.some((re) => re.test(message));
  // Also if message contains "due" and looks like a task, treat as add
  if (!isAdd && /due\s+(today|tomorrow|next week|on\s+\d{4}-\d{2}-\d{2})/i.test(message) && message.split(" ").length <= 12) {
    // Heuristic: short message with due date is likely a task
    isAdd = true;
  }
  if (!isAdd) return null;
  let rest = message;
  for (const re of triggers) rest = rest.replace(re, "");
  rest = rest.trim();
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
    projectName = projM[1].trim().replace(/[.]+$/, "");
    rest = rest.replace(projM[0], " ").trim();
  }
  let title = rest.replace(/\s+/g, " ").trim().replace(/[.]+$/, "").trim();
  if (!title || title.length < 2) return null;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  // Filter out non-task greetings
  if (/^(hello|hi|hey|thanks|thank you|help|what|how)/i.test(title) && title.split(" ").length < 4) return null;
  return { title, dueDate, projectName };
}

const livelyGreetings = [
  (name) => `Hey ${name}! ✨ Ready to make today count?`,
  (name) => `Hey ${name}! 🚀 What's on your mind?`,
  (name) => `Hi ${name}! Let's crush it today 💪`,
];

const excitedSuccess = [
  (title) => `Boom! 🎉 Added “${title}” — love it.`,
  (title) => `Done! ✨ “${title}” is on your list.`,
  (title) => `Got it! 🚀 “${title}” — you’re already ahead.`,
];

export default function PersonalPA() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const listRef = useRef(null);

  const hideOn = ["/login", "/forgot-password", "/reset-password", "/invite"];
  const shouldHide = !user || hideOn.some((p) => pathname?.startsWith(p));
  const firstName = user?.name?.split(" ")[0] || "there";

  // Proactive peek — lively pop after 2.5s once per session (guard storage)
  useEffect(() => {
    if (shouldHide || open) return;
    let seen = null;
    try { seen = sessionStorage.getItem("pa-peeked"); } catch {}
    if (seen) return;
    const t = setTimeout(() => {
      setPeek(true);
      setTimeout(() => setPeek(false), 4000);
      try { sessionStorage.setItem("pa-peeked", "1"); } catch {}
    }, 2800);
    return () => clearTimeout(t);
  }, [shouldHide, open]);

  useEffect(() => {
    if (shouldHide) return;
    api.aiBriefing().then((data) => setBriefing(data)).catch(async () => {
      try {
        const d = await api.listProjects({ archived: false });
        const projects = d.projects || [];
        const today = todayISO();
        let pending = 0, dueToday = 0, overdue = 0;
        for (const p of projects) for (const t of p.tasks || []) if (t.status !== "done") { pending++; if (t.dueDate === today) dueToday++; else if (t.dueDate && t.dueDate < today) overdue++; }
        const h = new Date().getHours();
        let msg = h < 12 ? "Good morning! " : h < 17 ? "Good afternoon! " : "Good evening! ";
        if (pending === 0) msg += "Your list is clear — what are we building today?";
        else if (dueToday || overdue) msg += `${dueToday} due today${overdue ? ` • ${overdue} overdue` : ""} — ready to tackle?`;
        else msg += `${pending} pending, none due today. Pick your top 3?`;
        setBriefing({ message: msg, stats: { pending, dueToday, overdue } });
      } catch {}
    });
  }, [shouldHide]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy, open]);

  async function handleLocalFallback(text) {
    const low = text.toLowerCase().trim();

    // Greetings / small talk — lively, not robotic
    if (/^(hi|hello|hey|yo|hiya|howdy)(\s|$)/i.test(low) || low === "hi" || low === "hey") {
      const pick = livelyGreetings[Math.floor(Math.random() * livelyGreetings.length)];
      return `${pick(firstName)} Tell me one thing you want to get done today and I’ll add it.`;
    }
    if (/^(thanks|thank you|thx|appreciate)/i.test(low)) {
      return `Anytime! 🙌 I’ve got your back — just say “Add task …” when you think of something.`;
    }
    if (/^(help|what can you do|how do you work|who are you)/i.test(low)) {
      return `I’m Deck PA — your quiet sidekick, not a dashboard. ✨\n\nJust talk to me:\n• “Client review tomorrow” → I’ll add it\n• “What’s due today?” → I’ll show it\n• “I’m overwhelmed” → I’ll organize your list into Top 3\n\nNo forms, just chat. What’s on your mind?`;
    }
    if (/^(i'?m )?(overwhelmed|stressed|stuck|busy|swamped)/i.test(low)) {
      return `I hear you — let’s make it lighter. 🌿 Tell me the 2-3 things that *must* happen today, I’ll park the rest. What’s weighing on you?`;
    }

    const add = parseAddTaskLocal(text);
    if (add) {
      const data = await api.listProjects({ archived: false });
      const projects = data.projects || [];
      if (projects.length === 0) return `You need a project first — create one in Projects, then I can add tasks instantly.`;
      let target = null;
      if (add.projectName) {
        const l = add.projectName.toLowerCase();
        target = projects.find((p) => p.name.toLowerCase() === l) || projects.find((p) => p.name.toLowerCase().includes(l));
      }
      if (!target) target = projects[0];
      await api.createTask(target.id, { title: add.title, dueDate: add.dueDate || null, status: "todo" });
      const pick = excitedSuccess[Math.floor(Math.random() * excitedSuccess.length)];
      let reply = pick(add.title) + ` Added to *${target.name}*`;
      if (add.dueDate) reply += ` for ${add.dueDate === todayISO() ? "today" : add.dueDate}`;
      reply += `. Want to add another?`;
      return reply;
    }

    const isOrganize = low.includes("organize") || low.includes("push pending") || low.includes("prioritize") || low.includes("plan");
    const isList = low.includes("due today") || low.includes("what") && low.includes("task") || low.includes("pending") || (low.includes("show") && low.includes("task"));

    if (isOrganize) {
      const data = await api.listProjects({ archived: false });
      const projects = data.projects || [];
      const pending = [];
      for (const p of projects) for (const t of p.tasks || []) if (t.status !== "done") pending.push({ ...t, projectName: p.name, projectId: p.id });
      if (pending.length === 0) return "🎉 Nothing pending — you’re free! Want to dream up something new for tomorrow?";
      const today = todayISO();
      const overdue = pending.filter((t) => t.dueDate && t.dueDate < today);
      let pushed = 0;
      for (const t of overdue) { try { await api.updateTask(t.projectId, t.id, { dueDate: today }); pushed++; } catch {} }
      pending.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      let reply = `✨ Organized **${pending.length}** things for you\n`;
      if (pushed) reply += `↗ Pushed ${pushed} overdue to today — fresh start.\n`;
      reply += `\n**Your Top 3:**\n` + pending.slice(0, 3).map((t, i) => `${i + 1}. ${t.title} — ${t.projectName}`).join("\n");
      reply += `\n\nFeels lighter? Tap one to open it, or tell me “Add task …”`;
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
        if (total === 0) return "Your list is clear today 🌿 — what’s one win you want before sunset? Just tell me.";
        return `You’ve got ${total} things pending, none due today. Want me to pick your Top 3?`;
      }
      let reply = "";
      if (overdue.length) reply += `⚠️ **Overdue**\n` + overdue.slice(0, 3).map((t) => `• ${t.title} — ${t.projectName}`).join("\n") + "\n\n";
      if (dueToday.length) reply += `🎯 **Today**\n` + dueToday.slice(0, 3).map((t) => `• ${t.title} — ${t.projectName}`).join("\n");
      return reply;
    }

    // General conversational fallback — lively, understanding
    const generals = [
      `Got it — tell me a bit more? If it’s a task, just say “Client review tomorrow” and I’ll add it. If you’re planning, say “organize” and I’ll sort your Top 3.`,
      `I’m listening 👂 — is this something to add, to check, or to organize? Give me a nudge like “Add task …”`,
      `Love it. Want me to add that as a task, or just chat about it? I can do both — you lead. ✨`,
    ];
    return generals[Math.floor(Math.random() * generals.length)];
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
          setMessages((m) => [...m, { role: "assistant", text: `Hmm, I hit a hiccup — try again? ${e2.message}` }]);
        }
      } else {
        // Lively error
        setMessages((m) => [...m, { role: "assistant", text: `Oops — that didn’t fly ✈️ ${msg}. Try “Add task Design review due today”` }]);
      }
    } finally {
      setBusy(false);
    }
  }

  if (shouldHide) return null;

  return (
    <>
      {/* Peek tooltip — lively pop */}
      {peek && !open && (
        <div className="fixed bottom-20 right-5 z-40 max-w-[280px] animate-[slideIn_0.4s_ease] rounded-2xl border border-line bg-card px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          <p className="text-sm font-medium text-text">Hey {firstName}! 👋</p>
          <p className="mt-0.5 text-xs leading-relaxed text-text-soft">I’m here — tell me one thing for today and I’ll handle the rest.</p>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => { setOpen(true); setPeek(false); }} className="rounded-full bg-signal px-3 py-1 text-xs font-medium text-white hover:bg-signal-deep">Let’s go ✨</button>
            <button onClick={() => setPeek(false)} className="rounded-full border border-line px-3 py-1 text-xs text-text-soft hover:text-text">Later</button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setPeek(false); }}
        aria-label={open ? "Close Deck PA" : "Open Deck PA"}
        className={`fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-signal text-white shadow-glow transition hover:scale-105 active:scale-95 ${open ? "rotate-90 bg-signal-deep" : "animate-[pulse_2s_ease_infinite]"}`}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8a3 3 0 0 0 3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3z" /><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="3" /></svg>
        )}
        {!open && briefing && briefing.stats?.dueToday > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 font-mono text-[10px] font-bold text-white animate-pulse">
            {briefing.stats.dueToday}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[440px] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_48px_rgba(0,0,0,0.6)] animate-[slideUp_0.3s_ease]">
          <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-signal to-[#4F7BFF] text-white shadow-glow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8a3 3 0 0 0 3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3zM20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="3" /></svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-text">Deck PA</p>
                <p className="flex items-center gap-1 text-xs text-text-faint"><span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse" /> Live • understands you</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-text-faint hover:bg-ink-2 hover:text-text"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg></button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto bg-paper px-3 py-3">
            {messages.length === 0 ? (
              <div className="py-4">
                <div className="mx-auto max-w-[300px] rounded-2xl bg-card border border-line p-4 text-center">
                  <p className="text-sm font-semibold text-text">Good {formatTime()}, {firstName}! 👋</p>
                  <p className="mx-auto mt-1 text-xs leading-relaxed text-text-soft">I get it — you’re busy. Just talk to me like a teammate and I’ll handle the busywork.</p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <button type="button" onClick={() => send("Add task Client review due today")} className="rounded-xl border border-line bg-card px-3 py-2.5 text-left text-sm text-text hover:border-signal/30">
                    <span className="font-medium">“Add task Client review due today”</span>
                    <span className="block text-xs text-text-faint">I’ll add it instantly</span>
                  </button>
                  <button type="button" onClick={() => send("What’s due today?")} className="rounded-xl border border-line bg-card px-3 py-2.5 text-left text-sm text-text hover:border-signal/30">
                    <span className="font-medium">“What’s due today?”</span>
                    <span className="block text-xs text-text-faint">See your focus list</span>
                  </button>
                </div>
                {briefing && <p className="mt-3 rounded-xl bg-ink-2 px-3 py-2 text-xs leading-relaxed text-text-soft">💡 {briefing.message}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-signal text-white" : "bg-card border border-line text-text"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {busy && <p className="text-xs text-text-faint animate-pulse">Deck PA is vibing… ✨</p>}
              </div>
            )}
          </div>

          <div className="border-t border-line bg-card px-3 py-2.5 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Tell me anything…"
              className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
            />
            <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-signal text-white transition hover:bg-signal-deep disabled:opacity-40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2 15 22 11 13 2 9z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}} @keyframes slideIn{from{transform:translateY(8px) scale(0.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}} @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,92,255,0.4)}50%{box-shadow:0 0 0 8px rgba(124,92,255,0)}}`}</style>
    </>
  );
}
