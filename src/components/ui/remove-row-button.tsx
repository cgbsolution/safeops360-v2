"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// The "remove this row" affordance every repeatable sub-form needs — permit
// crew and isolations, incident persons, witnesses and equipment, gas
// parameters, CAPA rows.
//
// Each of those was a bare `<button className="text-slate-400 hover:text-rose-600">`
// wrapping a trash icon, with no accessible name at all: a screen reader
// announced a dozen identical unlabelled buttons on the incident form and no
// way to tell which row each belonged to. `label` is required for that reason —
// make it name the row ("Remove witness"), not the action.
export interface RemoveRowButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  label: string;
}

const RemoveRowButton = React.forwardRef<HTMLButtonElement, RemoveRowButtonProps>(
  ({ label, className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={cn(
        "h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-rose-600",
        className
      )}
      {...props}
    >
      <Trash2 size={14} />
    </Button>
  )
);
RemoveRowButton.displayName = "RemoveRowButton";

export { RemoveRowButton };
