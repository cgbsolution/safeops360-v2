"use client";

// ADVANCED editor — set the Target risk level, assign 3-Lines-of-Defence, and edit
// the Bow-tie (threats → top event → consequences, with preventive/mitigating
// barriers). Writes to the existing ERM endpoints and refreshes the server page.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Layers, GitBranch, Plus, X, ChevronDown, ChevronRight, Save } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { Bowtie, BowtieBarrier, RiskDetail } from "../../lib";

const BAR_STATUS = ["WORKED", "UNTESTED", "FAILED", "ABSENT"] as const;
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

function Section({ icon: Icon, title, children, defaultOpen = false }: { icon: any; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <Button type="button" variant="ghost" onClick={() => setOpen((o) => !o)} className="h-auto w-full justify-start gap-2 px-4 py-3 text-left">
        <Icon size={16} className="text-primary-600" />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {open ? <ChevronDown size={16} className="ml-auto text-slate-400" /> : <ChevronRight size={16} className="ml-auto text-slate-400" />}
      </Button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

type PutFn = (url: string, body: unknown) => Promise<string | null>;

const put: PutFn = async (url, body) => {
  const res = await fetch(url, { method: url.endsWith("/target") ? "POST" : "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  try {
    const j = await res.json();
    return j?.detail ?? j?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function AdvancedRiskEditor({ risk }: { risk: RiskDetail }) {
  const router = useRouter();

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Advanced — Configure</h3>
      <TargetForm risk={risk} onSaved={() => router.refresh()} put={put} />
      <ThreeLinesForm risk={risk} onSaved={() => router.refresh()} put={put} />
      <BowtieForm risk={risk} onSaved={() => router.refresh()} put={put} />
    </div>
  );
}

// ── Target ──────────────────────────────────────────────────────────────────
function TargetForm({ risk, onSaved, put }: { risk: RiskDetail; onSaved: () => void; put: PutFn }) {
  const [l, setL] = useState(risk.targetLikelihood ?? risk.residualLikelihood ?? 1);
  const [i, setI] = useState(risk.targetImpact ?? risk.residualImpact ?? 1);
  const [date, setDate] = useState(risk.targetDate ? risk.targetDate.slice(0, 10) : "");
  const [fin, setFin] = useState<string>("");
  const [rationale, setRationale] = useState(risk.targetRationale ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    const e = await put(`/api/erm/risks/${risk.id}/target`, {
      targetLikelihood: l, targetImpact: i,
      targetDate: date ? new Date(date).toISOString() : null,
      targetRationale: rationale || null,
      financialExpectedInr: fin ? Number(fin) : null,
    });
    setBusy(false);
    if (e) setErr(e); else onSaved();
  };

  return (
    <Section icon={Target} title="Target Risk Level" defaultOpen>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-slate-500">Likelihood
          <Select value={l} onChange={(e) => setL(Number(e.target.value))} className="mt-1">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </label>
        <label className="text-xs text-slate-500">Impact
          <Select value={i} onChange={(e) => setI(Number(e.target.value))} className="mt-1">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </label>
        <label className="text-xs text-slate-500">Target Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </label>
        <label className="text-xs text-slate-500">Target ₹ impact (expected)
          <Input type="number" min={0} value={fin} onChange={(e) => setFin(e.target.value)} placeholder="e.g. 5000000" className="mt-1" />
        </label>
      </div>
      <div className="mt-2 text-xs text-slate-500">Target score = <span className="font-semibold text-slate-700 tabular-nums">{l * i}</span> (must be ≤ current residual {risk.residualScore ?? "—"})</div>
      <Textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} placeholder="Why this target, and how will we steer to it?" className="mt-2" />
      {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
      <Button type="button" onClick={save} disabled={busy} className="mt-2 gap-1">
        <Save size={14} /> {busy ? "Saving…" : "Save target"}
      </Button>
    </Section>
  );
}

// ── Three lines of defence ────────────────────────────────────────────────────
function ThreeLinesForm({ risk, onSaved, put }: { risk: RiskDetail; onSaved: () => void; put: PutFn }) {
  const [first, setFirst] = useState<string | null>(risk.firstLineOwnerId ?? null);
  const [second, setSecond] = useState<string | null>(risk.secondLineOwnerId ?? null);
  const [third, setThird] = useState(risk.thirdLineAssurance ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    const e = await put(`/api/erm/risks/${risk.id}/three-lines`, { firstLineOwnerId: first, secondLineOwnerId: second, thirdLineAssurance: third || null });
    setBusy(false);
    if (e) setErr(e); else onSaved();
  };

  return (
    <Section icon={Layers} title="Three Lines of Defence">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <span className="text-xs font-medium text-slate-500">1st line (owns & manages)</span>
          <UserPicker value={first} onChange={(id) => setFirst(id)} placeholder="Operational owner" />
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500">2nd line (oversight)</span>
          <UserPicker value={second} onChange={(id) => setSecond(id)} placeholder="Risk / compliance" />
        </div>
        <label className="text-xs font-medium text-slate-500">3rd line (independent assurance)
          <Input value={third} onChange={(e) => setThird(e.target.value)} placeholder="e.g. Internal Audit — FY26 plan" className="mt-1" />
        </label>
      </div>
      {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
      <Button type="button" onClick={save} disabled={busy} className="mt-3 gap-1">
        <Save size={14} /> {busy ? "Saving…" : "Save 3LoD"}
      </Button>
    </Section>
  );
}

// ── Bow-tie ───────────────────────────────────────────────────────────────────
function emptyBowtie(): Bowtie {
  return { topEvent: "", threats: [], consequences: [] };
}

function BarrierRows({ barriers, type, onChange }: { barriers: BowtieBarrier[]; type: "PREVENTIVE" | "MITIGATING"; onChange: (b: BowtieBarrier[]) => void }) {
  return (
    <div className="mt-1 space-y-1">
      {barriers.map((b, idx) => (
        <div key={b.id} className="flex items-center gap-1">
          <Input
            value={b.description}
            onChange={(e) => onChange(barriers.map((x) => (x.id === b.id ? { ...x, description: e.target.value } : x)))}
            placeholder={`${type === "PREVENTIVE" ? "Preventive" : "Mitigating"} barrier`}
            className="flex-1 text-xs"
          />
          <Select
            value={b.status}
            onChange={(e) => onChange(barriers.map((x) => (x.id === b.id ? { ...x, status: e.target.value as BowtieBarrier["status"] } : x)))}
            className="text-xs"
          >
            {BAR_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(barriers.filter((x) => x.id !== b.id))} className="h-6 w-6 text-slate-400 hover:text-rose-600"><X size={13} /></Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChange([...barriers, { id: uid(), description: "", barrierType: type, controlId: null, controlCode: null, status: "UNTESTED" }])}
        className="h-auto text-[11px] font-medium text-primary-600 hover:underline"
      >
        + barrier
      </Button>
    </div>
  );
}

function BowtieForm({ risk, onSaved, put }: { risk: RiskDetail; onSaved: () => void; put: PutFn }) {
  const [bt, setBt] = useState<Bowtie>(risk.bowtie ?? emptyBowtie());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    const e = await put(`/api/erm/risks/${risk.id}/bowtie`, bt);
    setBusy(false);
    if (e) setErr(e); else onSaved();
  };

  return (
    <Section icon={GitBranch} title="Bow-tie (causes → event → consequences)">
      <label className="text-xs font-medium text-slate-500">Top event
        <Input value={bt.topEvent} onChange={(e) => setBt({ ...bt, topEvent: e.target.value })} placeholder="The risk event at the centre of the bow-tie" className="mt-1" />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Threats / preventive side */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Threats → preventive barriers</div>
          {bt.threats.map((t) => (
            <div key={t.id} className="mb-2 rounded border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1">
                <Input value={t.description} onChange={(e) => setBt({ ...bt, threats: bt.threats.map((x) => (x.id === t.id ? { ...x, description: e.target.value } : x)) })} placeholder="Threat / cause" className="flex-1 text-xs font-medium" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setBt({ ...bt, threats: bt.threats.filter((x) => x.id !== t.id) })} className="h-6 w-6 text-slate-400 hover:text-rose-600"><X size={13} /></Button>
              </div>
              <BarrierRows barriers={t.preventiveBarriers} type="PREVENTIVE" onChange={(b) => setBt({ ...bt, threats: bt.threats.map((x) => (x.id === t.id ? { ...x, preventiveBarriers: b } : x)) })} />
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setBt({ ...bt, threats: [...bt.threats, { id: uid(), description: "", preventiveBarriers: [] }] })} className="h-auto gap-1 text-xs font-medium text-primary-600 hover:underline"><Plus size={12} /> threat</Button>
        </div>

        {/* Consequences / mitigating side */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consequences → mitigating barriers</div>
          {bt.consequences.map((c) => (
            <div key={c.id} className="mb-2 rounded border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1">
                <Input value={c.description} onChange={(e) => setBt({ ...bt, consequences: bt.consequences.map((x) => (x.id === c.id ? { ...x, description: e.target.value } : x)) })} placeholder="Consequence" className="flex-1 text-xs font-medium" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setBt({ ...bt, consequences: bt.consequences.filter((x) => x.id !== c.id) })} className="h-6 w-6 text-slate-400 hover:text-rose-600"><X size={13} /></Button>
              </div>
              <BarrierRows barriers={c.mitigatingBarriers} type="MITIGATING" onChange={(b) => setBt({ ...bt, consequences: bt.consequences.map((x) => (x.id === c.id ? { ...x, mitigatingBarriers: b } : x)) })} />
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={() => setBt({ ...bt, consequences: [...bt.consequences, { id: uid(), description: "", mitigatingBarriers: [] }] })} className="h-auto gap-1 text-xs font-medium text-primary-600 hover:underline"><Plus size={12} /> consequence</Button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">A FAILED or ABSENT barrier flags the risk for reassessment (control-alert).</p>
      {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
      <Button type="button" onClick={save} disabled={busy} className="mt-2 gap-1">
        <Save size={14} /> {busy ? "Saving…" : "Save bow-tie"}
      </Button>
    </Section>
  );
}
