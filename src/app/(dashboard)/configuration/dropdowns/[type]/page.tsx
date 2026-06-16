import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";
import { requirePermission } from "@/lib/auth/server";
import { getMasterTypeMeta } from "@/lib/masters/registry";
import { DropdownEditor } from "../dropdown-editor";

export const dynamic = "force-dynamic";

export default async function DropdownTypePage(props: { params: Promise<{ type: string }> }) {
  await requirePermission("CONFIGURATION.MASTERS");
  const params = await props.params;
  const type = decodeURIComponent(params.type);

  const items = await prisma.masterItem.findMany({
    where: { type },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
  });

  if (items.length === 0) {
    // Allow viewing of brand-new types created via NewDropdownTypeButton
    // even before a placeholder is added.
  }

  const meta = getMasterTypeMeta(type);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={meta?.label ?? type}
        description={meta?.description ?? "Custom dropdown — admin-defined values."}
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Dropdowns", href: "/configuration/dropdowns" },
          { label: meta?.label ?? type }
        ]}
        action={
          <Badge className="bg-slate-100 text-slate-700 font-mono">
            type: {type}
          </Badge>
        }
      />

      {meta?.consumedIn && meta.consumedIn.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-3 text-sm flex items-center gap-2 flex-wrap">
            <ListChecks size={14} className="text-slate-500" />
            <span className="text-slate-500">Consumed by:</span>
            {meta.consumedIn.map((c) => (
              <Badge key={c} className="bg-blue-50 text-blue-700 border-blue-200">
                {c}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <DropdownEditor
        type={type}
        initialItems={items.map((i) => ({
          id: i.id,
          code: i.code,
          label: i.label,
          sortOrder: i.sortOrder,
          active: i.active,
          metadata: i.metadata
        }))}
      />
    </div>
  );
}
