import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { FlraTable, type FlraRow } from "./flra-table";

export const dynamic = "force-dynamic";

// The register rows come from FastAPI, which applies FLRA.READ plant scope and
// joins the display names (plant / leader / permit number) server-side.
interface FlraListItem {
  id: string;
  number: string;
  date: string;
  jobDescription: string;
  permitId: string | null;
  plantName: string;
  leaderName: string;
  permitNumber: string | null;
}

export default async function FLRAPage() {
  const { items } = await backendFetch<{ items: FlraListItem[] }>("/api/flra");

  const rows: FlraRow[] = items.map((f) => ({
    id: f.id,
    number: f.number,
    date: f.date,
    plantName: f.plantName.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
    jobDescription: f.jobDescription,
    leaderName: f.leaderName,
    permitId: f.permitId,
    permitNumber: f.permitNumber
  }));

  return (
    <div>
      <PageHeader
        title="Field Level Risk Assessment (FLRA)"
        description="Pre-task hazard analysis performed by the work crew at the work location"
        action={
          <Can permission="FLRA.CREATE">
            <Button asChild>
              <Link href="/flra/new">
                <Plus size={16} /> New FLRA
              </Link>
            </Button>
          </Can>
        }
      />

      <FlraTable data={rows} />
    </div>
  );
}
