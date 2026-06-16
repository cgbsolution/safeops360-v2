"use client";

// Triggers the browser's print dialog so the audit-grade detail view
// can be exported to PDF as a formal investigation report. The detail
// page applies `print:hidden` to the action panels and upload widgets
// so the printed document only contains the read-only sections.

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintIncidentButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
    >
      <Printer size={14} /> Print / PDF
    </Button>
  );
}
