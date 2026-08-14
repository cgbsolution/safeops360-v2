import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { TrainingForm } from "../training-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Employee = { id: string; name: string; designation: string | null; department: string | null };

export default async function NewTrainingPage() {
  await requirePermission("TRAINING.CREATE");
  const [programsRes, usersRes] = await Promise.all([
    backendFetch<{ items: any[] }>("/api/training/programs").catch(() => ({ items: [] })),
    // The picker lists people to enrol. `take` is the endpoint's ceiling; the
    // control is searchable, so a larger roster is still reachable by typing.
    backendFetch<{ users: Employee[] }>("/api/users", { query: { take: 100 } }).catch(
      () => ({ users: [] as Employee[] })
    )
  ]);
  const programs = programsRes.items;
  const employees = usersRes.users;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Schedule / Record Training"
        description="Enrol an employee in a training program with attendance and assessment"
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: "New" }]}
      />
      <TrainingForm programs={programs} employees={employees} />
    </div>
  );
}
