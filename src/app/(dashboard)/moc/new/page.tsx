import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import { ChangeWizard } from "./change-wizard";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NewMocPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId } = await resolvePlantContext(searchParams.plantId);

  return (
    <div>
      <Link href="/moc" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2">
        <ArrowLeft size={14} /> Back to register
      </Link>
      <PageHeader
        title="Submit New Change"
        description="Identify → assess risk → gauge impact → route for approval — ISO 45001 §8.1.3"
      />
      {plantId ? (
        <ChangeWizard plantId={plantId} />
      ) : (
        <Card className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-none">
          No plant in context — open this from the MOC register with a plant selected.
        </Card>
      )}
    </div>
  );
}
