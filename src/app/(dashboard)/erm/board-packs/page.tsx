import Link from "next/link";
import { FileText } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { fmtDate, type BoardPack } from "@/app/(dashboard)/erm/lib";
import { NewPackButton } from "./new-pack-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PUBLISHED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default async function BoardPacksPage() {
  let packs: BoardPack[] = [];
  let error: string | null = null;
  try {
    packs = await backendFetch<BoardPack[]>("/api/erm/board-packs");
  } catch (e: any) {
    error = e?.message ?? "Failed to load board packs";
  }

  return (
    <div>
      <PageHeader
        title="Board Pack Generator"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Board Packs" }]}
        description="Generate board-grade quarterly risk packs — heat maps, top-10, movement, treatment status, escalations and acceptances — ready to print or save as PDF."
        action={<NewPackButton />}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM seed has been run and you are logged in with an ERM role.
        </Alert>
      ) : packs.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-none">
          <FileText size={32} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No board packs yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Create your first quarterly board pack. It snapshots the current enterprise risk position and
            renders a board-ready document you can edit, publish and print.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead className="px-4 py-3">Title</TableHead>
                <TableHead className="px-4 py-3">Quarter</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3">Generated</TableHead>
                <TableHead className="px-4 py-3">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.map((p) => {
                const cls = STATUS_CHIP[p.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
                return (
                  <TableRow key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/erm/board-packs/${p.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">{p.quarterLabel}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold " + cls
                        }
                      >
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{fmtDate(p.generatedAt)}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{fmtDate(p.publishedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
