"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutGrid, PlusCircle, FileText, Gavel, ThumbsUp, ShieldCheck, EyeOff, Camera, Users, Send, Flag } from "lucide-react";
import type { WallPost, MyPost, QueuePost, Committee } from "./page";

const CATEGORIES = [
  { code: "UNSAFE_ACT", label: "Unsafe Act" },
  { code: "UNSAFE_CONDITION", label: "Unsafe Condition" },
  { code: "NEAR_MISS", label: "Near Miss" },
  { code: "GOOD_PRACTICE", label: "Good Practice" },
  { code: "IMPROVEMENT_SUGGESTION", label: "Improvement Suggestion" }
];
const SEV_TONE: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-rose-100 text-rose-800 border-rose-200"
};
const STATUS_TONE: Record<string, string> = {
  PENDING_AI_SCREEN: "bg-violet-100 text-violet-800 border-violet-200",
  PENDING_COMMITTEE: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DECLINED: "bg-slate-100 text-slate-700 border-slate-200",
  FLAGGED: "bg-rose-100 text-rose-800 border-rose-200"
};

function catLabel(c: string) {
  return CATEGORIES.find((x) => x.code === c)?.label ?? c.replace(/_/g, " ");
}

export function KaizenTabs({ plantId, wall, mine, queue, onCommittee, committee }: { plantId: string; wall: WallPost[]; mine: MyPost[]; queue: QueuePost[]; onCommittee: boolean; committee: Committee }) {
  const [tab, setTab] = useState<"wall" | "submit" | "mine" | "review">("wall");
  return (
    <div>
      {committee.members.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
          <Users size={14} className="text-violet-600" />
          <span className="font-medium text-slate-700">This month's Kaizen committee ({committee.period}):</span>
          <span>{committee.members.map((m) => m.name).join(", ")}</span>
          {committee.hseManagerSeat && <span className="text-amber-600">· HSE Manager seat (small pool)</span>}
          {committee.iAmMember && <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">You're a member</span>}
        </div>
      )}

      <div className="mb-4 inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5">
        <Tab active={tab === "wall"} onClick={() => setTab("wall")} icon={<LayoutGrid size={14} />}>Wall <Count n={wall.length} /></Tab>
        <Tab active={tab === "submit"} onClick={() => setTab("submit")} icon={<PlusCircle size={14} />}>Submit</Tab>
        <Tab active={tab === "mine"} onClick={() => setTab("mine")} icon={<FileText size={14} />}>My Submissions <Count n={mine.length} /></Tab>
        {onCommittee && <Tab active={tab === "review"} onClick={() => setTab("review")} icon={<Gavel size={14} />}>Committee Review <Count n={queue.length} /></Tab>}
      </div>

      {tab === "wall" && <Wall plantId={plantId} posts={wall} />}
      {tab === "submit" && <Submit plantId={plantId} isCommittee={committee.iAmMember} onDone={() => setTab("mine")} />}
      {tab === "mine" && <Mine posts={mine} />}
      {tab === "review" && onCommittee && <Review posts={queue} />}
    </div>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition", active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
      {icon}{children}
    </button>
  );
}
function Count({ n }: { n: number }) {
  return <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[10px]">{n}</span>;
}

