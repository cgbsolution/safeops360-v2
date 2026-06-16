"use client";

// Threaded comments for a Near Miss. Loads via Python; allows anyone
// with NEAR_MISS.READ to add a comment.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; designation: string | null } | null;
};

export function CommentsThread({ nearMissId }: { nearMissId: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/near-miss/${nearMissId}/comments`);
      const j = await r.json();
      setItems(r.ok ? (j.items ?? []) : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [nearMissId]);

  async function post() {
    if (!draft.trim()) return;
    setPosting(true); setErr("");
    const r = await fetch(`/api/near-miss/${nearMissId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft })
    });
    setPosting(false);
    if (r.ok) { setDraft(""); await load(); }
    else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? j.detail ?? "Failed to post");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare size={16} /> Discussion ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-500 py-2">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-500 py-2">No comments yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <div key={c.id} className="flex items-start gap-3 text-sm">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-700 flex-shrink-0">
                  {(c.author?.name ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500">
                    <strong className="text-slate-900">{c.author?.name ?? "Unknown"}</strong>
                    {c.author?.designation && <> · {c.author.designation}</>}
                    <> · {formatDateTime(c.createdAt)}</>
                  </div>
                  <div className="text-slate-800 mt-0.5 whitespace-pre-wrap">{c.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="pt-3 border-t">
          <Textarea rows={2} placeholder="Add a comment…" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={post} disabled={posting || !draft.trim()}>
              {posting ? <Loader2 size={13} className="animate-spin" /> : null} Post
            </Button>
          </div>
          {err && <div className="text-xs text-rose-700 mt-1">{err}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
