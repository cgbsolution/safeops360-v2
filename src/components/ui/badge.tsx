import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The tone set the registers actually use. Before this the component carried no
// colour at all and all ~290 call sites hand-passed the same six palettes as
// className, so the same status rendered three different shades depending on the
// screen. Callers that still pass colours via className keep working — cn()
// merges last-wins — which is what lets the modules migrate one at a time.
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 font-semibold leading-none tracking-wide transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-slate-200 bg-slate-100 text-slate-700",
        outline: "border-slate-300 bg-white text-slate-700",
        brand: "border-primary-200 bg-primary-50 text-primary-700",
        info: "border-blue-200 bg-blue-50 text-blue-700",
        success: "border-emerald-200 bg-emerald-100 text-emerald-700",
        warning: "border-amber-200 bg-amber-100 text-amber-800",
        danger: "border-rose-200 bg-rose-100 text-rose-700",
        critical: "border-rose-300 bg-rose-600 text-white",
        violet: "border-violet-200 bg-violet-100 text-violet-800"
      },
      size: {
        default: "text-[11px]",
        sm: "px-2 py-0.5 text-[10px]",
        /** The uppercase panel-corner label ("Bottleneck", "Root cause", "Data quality"). */
        eyebrow: "border-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      }
    },
    defaultVariants: { variant: "neutral", size: "default" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
