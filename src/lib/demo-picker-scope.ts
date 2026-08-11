// Which accounts the login page's demo picker may reveal.
//
// The picker endpoints answer BEFORE anyone has signed in, so this list is the
// whole boundary between a demo convenience and a public directory of real
// staff. Two sources, both explicit:
//
//   1. NAMED_ALL_PLANT_USERS — the named accounts the seed creates outside the
//      {role}.{dept}.{plant} matrix. They are seeded with the demo password and
//      are meant to be picked, so they belong here by construction.
//   2. DEMO_SEARCH_EXTRA_EMAILS — a comma-separated env list for anything else,
//      added one address at a time. The backend reads the same variable name.
//
// A whole-domain rule is deliberately NOT offered: "@ourcompany.com" would let
// anyone at the login screen enumerate every employee who has ever been seeded.

import { NAMED_ALL_PLANT_USERS } from "../../prisma/demo-users-config";

export function demoPickerExtraEmails(): string[] {
  const fromEnv = (process.env.DEMO_SEARCH_EXTRA_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const named = NAMED_ALL_PLANT_USERS.map((u) => u.email.toLowerCase());
  return [...new Set([...named, ...fromEnv])];
}

/** Is this address one the picker is allowed to resolve a name for? */
export function isDemoPickable(email: string): boolean {
  const e = (email || "").trim().toLowerCase();
  return e.endsWith("@safeops360.in") || demoPickerExtraEmails().includes(e);
}
