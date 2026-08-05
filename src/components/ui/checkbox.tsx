import * as React from "react";
import { cn } from "@/lib/utils";

// Native-checkbox wrapper matching the house Input/Select style (no Radix
// dependency). Drop-in replacement for a raw <input type="checkbox">: it
// forwards `checked`, `onChange`, `disabled`, etc. unchanged.
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "h-4 w-4 rounded border-slate-300 text-primary-700 accent-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
