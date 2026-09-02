"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { Mic, Sparkles, Target, ListTodo, Users, Bell, Clock, Trash2, Play, FileText } from "lucide-react";

function VoicePageInner() {
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ tasks: 0, goals: 0, notes: 0 });

  async function loadNotes() {
    setLoading(true);
    try {
      const data = await api.voiceNotes();
      setVoiceNotes(data.notes || []);
      // Compute stats from notes
      let t = 0, g = 0, n = 0;
      data.notes?.forEach((note) => {
        t += note.actions?.tasks?.length || 0;
        g += note.actions?.goals?.length || 0;
        n += note.actions?.notes?.length || 0;
      });
      setStats({ tasks: t, goals: g, notes: n });
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function handleDelete(id) {
    try {
      await api.deleteVoiceNote(id);
      setVoiceNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-faint uppercase tracking-wide">
            <ListTodo size={12 />} Tasks Created
          </div>
          <div className="mt-1 text-2xl font-bold text-text">{stats.tasks}</div>
          <div className="text-xs text-text-soft">via voice</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-faint uppercase tracking-wide">
            <Target size={12 />} Goals
          </div>
          <div className="mt-1 text-2xl font-bold text-text">{stats.goals}</div>
          <div className="text-xs text-text-soft">via voice</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-faint uppercase tracking-wide">
            <FileText size={12 />} Notes
          </div>
          <div className="mt-1 text-2xl font-bold text-text">{stats.notes}</div>
          <div className="text-xs text-text-soft">captured</div>
        </div>
      </div>

      {/* Voice Notes History */}
      <div className="mt-8 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Clock size={16 />} Recent Voice Notes
          </h2>
          <span className="text-xs text-text-faint">{voiceNotes.length} notes</span>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-text-faint">Loading...</p>
          ) : voiceNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper-2 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal-tint text-[#7C5CFF]">
                <Mic size={20 />} />
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
                      <Trash2 size={12 />} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VoicePage() {
  return (
    <AuthGuard>
      <VoicePageInner />
    </AuthGuard>
  );
}