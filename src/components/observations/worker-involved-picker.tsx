"use client";

/**
 * Worker Involved — hand-typed name + works ID, one row per person.
 *
 * This was a searchable picker over both people populations (`User`, the
 * employee directory, and `ContractorWorker`, the EPC workforce, unioned by
 * `/api/workforce/search`). The directory search was removed on request: on the
 * shop floor the observer knows the name and the number on the helmet, and
 * making them find that person in a directory first was the step that got
 * skipped. So every entry this component produces is a `MANUAL` row.
 *
 * What that costs, stated plainly because it is not obvious from the UI: a
 * MANUAL row links to no personnel record, so the deroster soft-lock cannot
 * fire from it (`rosterStatus` lives on the User / ContractorWorker row) and
 * the Training & Competency engine cannot assign to it
 * (`TrainingAssignment.personUserId` is a User). A High/Critical Unsafe Act
 * naming only hand-typed workers therefore records who was involved and opens
 * no safety review. `codeSnapshot` is the handle for reconciling those names
 * against the directory later.
 *
 * `WorkerRef` keeps the linked party types: stored observations still carry
 * USER / CONTRACTOR_WORKER rows from before this change, and the submit payload
 * is still shaped by party type.
 */

import * as React from "react";
import { Plus, X, HardHat, UserRound, UserPlus } from "lucide-react";
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

function keyOf(w: Pick<WorkerRef, "partyType" | "id">) {
  return `${w.partyType}:${w.id}`;
}

export function WorkerInvolvedPicker({
  value,
  onChange,
  contractorCompanyName,
  required,
  disabled,
  invalid,
}: {
  value: WorkerRef[];
  onChange: (next: WorkerRef[]) => void;
  /** Stamped onto each entry as its employer when the observation is already
   *  attributed to a contractor — the observer has said who employs this
   *  person by picking the company, so don't ask again. */
  contractorCompanyName?: string | null;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");

  function add() {
    const n = name.trim();
    const c = code.trim();
    if (n.length < MIN_MANUAL_NAME) {
      setError(`Enter the person's name (${MIN_MANUAL_NAME} characters minimum).`);
      return;
    }
    // Match on the works ID when one was given — two people genuinely share a
    // name, and the ID is what a later reconciliation against the directory
    // would key on.
    const duplicate = value.some((v) =>
      c
        ? (v.code ?? "").toLowerCase() === c.toLowerCase()
        : v.name.trim().toLowerCase() === n.toLowerCase()
    );
    if (duplicate) {
      setError("That person is already named on this observation.");
      return;
    }
    onChange([
      ...value,
      {
        partyType: "MANUAL",
        id: `manual:${crypto.randomUUID()}`,
        name: n,
        code: c || null,
        employer: contractorCompanyName || null,
      },
    ]);
    setName("");
    setCode("");
    setError("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter inside a form submits it. Here it means "add this person".
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "rounded-md border bg-muted/30 p-2",
          invalid ? "border-destructive" : "border-input"
        )}
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <UserPlus className="h-3.5 w-3.5" />
          Name and ID of the worker or employee
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
          <input
            value={name}
            disabled={disabled}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={onKeyDown}
            placeholder="Full name"
            aria-label="Name of the worker or employee"
            aria-invalid={invalid || undefined}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <input
            value={code}
            disabled={disabled}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            onKeyDown={onKeyDown}
            placeholder="Employee / worker ID"
            aria-label="Employee or worker ID"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={add}
            disabled={disabled}
            aria-label="Add this worker"
            title="Add this worker"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
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
