import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { FlraTable, type FlraRow } from "./flra-table";

export const dynamic = "force-dynamic";

export default async function FLRAPage() {
  const items = await prisma.fLRA.findMany({
    select: {
      id: true,
      number: true,
      date: true,
      jobDescription: true,
      plant: { select: { name: true } },
      leader: { select: { name: true } },
      permit: { select: { id: true, number: true } }
    },
    orderBy: { date: "desc" },
    take: 100
  });

  const rows: FlraRow[] = items.map((f) => ({
    id: f.id,
    number: f.number,
    date: f.date.toISOString(),
    plantName: f.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
    jobDescription: f.jobDescription,
    leaderName: f.leader.name,
    permitId: f.permit?.id ?? null,
    permitNumber: f.permit?.number ?? null
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
