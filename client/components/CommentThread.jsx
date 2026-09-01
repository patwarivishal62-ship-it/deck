"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { parseCommentBody, mentionToken } from "@/lib/mentions";
import { Button } from "./FormControls";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function CommentBody({ body }) {
  const nodes = parseCommentBody(body);
  return (
    <p className="whitespace-pre-wrap text-sm text-text">
      {nodes.map((n, i) =>
        typeof n === "string" ? (
          <span key={i}>{n}</span>
        ) : (
          <span key={n.key} className="font-medium text-signal-deep">
            @{n.name}
          </span>
        )
      )}
    </p>
  );
}

export default function CommentThread({ projectId, taskId = null }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [text, setText] = useState("");
  const [insertedMentions, setInsertedMentions] = useState([]); // [{ name, userId }]
  const [busy, setBusy] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null = dropdown closed
  const textareaRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [commentsRes, collaboratorsRes] = await Promise.all([
          api.listComments(projectId, taskId),
          api.listCollaborators(projectId),
        ]);
        setComments(commentsRes.comments);
        setCollaborators(collaboratorsRes.collaborators);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, taskId]);

  function handleTextChange(e) {
    const value = e.target.value;
    setText(value);

    const cursor = e.target.selectionStart;
    const upToCursor = value.slice(0, cursor);
    const match = upToCursor.match(/@([a-zA-Z0-9 ]*)$/);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  }

  function pickMention(collaborator) {
    const value = text;
    const cursor = textareaRef.current.selectionStart;
    const upToCursor = value.slice(0, cursor);
    const match = upToCursor.match(/@([a-zA-Z0-9 ]*)$/);
    if (!match) return;

    const name = collaborator.name || collaborator.email;
    const before = value.slice(0, match.index);
    const after = value.slice(cursor);
    // Show a clean "@Name" while composing — the textarea can only display
    // plain text, so showing the real @[Name](userId) token here would look
    // exactly like the bug this fixes. The token is reconstructed silently
    // from insertedMentions right before the comment is actually sent.
    const next = `${before}@${name} ${after}`;
    setText(next);
    setInsertedMentions((prev) =>
      prev.some((m) => m.userId === collaborator.userId)
        ? prev
        : [...prev, { name, userId: collaborator.userId }]
    );
    setMentionQuery(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const filteredCollaborators = collaborators.filter((c) =>
    mentionQuery === null || mentionQuery === ""
      ? true
      : (c.name || c.email || "").toLowerCase().includes(mentionQuery)
  );

  function toWireFormat(displayText) {
    // Reconstruct @[Name](userId) tokens from plain "@Name" text, longest
    // names first so e.g. "John Doe" doesn't get partially matched by
    // a shorter "John" also present in this comment.
    const sorted = [...insertedMentions].sort((a, b) => b.name.length - a.name.length);
    let result = displayText;
    for (const { name, userId } of sorted) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`@${escaped}(?!\\()`, "g"), mentionToken(name, userId));
    }
    return result;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.createComment(projectId, toWireFormat(text.trim()), taskId);
      setComments((prev) => [...prev, data.comment]);
      setText("");
      setInsertedMentions([]);
      setMentionQuery(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(comment) {
    if (!confirm("Delete this comment?")) return;
    try {
      await api.deleteComment(projectId, comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>;
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}

      <div className="mb-4 flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-text-soft">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-line bg-paper p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-text-soft">{c.authorName || c.authorEmail}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-text-faint">{timeAgo(c.createdAt)}</span>
                  {c.authorId === user?.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="text-[11px] text-text-faint hover:text-signal-deep"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <CommentBody body={c.body} />
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          rows={2}
          placeholder="Comment"
          className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-text outline-none transition focus:border-signal focus:bg-card"
        />

        {mentionQuery !== null && filteredCollaborators.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-lg border border-line bg-card shadow-xl">
            {filteredCollaborators.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => pickMention(c)}
                className="block w-full px-3 py-1.5 text-left text-sm text-text hover:bg-paper"
              >
                {c.name || c.email}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
