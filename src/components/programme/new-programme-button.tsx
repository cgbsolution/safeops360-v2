"use client";

// The action that was missing. `page.tsx` imported `Plus` and never rendered a
// button, so the create/cycle/scope endpoints had no caller anywhere in the UI
// and the whole feature was unreachable from the nav.

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/components/auth/can";
import {
  ProgrammeWizard, type WizardLibrary, type WizardSite,
} from "@/components/programme/programme-wizard";

export function NewProgrammeButton({
  sites, libraries,
}: {
  sites: WizardSite[];
  libraries: WizardLibrary[];
}) {
  const [open, setOpen] = useState(false);
  // CAMS.SCHEDULE is what the create endpoints require; hiding it from users
  // who would only get a 403 is the same rule, rendered.
  const canSchedule = usePermission("CAMS.SCHEDULE");
  if (!canSchedule) return null;

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} /> New programme
      </Button>
      {open && (
        <ProgrammeWizard sites={sites} libraries={libraries} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
