"use client";

// shadcn/ui Calendar — react-day-picker v9 styled with the house palette.
//
// v9 renamed the classNames keys from v8 (`day_selected` → the `selected`
// modifier, `head_cell` → `weekday`, and so on), so these are the v9 names.

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        // Caption left, nav parked top-right — so "September 2026" never sits
        // under the two arrow buttons.
        month_caption: "flex justify-start pt-1 pl-1 relative items-center h-7",
        caption_label: "text-sm font-medium text-slate-900",
        nav: "flex items-center gap-1 absolute right-3 top-3 z-10",
        month_grid: "w-full border-collapse",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        weekdays: "flex",
        weekday: "text-slate-500 rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-primary-50 [&:has([aria-selected])]:rounded-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "[&>button]:!bg-primary-700 [&>button]:!text-white [&>button]:hover:!bg-primary-800 [&>button]:focus:!bg-primary-800",
        today: "[&>button]:bg-slate-100 [&>button]:font-semibold [&>button]:text-slate-900",
        outside: "[&>button]:text-slate-400 [&>button]:opacity-50",
        disabled: "[&>button]:text-slate-400 [&>button]:opacity-40",
        range_middle: "[&>button]:bg-primary-50 [&>button]:text-slate-900",
        hidden: "invisible",
        ...classNames
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" {...rest} /> : <ChevronRight className="h-4 w-4" {...rest} />
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
