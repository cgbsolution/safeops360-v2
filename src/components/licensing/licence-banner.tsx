"use client";

// Graded expiry banners (build prompt §7):
//   EXPIRING_SOON — dismissible nudge ("expires in N days").
//   GRACE         — persistent, non-dismissible, escalating prominence.
// Also surfaces a clock-tamper warning to admins. ACTIVE shows nothing.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useLicence } from "./licence-provider";
import { Button } from "@/components/ui/button";

export function LicenceBanner() {
  const { view } = useLicence();
  const [dismissed, setDismissed] = useState(false);
  if (!view) return null;

  const { status, daysToExpiry } = view;

  if (status === "GRACE") {
    return (
      <Bar tone="rose" persistent>
        <AlertTriangle size={15} className="shrink-0" />
        <span>
          Your licence expired and is in its grace period
          {typeof daysToExpiry === "number" ? ` (${Math.max(0, (view.gracePeriodDays ?? 0) + daysToExpiry)} day(s) left)` : ""}.
          Upload a renewal to avoid losing access.{" "}
          <Link href="/licence" className="underline font-medium">Manage licence</Link>
        </span>
      </Bar>
    );
  }

  if (status === "EXPIRING_SOON" && !dismissed) {
    return (
      <Bar tone="amber" onClose={() => setDismissed(true)}>
        <Clock size={15} className="shrink-0" />
        <span>
          Your licence expires in {daysToExpiry} day(s).{" "}
          <Link href="/licence" className="underline font-medium">Renew now</Link> to avoid interruption.
        </span>
      </Bar>
    );
  }

  // Clock-tamper alert (admins only — bindingWarning/clockTamperWarning are only
  // populated on the admin status view).
  if (view.clockTamperWarning) {
    return (
      <Bar tone="rose" persistent>
        <AlertTriangle size={15} className="shrink-0" />
        <span>System clock appears to have been set backward — licence validity is enforced against the last-seen time.</span>
      </Bar>
    );
  }

  return null;
}

function Bar({
  children,
  tone,
  persistent,
  onClose,
}: {
  children: React.ReactNode;
  tone: "amber" | "rose";
  persistent?: boolean;
  onClose?: () => void;
}) {
  const tones =
    tone === "rose"
      ? "bg-rose-50 border-rose-200 text-rose-800"
      : "bg-amber-50 border-amber-200 text-amber-800";
  return (
    <div className={`flex items-center gap-2 border-b px-4 py-2 text-sm ${tones}`}>
      {children}
      {!persistent && onClose && (
        <Button variant="ghost" onClick={onClose} className="ml-auto opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
