"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Save, Eye, EyeOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";

type Plant = { id: string; name: string; code: string };
type Role = { id: string; code: string; name: string };

export function UserForm({
  initial, plants, roles
}: {
  initial?: any;
  plants: Plant[];
  roles: Role[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role ?? roles[0]?.code ?? "WORKER");
  const [plantId, setPlantId] = useState(initial?.plantId ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [designation, setDesignation] = useState(initial?.designation ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!initial && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const payload: any = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      plantId: plantId || null,
      department: department.trim() || null,
      designation: designation.trim() || null
    };
    if (password) payload.password = password;
    const url = initial?.id ? `/api/admin/users/${initial.id}` : "/api/admin/users";
    const method = initial?.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status}).`);
      return;
    }
    const j = await res.json();
    router.push(`/configuration/users/${j.id ?? initial?.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Email is the login identifier and must be unique.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Full name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div>
            <Label>Designation</Label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Safety Officer / Plant Head / etc." />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="HSE, Operations, …" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role & scope</CardTitle>
          <CardDescription>Primary role drives default permissions. Add additional roles in the user detail page after creating.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Primary role *</Label>
            <SelectField value={role} onChange={(value) => setRole(value)}
              options={roles.map((r) => ({ value: String(r.code), label: r.name }))}
            />
          </div>
          <div>
            <Label>Plant</Label>
            <SelectField value={plantId} onChange={(value) => setPlantId(value)}
              placeholder="— No plant assignment —"
              options={plants.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {initial?.id
              ? "Leave blank to keep the existing password unchanged."
              : "Set the user's initial password. They can change it after first login."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Password {initial?.id ? "(optional)" : "*"}</Label>
              <Input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={initial?.id ? "Leave blank to keep existing" : "Minimum 8 characters"}
              />
            </div>
            <Button type="button" variant="ghost" onClick={() => setShowPwd((v) => !v)}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</Alert>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          <Save size={16} /> {submitting ? "Saving…" : initial?.id ? "Save changes" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
