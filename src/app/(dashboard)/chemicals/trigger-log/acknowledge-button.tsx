"use client";

// Acknowledge a FAILED trigger.
//
// Deliberately does NOT resolve anything: the change request still has to be
// raised by hand. What it records is that a named person has picked the failure
// up, which is the difference between a failure nobody owns and a failure
// somebody is working. The row stays FAILED forever — rewriting history to
// FIRED after a manual fix would make the log useless as evidence.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiSend } from "../_client";

export function AcknowledgeButton({ logId }: { logId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiSend(`/api/chemicals/moc-trigger-log/${logId}/acknowledge`, {});
          toast({
            variant: "success",
            title: "Failure acknowledged",
            description: "Raise the change request manually — this does not create it for you.",
          });
          router.refresh();
        } catch (e: any) {
          toast({
            variant: "error",
            title: "Could not acknowledge",
            description: e?.message ?? "Please try again.",
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Check size={13} className="mr-1" />}
      Acknowledge
    </Button>
  );
}
