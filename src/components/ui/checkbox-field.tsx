"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// A checkbox with its label, as one hit target.
//
// The registers wrote this as a bare `<label className="…"><input
// type="checkbox" /> text</label>` in eleven files. Two problems that pattern
// has everywhere it appears: the control gets no `id`, so nothing else on the
// page can point at it (and a screen reader announcing the group has no name
// to read), and each copy re-invents its own spacing, so the same "confirm this"
// row sits at three different heights depending on the panel.
//
// `card` is the boxed variant the PPE grid and the closure checklist use — the
// whole box is clickable and it highlights when checked.

let autoId = 0;

export interface CheckboxFieldProps extends Omit<CheckboxProps, "id"> {
  /** Row text. Anything renderable — the closure checklist puts a hint under it. */
  label: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  /** Boxed, whole-row-clickable presentation. */
  variant?: "inline" | "card";
  id?: string;
  /** Classes for the wrapping label, not the control. */
  className?: string;
}

const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, description, variant = "inline", id, className, checked, disabled, ...props }, ref) => {
    // useId would be the idiom, but this component is used inside .map() render
    // paths that are also called from server components in this app; a module
    // counter is stable enough for a label association and never suspends.
    const fallbackId = React.useMemo(() => `cbf-${++autoId}`, []);
    const inputId = id ?? fallbackId;

    return (
      <Label
        htmlFor={inputId}
        className={cn(
          "flex items-start gap-2 text-sm font-normal",
          variant === "card" &&
            cn(
              "cursor-pointer rounded-md border px-2.5 py-2 transition",
              checked ? "border-primary-300 bg-primary-50/50" : "border-slate-200 bg-white hover:border-slate-300"
            ),
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <Checkbox ref={ref} id={inputId} checked={checked} disabled={disabled} className="mt-0.5" {...props} />
        <span className="min-w-0">
          <span className="block">{label}</span>
          {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
        </span>
      </Label>
    );
  }
);
CheckboxField.displayName = "CheckboxField";

export { CheckboxField };
