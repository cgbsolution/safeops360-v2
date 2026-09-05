"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Users, PhoneCall, CheckCircle2 } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import type { TeamRole, CallTree } from "@/app/(dashboard)/erm/lib-p3";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Card } from "@/components/ui/card";

type Plant = { id: string; code: string; name: string };

const CORPORATE = "__corporate__";

export function AdminView({ roster, callTrees, plants }: { roster: TeamRole[]; callTrees: CallTree[]; plants: Plant[] }) {
  const router = useRouter();
  const [addRole, setAddRole] = useState(false);
  const [newTree, setNewTree] = useState(false);

  // Group roster by site (null = Corporate)
  const groups = new Map<string, { siteName: string; roles: TeamRole[] }>();
  for (const r of roster) {
    const key = r.siteId ?? CORPORATE;
    const siteName = r.siteId ? plants.find((p) => p.id === r.siteId)?.name ?? "Site" : "Corporate";
    if (!groups.has(key)) groups.set(key, { siteName, roles: [] });
    groups.get(key)!.roles.push(r);
  }
  // Sort each group's roles by escalation order
  for (const g of groups.values()) g.roles.sort((a, b) => a.escalationOrder - b.escalationOrder);
  const groupEntries = [...groups.entries()].sort((a, b) => a[1].siteName.localeCompare(b[1].siteName));

  return (
    <div className="space-y-8">
      {/* ── Roster ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Users size={18} className="text-slate-400" /> Crisis roster
          </h2>
          <Button type="button" onClick={() => setAddRole(true)} className="gap-1.5">
            <Plus size={16} /> Add role
          </Button>
        </div>

        {roster.length === 0 ? (
          <Card className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-none">
            No crisis roles defined yet. Use <b>Add role</b> to build the roster.
          </Card>
        ) : (
          <div className="space-y-5">
            {groupEntries.map(([key, g]) => (
              <Card key={key} className="rounded-xl border border-slate-200 bg-white shadow-none">
                <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{g.siteName}</div>
                <Table>
                  <TableHeader>
                    <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <TableHead>Esc.</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Alternate</TableHead>
                      <TableHead>Responsibilities</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.roles.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="tabular-nums text-xs text-slate-500">{r.escalationOrder}</TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {r.roleName}
                          {r.vacancy && (
                            <span className="ml-2 rounded border border-rose-300 bg-rose-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-900">
                              Vacancy
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{r.primaryUserName ?? <span className="text-rose-600">— unassigned</span>}</TableCell>
                        <TableCell>{r.alternateUserName ?? <span className="text-rose-600">— unassigned</span>}</TableCell>
                        <TableCell className="max-w-[320px] text-xs text-slate-500">{r.responsibilities || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Call trees ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <PhoneCall size={18} className="text-slate-400" /> Call trees
          </h2>
          <Button type="button" onClick={() => setNewTree(true)} className="gap-1.5">
            <Plus size={16} /> New call tree
          </Button>
        </div>

        {callTrees.length === 0 ? (
          <Card className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-none">
            No call trees yet. Use <b>New call tree</b> to define a notification cascade.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {callTrees.map((t) => (
              <CallTreeCard key={t.id} tree={t} plants={plants} />
            ))}
          </div>
        )}
      </section>

      {addRole && <AddRoleModal plants={plants} onClose={() => setAddRole(false)} onDone={() => { setAddRole(false); router.refresh(); }} />}
      {newTree && <NewTreeModal plants={plants} onClose={() => setNewTree(false)} onDone={() => { setNewTree(false); router.refresh(); }} />}
    </div>
  );
}

function CallTreeCard({ tree, plants }: { tree: CallTree; plants: Plant[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const siteName = tree.siteId ? plants.find((p) => p.id === tree.siteId)?.name ?? "Site" : "Corporate";

  async function publish() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erm/bcm/call-trees/${tree.id}/publish`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{tree.name}</div>
          <div className="text-xs text-slate-500">{siteName} · {tree.nodes?.length ?? 0} node(s)</div>
        </div>
        {tree.publishedAt ? (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 size={12} /> Published {fmtDate(tree.publishedAt)}
          </span>
        ) : (
          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Draft</span>
        )}
      </div>
      {tree.staleContacts > 0 && (
        <p className="mt-2 text-xs text-amber-700">{tree.staleContacts} stale contact(s) — verify before relying on this tree.</p>
      )}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <Button
        type="button"
        variant="outline"
        onClick={publish}
        disabled={busy}
        className="mt-3 w-full text-slate-700 hover:border-primary-500"
      >
        {busy ? "Publishing…" : tree.publishedAt ? "Re-publish" : "Publish"}
      </Button>
    </Card>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SiteSelect({ value, onChange, plants }: { value: string; onChange: (v: string) => void; plants: Plant[] }) {
  return (
    <SelectField value={value} onChange={onChange}
      placeholder="Corporate (no single site)"
      options={plants.map((p) => ({ value: p.id, label: p.name }))}
    />
  );
}

function AddRoleModal({ plants, onClose, onDone }: { plants: Plant[]; onClose: () => void; onDone: () => void }) {
  const [roleName, setRoleName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [primaryUserId, setPrimaryUserId] = useState<string | null>(null);
  const [alternateUserId, setAlternateUserId] = useState<string | null>(null);
  const [responsibilities, setResponsibilities] = useState("");
  const [escalationOrder, setEscalationOrder] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/erm/bcm/crisis-team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roleName: roleName.trim(),
          siteId: siteId || null,
          primaryUserId,
          alternateUserId,
          responsibilities: responsibilities.trim(),
          escalationOrder: Number(escalationOrder) || 0,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const valid = roleName.trim() && primaryUserId && alternateUserId;

  return (
    <Modal title="Add crisis role" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Role name</Label>
          <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Site Incident Controller" />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Site</Label>
          <SiteSelect value={siteId} onChange={setSiteId} plants={plants} />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Primary (required)</Label>
          <UserPicker value={primaryUserId} onChange={(id) => setPrimaryUserId(id)} placeholder="Select primary" />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Alternate (mandatory — no single-person roles)</Label>
          <UserPicker value={alternateUserId} onChange={(id) => setAlternateUserId(id)} placeholder="Select alternate" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Label className="mb-1 block text-xs font-medium text-slate-600">Escalation order</Label>
            <Input type="number" min={0} value={escalationOrder} onChange={(e) => setEscalationOrder(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Responsibilities</Label>
          <Textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} rows={2} placeholder="What this role owns during a crisis…" />
        </div>
        {err && <p className="text-xs text-rose-600">{err}</p>}
        <Button type="button" disabled={busy || !valid} onClick={submit} className="w-full">
          {busy ? "Saving…" : "Add role"}
        </Button>
        {!valid && <p className="text-center text-[11px] text-slate-400">Role name, primary and alternate are all required.</p>}
      </div>
    </Modal>
  );
}

type TreeNode = { id: string; parentNodeId: string | null; userId: string | null; groupName: string | null; contactPhone: string; contactEmail: string };

function newNode(): TreeNode {
  return { id: crypto.randomUUID(), parentNodeId: null, userId: null, groupName: "", contactPhone: "", contactEmail: "" };
}

function NewTreeModal({ plants, onClose, onDone }: { plants: Plant[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function updateNode(id: string, patch: Partial<TreeNode>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/erm/bcm/call-trees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          siteId: siteId || null,
          nodes: nodes.map((n) => ({
            id: n.id,
            parentNodeId: n.parentNodeId || null,
            userId: n.userId || null,
            groupName: n.groupName || null,
            contactPhone: n.contactPhone,
            contactEmail: n.contactEmail,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New call tree" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Tree name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. North Works Tier-1 cascade" />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Site</Label>
          <SiteSelect value={siteId} onChange={setSiteId} plants={plants} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs font-medium text-slate-600">Nodes</Label>
            <Button type="button" variant="ghost" onClick={() => setNodes((ns) => [...ns, newNode()])} className="gap-1 text-xs text-primary-700 hover:underline">
              <Plus size={12} /> Add node
            </Button>
          </div>
          {nodes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
              No nodes yet — a tree can be created empty and edited later, or add nodes now.
            </p>
          ) : (
            <div className="space-y-2">
              {nodes.map((n, i) => (
                <Card key={n.id} className="rounded-lg border border-slate-200 p-2 shadow-none">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Node {i + 1}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setNodes((ns) => ns.filter((x) => x.id !== n.id))} className="h-8 w-8 text-slate-400 hover:text-rose-600">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <UserPicker value={n.userId} onChange={(id) => updateNode(n.id, { userId: id })} placeholder="Person (or leave blank and use group)" />
                    <Input value={n.groupName ?? ""} onChange={(e) => updateNode(n.id, { groupName: e.target.value })} placeholder="Group name (alternative to person)" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={n.contactPhone} onChange={(e) => updateNode(n.id, { contactPhone: e.target.value })} placeholder="Phone" />
                      <Input value={n.contactEmail} onChange={(e) => updateNode(n.id, { contactEmail: e.target.value })} placeholder="Email" />
                    </div>
                    <SelectField
                      value={n.parentNodeId ?? ""}
                      ariaLabel="Parent node"
                      placeholder="No parent (top of cascade)"
                      onChange={(value) => updateNode(n.id, { parentNodeId: value || null })}
                      options={nodes
                        .filter((o) => o.id !== n.id)
                        .map((o) => ({
                          value: o.id,
                          label: `Parent: Node ${nodes.findIndex((x) => x.id === o.id) + 1}${o.groupName ? ` (${o.groupName})` : ""}`
                        }))}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {err && <p className="text-xs text-rose-600">{err}</p>}
        <Button type="button" disabled={busy || !name.trim()} onClick={submit} className="w-full">
          {busy ? "Saving…" : "Create call tree"}
        </Button>
      </div>
    </Modal>
  );
}
