"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, KeyRound } from "lucide-react";
import { Can } from "@/components/auth/can";

export function UserActions({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deleteUser() {
    if (!confirm(
      `Delete ${userName} (${userEmail})?\n\nThis cannot be undone. Records the user originated will be retained but their account will be removed and they will not be able to log in.`
    )) return;
    const second = prompt(`Type DELETE to confirm.`);
    if (second !== "DELETE") return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/configuration/users");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Delete failed.");
    }
  }

  async function resetPassword() {
    const newPwd = prompt("Enter a new password (minimum 8 characters):");
    if (!newPwd) return;
    if (newPwd.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPwd })
    });
    setBusy(false);
    if (res.ok) {
      alert("Password reset.");
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Reset failed.");
    }
  }

  return (
    <div className="flex gap-2">
      <Can permission="CONFIGURATION.USERS">
        <Button variant="ghost" onClick={resetPassword} disabled={busy}>
          <KeyRound size={14} /> Reset password
        </Button>
      </Can>
      <Can permission="CONFIGURATION.USERS">
        <Button
          variant="ghost"
          onClick={deleteUser}
          disabled={busy}
          className="text-rose-700 hover:text-rose-900 hover:bg-rose-50"
        >
          <Trash2 size={14} /> Delete user
        </Button>
      </Can>
    </div>
  );
}
