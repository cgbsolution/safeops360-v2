"use client";

/**
 * shadcn-style multi-select: a Popover over a cmdk Command list, with the
 * chosen options shown as removable chips on the trigger. Built from the
 * Popover and Command primitives already in this design system rather than a
 * new dependency.
 *
 * Kept generic — options are `{ value, label }`, selection is a string array —
 * so it reads the same wherever a form needs "tick any number of these".
 */

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "— Select —",
  searchPlaceholder = "Search…",
  emptyText = "No match.",
  disabled,
  className,
  id
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const labelOf = React.useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options]
  );

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          {value.length === 0 ? (
            <span className="text-slate-500">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {value.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full border bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {labelOf.get(v) ?? v}
                  {/* A nested <button> is invalid inside the trigger button, so
                      this is a span that stops the click from opening the list. */}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${labelOf.get(v) ?? v}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }}
                    className="rounded-full p-0.5 hover:bg-slate-200"
                  >
                    <X size={11} />
                  </span>
                </span>
              ))}
            </span>
          )}
          <ChevronsUpDown size={14} className="shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const selected = value.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                  >
                    <span
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                        selected
                          ? "border-primary-700 bg-primary-700 text-white"
                          : "border-slate-300"
                      )}
                    >
                      {selected && <Check size={11} />}
                    </span>
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
