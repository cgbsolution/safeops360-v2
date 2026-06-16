"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

export function LegacyCloseButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function close() {
    setBusy(true);
    const res = await fetch(`/api/observations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED", closingRemark: remark })
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)} variant="success"><CheckCircle2 size={16} /> Verify & Close</Button>;

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm space-y-2 w-80">
      <Textarea
        rows={3}
        placeholder="Closing remark (verification details)"
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="success" onClick={close} disabled={busy || !remark}>
          {busy ? "Closing..." : "Confirm Close"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
