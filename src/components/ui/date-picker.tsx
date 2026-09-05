"use client";

// ──────────────────────────────────────────────────────────────────────
// DatePicker — the shadcn date field (Popover + Calendar), shaped as a
// drop-in for the `<Input type="date">` / `<Input type="datetime-local">`
// controls the forms used to carry.
//
// Two things it deliberately keeps from the native input:
//
//   • `name` — the forms build their payload with `new FormData(form)`, and a
//     Radix popover contributes nothing to that. A hidden input carries the
//     value so every existing `payload.date` keeps working untouched.
//
//   • the wire format — `YYYY-MM-DD` for a date, `YYYY-MM-DDTHH:mm` for a
//     datetime, exactly what the native controls emitted.
//
// Dates are parsed and formatted as LOCAL calendar days, never through
// `new Date("2026-09-04")` — that parses as UTC midnight and renders as the
// 3rd for anyone east of Greenwich, which is the day-shift this system has
// been bitten by before.
// ──────────────────────────────────────────────────────────────────────

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

/** "2026-09-04" (or "2026-09-04T07:30") → a Date at local midnight / local time. */
function parseLocal(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
  if (!m) return undefined;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0
  );
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Date → "YYYY-MM-DD" using local parts, so the day never slides a timezone. */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DatePickerProps {
  /** Form field name. Emits a hidden input so `new FormData(form)` still sees the value. */
  name?: string;
  /** "YYYY-MM-DD", or "YYYY-MM-DDTHH:mm" when `withTime`. */
  value: string;
  onChange: (value: string) => void;
  /** Adds a time input beside the calendar and switches the wire format to datetime-local. */
  withTime?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  /** Inclusive bounds, same "YYYY-MM-DD" format. */
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
}

export function DatePicker({
  name,
  value,
  onChange,
  withTime = false,
  placeholder = withTime ? "Select date and time" : "Select a date",
  disabled,
  required,
  invalid,
  min,
  max,
  id,
  className,
  ariaLabel
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseLocal(value);
  const time = withTime ? (/T(\d{2}:\d{2})/.exec(value)?.[1] ?? "") : "";

  function commit(day: Date | undefined, nextTime = time) {
    if (!day) {
      onChange("");
      return;
    }
    const key = toDateKey(day);
    if (!withTime) {
      onChange(key);
      setOpen(false);
      return;
    }
    // Default a fresh datetime to 09:00 rather than midnight — a permit that
    // starts at 00:00 is almost never what the user meant to pick.
    onChange(`${key}T${nextTime || "09:00"}`);
  }

  const label = selected
    ? withTime
      ? format(selected, "dd MMM yyyy, HH:mm")
      : format(selected, "dd MMM yyyy")
    : placeholder;

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            className={cn(
              "h-10 w-full justify-start gap-2 px-3 font-normal",
              !selected && "text-slate-400",
              invalid && "border-red-400",
              className
            )}
          >
            <CalendarIcon size={15} className="shrink-0 opacity-60" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto">
          <Calendar
            mode="single"
            autoFocus
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => commit(day)}
            disabled={[
              ...(min ? [{ before: parseLocal(min)! }] : []),
              ...(max ? [{ after: parseLocal(max)! }] : [])
            ]}
          />
          {withTime && (
            <div className="flex items-center gap-2 border-t border-slate-200 p-3">
              <Label htmlFor={`${id ?? name ?? "dt"}-time`} className="text-xs text-slate-600">
                Time
              </Label>
              <Input
                id={`${id ?? name ?? "dt"}-time`}
                type="time"
                value={time}
                onChange={(e) => commit(selected ?? new Date(), e.target.value)}
                className="h-8 w-32 text-sm"
              />
              <Button type="button" size="sm" className="ml-auto h-8" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
