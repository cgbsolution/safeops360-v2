"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tiny client island used by the near-miss detail page's metadata card.
// Server pages can't bind onClick directly, so the print action lives here.
export default function PrintButton() {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer size={13} /> Print / PDF
    </Button>
  );
}
