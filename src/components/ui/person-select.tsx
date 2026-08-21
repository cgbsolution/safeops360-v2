"use client";

// ──────────────────────────────────────────────────────────────────────
// PersonSelect — pick a person from a list the CALLER supplies.
//
// The portal already had `UserPicker`, and most person fields use it. It
// fetches its own directory from a filter spec, which is right when the field
// means "anybody at this plant who holds X" — and wrong whenever the eligible
// set is already computed and narrower than any filter can express: the audit
// team seated on one engagement, the users returned by /assignable-users, the
// owners a report may be routed to. Those fields fell back to a native
// `<select>`, which has three problems that get worse as the list grows:
//
//   • the popup is an OS menu positioned by the platform, so a long list runs
//     off the bottom of the screen and nothing on the page can constrain it;
//   • `<option>` holds text and nothing else, so the role, the department and
//     any warning state — the things you need in order to pick correctly —
//     cannot be shown;
//   • it ignores the app's styling entirely.
//
// This is the same Radix Popover treatment `UserPicker` gets, over an explicit
// list. Groups are supported because a long list is far more usable when the
// likely answers are gathered under a heading rather than sorted somewhere
// into the middle.
// ──────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sentinel for the clear row.
 *
 *  Not `""`: that is "nothing picked yet", and a caller that stages edits
 *  before saving has to tell the two apart — "leave this alone" and "clear
 *  this" are different instructions to send to a server. */
export const PERSON_CLEAR = "__clear__";

export type PersonOption = {
  id: string;
  name: string;
  role?: string | null;
  department?: string | null;
  /** Short chip rendered after the name, e.g. "Lead". */
  badge?: string;
  /** When set, an amber warning icon with this as its label. */
  warn?: string;
};

export type PersonGroup = { label: string; members: PersonOption[] };

export function PersonSelect({
  value, groups, placeholder, clearLabel, emptyText, disabled, invalid, className, onPick,
}: {
  value: string;
  groups: PersonGroup[];
  placeholder: string;
  /** Omit to hide the clear row — use for a required field, or where a named
   *  option already expresses the same outcome. */
  clearLabel?: string;
  emptyText: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const all = groups.flatMap((g) => g.members);
  const current = all.find((m) => m.id === value);
  const label = value === PERSON_CLEAR ? (clearLabel ?? placeholder) : current?.name ?? placeholder;
  const chosen = value !== "";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button" disabled={disabled} aria-invalid={invalid || undefined}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-1 rounded-md border px-2.5 text-sm transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid ? "border-red-400"
              : chosen ? "border-primary-300 bg-primary-50 font-medium text-primary-800"
                : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50",
            className,
          )}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown size={14} className="shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start" sideOffset={4} collisionPadding={12}
          // Capped against the viewport rather than a fixed height, so a long
          // list scrolls inside itself instead of running past the screen edge.
          className="z-50 max-h-[min(20rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-[14rem] overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          {all.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] leading-relaxed text-slate-400">{emptyText}</p>
          ) : (
            groups.map((g, gi) => (
              <div key={g.label || gi}>
                {g.label && (
                  <p className={cn(
                    "px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400",
                    gi > 0 && "mt-1 border-t border-slate-100 pt-2",
                  )}>
                    {g.label}
                  </p>
                )}
                {g.members.map((m) => (
                  <button
                    key={m.id} type="button"
                    onClick={() => { onPick(m.id); setOpen(false); }}
                    className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-100"
                  >
                    <Check size={13} className={cn("mt-0.5 shrink-0", m.id === value ? "text-primary-600" : "invisible")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-slate-800">{m.name}</span>
                        {m.badge && (
                          <span className="shrink-0 rounded bg-primary-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary-700">
                            {m.badge}
                          </span>
                        )}
                        {m.warn && (
                          <AlertTriangle size={11} className="shrink-0 text-amber-500" aria-label={m.warn} />
                        )}
                      </span>
                      <span className="block truncate text-[10px] uppercase tracking-wide text-slate-400">
                        {[m.role, m.department].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
          {clearLabel && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { onPick(PERSON_CLEAR); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-100"
              >
                <Check size={13} className={cn("shrink-0", value === PERSON_CLEAR ? "text-primary-600" : "invisible")} />
                {clearLabel}
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
