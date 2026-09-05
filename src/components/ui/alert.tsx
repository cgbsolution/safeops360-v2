import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Server-safe by design (no "use client"): the banner this replaces is most
// often rendered from an RSC page — the access-scope notice on a register, the
// "no licence found" gate, a workflow blocker — so it must not drag a client
// boundary along with it.
const alertVariants = cva(
  "relative w-full rounded-md border px-3 py-2 text-xs [&>svg]:size-4 [&>svg]:shrink-0 [&:has(svg)]:grid [&:has(svg)]:grid-cols-[auto_1fr] [&:has(svg)]:items-start [&:has(svg)]:gap-x-2",
  {
    variants: {
      variant: {
        info: "border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600",
        warning: "border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600",
        destructive: "border-rose-200 bg-rose-50 text-rose-800 [&>svg]:text-rose-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600",
        muted: "border-slate-200 bg-slate-50 text-slate-700 [&>svg]:text-slate-500",
        // The violet brand accent, used by the AI / guidance panels.
        brand: "border-violet-200 bg-violet-50 text-violet-900 [&>svg]:text-violet-600"
      },
      size: {
        // The dense default matches the inline notice the app already uses.
        default: "px-3 py-2 text-xs",
        lg: "px-4 py-3 text-sm"
      }
    },
    defaultVariants: { variant: "info", size: "default" }
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props} />
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("font-semibold leading-tight tracking-tight", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("[&_p]:leading-relaxed", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
