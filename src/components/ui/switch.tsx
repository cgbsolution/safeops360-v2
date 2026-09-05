"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Toggle switch, built on a plain button with `role="switch"` rather than
// @radix-ui/react-switch — that package is not a dependency here, and a switch
// is one of the few controls the native semantics cover completely.
//
// Two hand-rolled copies of exactly this existed (the field-capture anonymity
// toggle and the feature-flags grid), each with its own track size and its own
// thumb offsets.
export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "default" | "lg";
  /** Track colour when on. The field wizard's toggle is gold, not violet. */
  activeClassName?: string;
}

const TRACK = {
  default: "h-6 w-11",
  lg: "h-8 w-14"
} as const;

const THUMB = {
  default: "h-4 w-4 top-1 left-1 data-[state=checked]:left-auto data-[state=checked]:right-1",
  lg: "h-6 w-6 top-1 left-1 data-[state=checked]:left-auto data-[state=checked]:right-1"
} as const;

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, size = "default", className, activeClassName, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        TRACK[size],
        checked ? activeClassName ?? "bg-primary-600" : "bg-slate-200",
        className
      )}
      {...props}
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className={cn("absolute rounded-full bg-white shadow transition-all", THUMB[size])}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch };
