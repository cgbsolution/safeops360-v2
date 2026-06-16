import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import { NewChangeForm } from "./new-change-form";

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
        description="Propose a change. After submission it is classified, impact-assessed, and routed for approval."
      />
      {plantId ? (
        <NewChangeForm plantId={plantId} />
      ) : (
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          No plant in context — open this from the MOC register with a plant selected.
        </div>
      )}
    </div>
  );
}
