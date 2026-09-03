"use client";

/**
 * Worker Involved — multi-select searchable picker over BOTH people
 * populations.
 *
 * This platform has no single workforce master: `User` is the employee
 * directory, `ContractorWorker` is the EPC workforce, and there is no FK
 * between them. `/api/workforce/search` unions them and tags each row with a
 * `partyType`, which is what the form submits alongside the id — the server
 * needs to know which table to resolve against.
 *
 * The picker deliberately shows workers who are already under a safety hold
 * (`includeInactive=true`). A held worker can still be named on a NEW
 * observation about something they did; the hold is on assigning them work,
 * not on reporting about them.
 *
 * Manual entry is the third path. Plenty of people on site are in neither
 * table on the day something is observed — an agency hand on their first
 * shift, a visiting vendor engineer, a delivery driver. Making the observer
 * abandon the report and go get someone onboarded loses the observation, so a
 * typed name + works ID is accepted as a `MANUAL` row. It records the person
 * but links to nothing, and the server will not open a safety review against
 * it: there is no roster row to soft-lock.
 */

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Loader2, Plus, Search, X, HardHat, UserRound, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Matches MIN_MANUAL_NAME in schemas/observation_sla.py. */
const MIN_MANUAL_NAME = 2;

export type WorkerRef = {
  partyType: "USER" | "CONTRACTOR_WORKER" | "MANUAL";
  /** Directory row id, or a synthetic client-only key on a MANUAL entry —
   *  nothing is submitted for a MANUAL row but its name, code and employer. */
  id: string;
  name: string;
  role?: string | null;
  employer?: string | null;
  code?: string | null;
  rosterStatus?: string;
};

const ROSTER_LABELS: Record<string, string> = {
  pending_safety_review: "Under safety review",
  derostered: "Derostered",
};

function keyOf(w: Pick<WorkerRef, "partyType" | "id">) {
  return `${w.partyType}:${w.id}`;
}

