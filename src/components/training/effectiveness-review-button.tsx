"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { readApiError } from "@/lib/client-errors";

const REVIEWER_ROLES = [
  "HSE_MANAGER",
  "LD_MANAGER",
  "ADMIN",
  "SUPERVISOR",
];

export function EffectivenessReviewButton({
  certificateId,
  currentRole,
}: {
  certificateId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!REVIEWER_ROLES.includes(currentRole)) {
    return (
      <p className="text-xs text-slate-500">
        Only HSE / L&D / Supervisor / Admin can review effectiveness.
      </p>
    );
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/training/certificates/${certificateId}/effectiveness-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, notes: notes || null }),
        }
      );
      if (r.ok) {
        setShow(false);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to record review"));
    } finally {
      setBusy(false);
    }
  }

  if (!show) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShow(true)}>
        <Star size={14} /> Record review
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Effectiveness rating</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <Button variant="ghost"
              key={v}
              type="button"
              onClick={() => setRating(v)} className="hover:scale-110 transition-transform">
              <Star
                size={20}
                className={
                  rating >= v ? "text-amber-500 fill-amber-500" : "text-slate-300"
                }
              />
            </Button>
          ))}
          <span className="ml-2 text-xs text-slate-600">{rating}/5</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How well did the training translate to actual competency?"
        />
      </div>
      {error && <div className="text-xs text-rose-700">{error}</div>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
          Save Review
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShow(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
