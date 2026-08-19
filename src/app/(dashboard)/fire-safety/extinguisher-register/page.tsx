// Consolidated into /fire-safety/register.
//
// This screen and /fire-safety/equipment were two add/edit paths onto the same
// FireEquipment table — for an extinguisher, each wrote a different subset of the
// same row and neither knew about the other. The controlled sixteen-column view
// now lives as a tab on the single register screen.
//
// Redirect rather than delete: the route was linked from the fire dashboard, the
// FE Inspection screen and the register PDF footer, and a 404 on a bookmarked
// statutory register is worse than an extra hop. register-table.tsx and
// register-dialog.tsx stay here and are imported by the new screen.

import { redirect } from "next/navigation";

export default function ExtinguisherRegisterRedirect() {
  redirect("/fire-safety/register");
}
