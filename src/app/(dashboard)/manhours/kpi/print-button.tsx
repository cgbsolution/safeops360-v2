"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Print trigger for the KPI drill-down audit trail. Uses
 * `window.print()` which respects the page's @media print rules
 * (defined inline on the parent page) — no headless renderer needed.
 *
 * Lives in its own client file because the drill-down page is a
 * server component and the click handler needs the browser.
 */
export function KpiDrillDownPrint() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer size={14} /> Print audit trail
    </Button>
  );
}