function Wall({ plantId, posts }: { plantId: string; posts: WallPost[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  function react(id: string) {
    start(async () => {
      await fetch(`/api/sci/kaizen/posts/${id}/react`, { method: "POST" });
      router.refresh();
    });
  }
  if (posts.length === 0) {
    return <Empty icon={<ShieldCheck size={28} />} title="No approved posts yet" sub="Posts appear here once a peer committee approves them." />;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => (
        <div key={p.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-300">
            {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" /> : <Camera size={28} />}
          </div>
          <div className="p-3 flex-1 flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">{catLabel(p.category)}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${SEV_TONE[p.hazardSeveritySelf] ?? ""}`}>{p.hazardSeveritySelf}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700 flex-1">{p.description}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{p.submitter}{p.locationTag ? ` · ${p.locationTag}` : ""}</span>
              {p.pointsAwarded != null && <span className="font-semibold text-violet-700">+{p.pointsAwarded} pts</span>}
            </div>
            <button type="button" onClick={() => react(p.id)} className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-violet-300 hover:text-violet-700">
              <ThumbsUp size={12} /> {p.reactionsCount}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Submit({ plantId, isCommittee, onDone }: { plantId: string; isCommittee: boolean; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isCommittee) {
    return (
      <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <Gavel size={18} className="mb-1 text-amber-600" />
        You're on this month's Kaizen committee, so you can't submit wall posts during your rotation — this keeps reviews impartial. You can submit again next month.
      </div>
    );
  }
  const [category, setCategory] = useState("UNSAFE_CONDITION");
  const [severity, setSeverity] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [anon, setAnon] = useState(false);

  function submit() {
    setError(null);
    if (description.trim().length < 5) return setError("Please describe the hazard or idea (min 5 chars).");
    start(async () => {
      const res = await fetch("/api/sci/kaizen/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, category, hazardSeveritySelf: severity, description: description.trim(), locationTag: locationTag.trim() || null, photoUrl: photoUrl.trim() || null, isAnonymous: anon })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Submit failed");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" required>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input">
            {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Hazard severity" required>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="form-input">
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </Field>
      </div>
      <Field label="Description" required>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What did you see? Suggest a fix if you can." className="form-input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location">
          <input value={locationTag} onChange={(e) => setLocationTag(e.target.value)} placeholder="e.g., CM-1 walkway" className="form-input" />
        </Field>
        <Field label="Photo URL">
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" className="form-input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
        <EyeOff size={14} className="text-slate-400" /> Submit anonymously <span className="text-xs text-slate-400">(your name is hidden; you still earn the points)</span>
      </label>
      {error && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending}>{pending ? "Submitting…" : "Submit to committee"}</Button>
      </div>
    </div>
  );
}

function Mine({ posts }: { posts: MyPost[] }) {
  if (posts.length === 0) return <Empty icon={<FileText size={28} />} title="No submissions yet" sub="Use the Submit tab to file your first Kaizen post." />;
  return (
    <div className="space-y-2.5">
      {posts.map((p) => (
        <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[p.status] ?? ""}`}>{p.status.replace(/_/g, " ")}</span>
            <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">{catLabel(p.category)}</span>
            {p.isAnonymous && <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><EyeOff size={10} /> anonymous</span>}
            {p.crossPlantDistributed && <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700"><Send size={10} /> shared cross-plant +15</span>}
            {p.pointsAwarded != null && <span className="text-xs font-semibold text-violet-700">+{p.pointsAwarded} pts</span>}
          </div>
          <p className="mt-2 text-sm text-slate-700">{p.description}</p>
          {p.status === "FLAGGED" && p.aiFlagReason && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <Flag size={12} /> AI pre-screen: {p.aiFlagReason} — please edit and resubmit.
            </div>
          )}
          {p.status === "DECLINED" && p.declineFeedback && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Committee feedback:</strong> {p.declineFeedback} <span className="text-amber-600">— you can revise and resubmit.</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Review({ posts }: { posts: QueuePost[] }) {
  if (posts.length === 0) return <Empty icon={<Gavel size={28} />} title="Nothing to review" sub="Pending posts from other people appear here — submitter identity is always hidden." />;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
        <ShieldCheck size={12} className="inline mr-1" /> You're reviewing as a committee member. <strong>Submitter identity is withheld</strong> — score on merit only.
      </div>
      {posts.map((p) => <ReviewCard key={p.id} post={p} />)}
    </div>
  );
}

function ReviewCard({ post }: { post: QueuePost }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hazardSig, setH] = useState(3);
  const [learningVal, setL] = useState(3);
  const [actionQual, setA] = useState(3);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  function act(decision: "APPROVE" | "DECLINE") {
    setError(null);
    if (decision === "DECLINE" && !feedback.trim()) return setError("Decline requires feedback for the submitter.");
    start(async () => {
      const res = await fetch(`/api/sci/kaizen/posts/${post.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hazardSig, learningVal, actionQual, decision, feedback: feedback.trim() || null })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">{catLabel(post.category)}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${SEV_TONE[post.hazardSeveritySelf] ?? ""}`}>{post.hazardSeveritySelf}</span>
        {post.locationTag && <span className="text-[11px] text-slate-500">{post.locationTag}</span>}
        {post.aiCategorySuggestion && post.aiCategorySuggestion !== post.category && (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">AI suggests: {catLabel(post.aiCategorySuggestion)}</span>
        )}
        {post.aiDuplicateFlag && <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"><Flag size={10} /> possible duplicate</span>}
        <span className="text-[10px] text-slate-400">{post.reviewsSoFar}/2 reviews (quorum)</span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{post.description}</p>
      {post.alreadyReviewed && <div className="mt-2 text-xs text-emerald-700">✓ You've reviewed this — awaiting other members.</div>}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Rubric label="Hazard significance" value={hazardSig} onChange={setH} />
        <Rubric label="Learning value" value={learningVal} onChange={setL} />
        <Rubric label="Action quality" value={actionQual} onChange={setA} />
      </div>
      <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback (required to decline)" className="form-input mt-3 text-sm" />
      {error && <div className="mt-2 text-xs text-rose-700">{error}</div>}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => act("APPROVE")} disabled={pending || post.alreadyReviewed}>Approve &amp; award</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => act("DECLINE")} disabled={pending || post.alreadyReviewed}>Decline</Button>
      </div>
    </div>
  );
}

function Rubric({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="form-input mt-0.5 text-sm">
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label} {required && <span className="text-rose-600">*</span>}</label>
      {children}
    </div>
  );
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
      <div className="mx-auto mb-2 text-slate-300">{icon}</div>
      <div className="text-sm font-medium text-slate-700">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
