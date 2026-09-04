"use client";

/**
 * shadcn-style multi-select: a Popover over a cmdk Command list, with the
 * chosen options listed underneath as removable Badges. Built from the
 * Popover, Command, Button and Badge primitives already in this design system
 * rather than a new dependency.
 *
 * The chips sit below the trigger rather than inside it. Inside, each chip's
 * remove control would be an interactive element nested in the trigger button
 * — invalid HTML, and something a screen reader cannot present sensibly — so
 * it would have to be faked with a `role="button"` span that swallows the
 * click. Below the trigger they are real Buttons, and the layout matches
 * WorkerInvolvedPicker, the other add-many control these forms use.
 *
 * Kept generic — options are `{ value, label }`, selection is a string array —
 * so it reads the same wherever a form needs "tick any number of these".
 */

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className={cn("truncate", value.length === 0 && "text-slate-500")}>
              {value.length === 0
                ? placeholder
                : `${value.length} selected`}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const selected = value.includes(o.value);
                  return (
                    <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
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

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge
              key={v}
              className="border-slate-200 bg-slate-100 py-1 pl-2.5 pr-1 font-normal text-slate-700"
            >
              {labelOf.get(v) ?? v}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove ${labelOf.get(v) ?? v}`}
                onClick={() => toggle(v)}
                className="h-5 w-5 rounded-full p-0 hover:bg-white"
              >
                <X size={11} />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
