import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { MyCheckpointsView } from "./my-checkpoints-view";
import type { MyCheckpointsResponse } from "../lib";

export const dynamic = "force-dynamic";

const EMPTY: MyCheckpointsResponse = { audits: [], totals: { total: 0, needsResponse: 0, audits: 0 } };

export default async function MyCheckpointsPage() {
  const data = await backendFetch<MyCheckpointsResponse>("/api/audit-compliance/my-checkpoints").catch(() => EMPTY);
  return (
    <div>
      <PageHeader
        title="My Assigned Checkpoints"
        breadcrumbs={[{ label: "Audit & Compliance", href: "/cams/audits" }, { label: "My checkpoints" }]}
      />
      <MyCheckpointsView data={data} />
    </div>
  );
}
