"use client";

// ──────────────────────────────────────────────────────────────────────
// SelectField — the shadcn/Radix select, with a plain `options` API.
//
// `components/ui/select.tsx` is a styled native `<select>`. It is fine for a
// short enum on a dense screen, and ~110 files use it, so it stays. It is the
// wrong control for a form field with a long list — a 36-entry state list, say
// — for the reasons a native dropdown always fails at that size: the popup is
// an OS menu the page cannot position, so it opens off-screen; `<option>`
// cannot be styled, so it ignores the design system entirely; and there is no
// type-ahead beyond the browser's own first-letter matching.
//
// This is shadcn's Select (Radix `@radix-ui/react-select`, already a
// dependency) wrapped so a caller passes `options` instead of composing five
// primitives by hand. Radix handles portalling, collision flipping, keyboard
// navigation and type-ahead.
// ──────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** A titled run of options — the `<optgroup>` the native selects used. */
export type SelectGroup = {
  label: string;
  options: SelectOption[];
};

export type SelectOption = {
  /** Always a string — that is what a listbox holds, whatever the caller stores. */
  value: string;
  /** Numbers allowed: the 1-5 scoring scales label their options with the score. */
  label: string | number;
  disabled?: boolean;
  /** Optional second line, e.g. a code or a hint. */
  hint?: string;
};

export function SelectField({
  value, onChange, defaultValue, options, groups, placeholder = "— select —", disabled, invalid, className, style, id, ariaLabel,
  name, required,
}: {
  /** Controlled value. Omit it (with `defaultValue`) to run uncontrolled. */
  value?: string;
  onChange?: (value: string) => void;
  /**
   * Uncontrolled starting value, for the register filter bars: those are plain
   * `<form method="get">`s rendered on the server with no state of their own,
   * so the control has to hold its own value and hand it to the form through
   * the hidden input `name` emits.
   */
  defaultValue?: string;
  options?: SelectOption[];
  /**
   * Grouped options, for the pickers that were built on <optgroup> — the EAI
   * aspect library is grouped by category, and flattening it would lose the
   * only thing that makes a 60-entry list navigable.
   */
  groups?: SelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /**
   * Inline style for the trigger. The Fire Safety screens carry their palette
   * (Midnight Executive) as inline colours rather than Tailwind classes, so
   * without this they would lose their border and text colour on conversion.
   */
  style?: React.CSSProperties;
  id?: string;
  ariaLabel?: string;
  /**
   * Form field name. The forms build their payload with `new FormData(form)`,
   * and a Radix listbox contributes nothing to that, so the value is mirrored
   * into a hidden input. Deliberately NOT Radix's own `name` prop: that emits
   * an aria-hidden native <select>, and marking it `required` makes Chrome try
   * to focus an invisible control ("not focusable") on submit.
   */
  name?: string;
  /** Advisory only — announced to AT. Enforce the rule in the submit handler. */
  required?: boolean;
}) {
  // Uncontrolled mode: hold the value here so the hidden input the form reads
  // stays in step with what the listbox shows.
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  function handleChange(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function renderItem(o: SelectOption) {
    return (
      <RSelect.Item
        key={o.value} value={o.value} disabled={o.disabled}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 outline-none",
          "data-[highlighted]:bg-slate-100 data-[state=checked]:font-medium data-[state=checked]:text-primary-800",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        )}
      >
        <RSelect.ItemIndicator asChild>
          <Check size={13} className="shrink-0 text-primary-600" />
        </RSelect.ItemIndicator>
        <span className="min-w-0 flex-1">
          <RSelect.ItemText>{o.label}</RSelect.ItemText>
          {o.hint && <span className="block truncate text-[10px] text-slate-400">{o.hint}</span>}
        </span>
      </RSelect.Item>
    );
  }

  return (
    <RSelect.Root value={current || undefined} onValueChange={handleChange} disabled={disabled}>
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
      <RSelect.Trigger
        id={id}
        style={style}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm",
          // A long option or placeholder must ellipsize, not wrap and burst the
          // 40px trigger — "— Select a category observable as an unsafe act —"
          // is a real label here.
          "overflow-hidden text-left [&>span:first-child]:min-w-0 [&>span:first-child]:truncate",
          "focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[placeholder]:text-slate-400",
          invalid ? "border-red-400" : "border-slate-300",
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon asChild>
          <ChevronDown size={15} className="shrink-0 opacity-60" />
        </RSelect.Icon>
      </RSelect.Trigger>

      <RSelect.Portal>
        <RSelect.Content
          position="popper" sideOffset={4} collisionPadding={12}
          // Height is bounded by what the viewport actually has, so a long list
          // scrolls inside itself rather than running past the screen edge.
          className="z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[10rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <RSelect.ScrollUpButton className="flex h-6 items-center justify-center bg-white text-slate-400">
            <ChevronUp size={14} />
          </RSelect.ScrollUpButton>
          <RSelect.Viewport className="p-1">
            {(options ?? []).map(renderItem)}
            {(groups ?? []).map((g) => (
              <RSelect.Group key={g.label}>
                <RSelect.Label className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.label}
                </RSelect.Label>
                {g.options.map(renderItem)}
              </RSelect.Group>
            ))}
          </RSelect.Viewport>
          <RSelect.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-slate-400">
            <ChevronDown size={14} />
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