export function WorkerInvolvedPicker({
  value,
  onChange,
  plantId,
  contractorCompanyId,
  contractorCompanyName,
  required,
  disabled,
  invalid,
}: {
  value: WorkerRef[];
  onChange: (next: WorkerRef[]) => void;
  plantId?: string;
  contractorCompanyId?: string | null;
  /** Stamped onto a manual entry as its employer when the observation is
   *  already attributed to a contractor — the observer has said who employs
   *  this person by picking the company, so don't ask again. */
  contractorCompanyName?: string | null;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [rows, setRows] = React.useState<WorkerRef[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [manualName, setManualName] = React.useState("");
  const [manualCode, setManualCode] = React.useState("");
  const [manualError, setManualError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (plantId) params.set("plantId", plantId);
    if (contractorCompanyId) params.set("contractorCompanyId", contractorCompanyId);
    if (term.trim()) params.set("query", term.trim());
    params.set("includeInactive", "true");

    // Debounced so typing doesn't fire a request per keystroke.
    const t = setTimeout(() => {
      fetch(`/api/workforce/search?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (alive && Array.isArray(data)) setRows(data);
        })
        .catch(() => {
          if (alive) setRows([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, term, plantId, contractorCompanyId]);

  const selectedKeys = new Set(value.map(keyOf));

  function toggle(w: WorkerRef) {
    if (selectedKeys.has(keyOf(w))) {
      onChange(value.filter((v) => keyOf(v) !== keyOf(w)));
    } else {
      onChange([...value, w]);
    }
  }

  function addManual() {
    const name = manualName.trim();
    const code = manualCode.trim();
    if (name.length < MIN_MANUAL_NAME) {
      setManualError(`Enter the person's name (${MIN_MANUAL_NAME} characters minimum).`);
      return;
    }
    // Match on the works ID when one was given — two people genuinely share a
    // name, and the ID is what a later reconciliation against the directory
    // would key on. Also catches typing in someone who was already picked from
    // the list, which is otherwise invisible: different party type, same person.
    const duplicate = value.some((v) =>
      code
        ? (v.code ?? "").toLowerCase() === code.toLowerCase()
        : v.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setManualError("That person is already named on this observation.");
      return;
    }
    onChange([
      ...value,
      {
        partyType: "MANUAL",
        id: `manual:${crypto.randomUUID()}`,
        name,
        code: code || null,
        employer: contractorCompanyName || null,
      },
    ]);
    setManualName("");
    setManualCode("");
    setManualError("");
  }

  function onManualKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter inside a form submits it. Here it means "add this person".
    if (e.key === "Enter") {
      e.preventDefault();
      addManual();
    }
  }

  return (
    <div className="space-y-2">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            aria-invalid={invalid || undefined}
            className={cn(
              "flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              invalid ? "border-destructive" : "border-input"
            )}
          >
            <span className={cn(value.length === 0 && "text-muted-foreground")}>
              {value.length === 0
                ? "Search by name, code or trade…"
                : `${value.length} worker${value.length > 1 ? "s" : ""} named`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-input bg-popover p-0 shadow-md"
          >
            <div className="flex items-center gap-2 border-b border-input px-3 py-2">
              <Search className="h-4 w-4 shrink-0 opacity-50" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search employees and contractor workers…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />}
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {rows.length === 0 && !loading && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {term ? "No matching worker." : "Start typing to search."}
                </p>
              )}
              {rows.map((w) => {
                const selected = selectedKeys.has(keyOf(w));
                const held = w.rosterStatus && w.rosterStatus !== "active";
                return (
                  <button
                    key={keyOf(w)}
                    type="button"
                    onClick={() => toggle(w)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                      selected && "bg-accent/60"
                    )}
                  >
                    {w.partyType === "USER" ? (
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                    ) : (
                      <HardHat className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{w.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[w.role, w.employer, w.code].filter(Boolean).join(" · ") ||
                          "Role & employer not set on profile"}
                      </span>
                      {held && (
                        <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          {ROSTER_LABELS[w.rosterStatus!] ?? w.rosterStatus}
                        </span>
                      )}
                    </span>
                    {selected && <span className="mt-0.5 text-xs font-medium text-primary">Added</span>}
                  </button>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Manual entry — for someone in neither directory. Always visible
          rather than hidden behind a disclosure: an observer standing in front
          of an agency hand who isn't in the list needs to see the way forward,
          not go looking for it. */}
      <div className="rounded-md border border-dashed border-input bg-muted/30 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" />
          Not in the list? Add them by hand
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
          <input
            value={manualName}
            disabled={disabled}
            onChange={(e) => {
              setManualName(e.target.value);
              setManualError("");
            }}
            onKeyDown={onManualKeyDown}
            placeholder="Full name"
            aria-label="Name of the worker or employee"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <input
            value={manualCode}
            disabled={disabled}
            onChange={(e) => {
              setManualCode(e.target.value);
              setManualError("");
            }}
            onKeyDown={onManualKeyDown}
            placeholder="Employee / worker ID"
            aria-label="Employee or worker ID"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addManual}
            disabled={disabled}
            aria-label="Add this worker"
            title="Add this worker"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {manualError ? (
          <p className="mt-1.5 text-xs text-destructive">{manualError}</p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            A hand-typed name is recorded on this observation but is not linked to a
            personnel record, so it starts no safety review.
          </p>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((w) => (
            <li
              key={keyOf(w)}
              className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted/50 py-1 pl-2.5 pr-1 text-xs"
            >
              {w.partyType === "USER" ? (
                <UserRound className="h-3 w-3 opacity-60" />
              ) : w.partyType === "MANUAL" ? (
                <UserPlus className="h-3 w-3 opacity-60" />
              ) : (
                <HardHat className="h-3 w-3 opacity-60" />
              )}
              <span className="font-medium">{w.name}</span>
              {w.code && <span className="text-muted-foreground">· {w.code}</span>}
              {w.employer && <span className="text-muted-foreground">· {w.employer}</span>}
              {w.partyType === "MANUAL" && (
                <span className="rounded bg-slate-200 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-700">
                  Manual
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${w.name}`}
                onClick={() => onChange(value.filter((v) => keyOf(v) !== keyOf(w)))}
                className="rounded-full p-0.5 hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {required && value.length === 0 && (
        <p className="text-xs text-destructive">
          At least one worker must be named for a High or Critical severity Unsafe Act.
        </p>
      )}
    </div>
  );
}
