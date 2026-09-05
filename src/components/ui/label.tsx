"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// `eyebrow` is the small uppercase field caption the registers use above a
// value or an input. 89 files spelled it out as
// `text-[10px] font-semibold uppercase tracking-wider`, and four of them had
// hoisted it into a local `LABEL` constant paired with a local `FIELD` — a
// private mini design system that drifted from the real one (10px vs 11px,
// with and without a colour). One variant instead.
const labelVariants = cva("leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", {
  variants: {
    variant: {
      default: "text-sm font-medium text-slate-700",
      eyebrow: "block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
    }
  },
  defaultVariants: { variant: "default" }
});

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, variant, ...props }, ref) => (
    <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ variant }), className)} {...props} />
  )
);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label, labelVariants };
