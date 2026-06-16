import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { ObligationDetail } from "../../lib-p2";
import { ObligationDetailView } from "./detail-view";

export const dynamic = "force-dynamic";

export default async function ObligationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let obligation: ObligationDetail | null = null;
  let error: string | null = null;
  try {
    obligation = await backendFetch<ObligationDetail>(`/api/erm/compliance/obligations/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load obligation";
  }

  return (
    <div>
      <PageHeader
        title={obligation ? obligation.title : "Obligation"}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Compliance", href: "/erm/compliance" },
          { label: "Register", href: "/erm/compliance/register" },
          { label: obligation?.obligationCode ?? id },
        ]}
      />
      {error || !obligation ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Obligation not found."}{" "}
          <Link href="/erm/compliance/register" className="font-medium underline">
            Back to register
          </Link>
        </div>
      ) : (
        <ObligationDetailView obligation={obligation} />
      )}
    </div>
  );
}
